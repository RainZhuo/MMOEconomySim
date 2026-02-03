import { GoogleGenAI, Type } from "@google/genai";
import { Bot, GlobalState, BotAction, BotPersonality } from '../types';
import { CRAFT_COST, WEALTH_PER_ITEM } from '../constants';
import { STRATEGY_SYSTEM_INSTRUCTION } from './strategyPrompt';

const getAiClient = () => {
  // Use process.env.API_KEY directly as per SDK guidelines.
  // We assume process.env.API_KEY is available and valid.
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const generateSingleBotDecision = async (
  day: number,
  globalState: GlobalState,
  currentBot: Bot,
  allBots: Bot[]
): Promise<BotAction> => {
  const ai = getAiClient();
  
  const systemInstruction = STRATEGY_SYSTEM_INSTRUCTION;

  const prompt = JSON.stringify({
    day,
    turnContext: {
      message: `You are making decisions in the middle of Day ${day}. Other bots may have already acted. React to current market conditions.`,
      botsActedSoFar: allBots.filter(b => b.lastActionLog && b.lastActionLog.includes(`[D${day}]`)).length, 
    },
    market: {
      price: globalState.marketPrice,
      trend: globalState.priceTrend,
      priceChangeToday: ((globalState.marketPrice - (2000000/1000000)) / (2000000/1000000)) * 100, // Approx vs genesis
      apy: globalState.totalStakedMeme > 0 
        ? ((globalState.buybackHistory[globalState.buybackHistory.length-1]?.distributedMEME || 0) * 365 / globalState.totalStakedMeme) 
        : 0,
      totalMedalsInPool: globalState.totalMedalsInPool,
      reserveMEME: Math.floor(globalState.reserveMEME),
      reserveLvMON: Math.floor(globalState.reserveLvMON),
      reservoirLvMON: Math.floor(globalState.reservoirLvMON)
    },
    thisBot: {
      id: currentBot.id,
      personality: currentBot.personality,
      lvMON: Math.floor(currentBot.lvMON),
      meme: Math.floor(currentBot.meme),
      stakedMeme: Math.floor(currentBot.stakedMeme),
      medals: currentBot.medals,
      chests: currentBot.chests,
      wealth: currentBot.wealth,
      equipmentCount: currentBot.equipmentCount,
      netWorth: Math.floor(
        currentBot.lvMON + 
        (currentBot.meme + currentBot.stakedMeme) * globalState.marketPrice + 
        currentBot.wealth * 1.5
      ),
      // Memory Injection
      lastDayPlan: currentBot.memory?.lastDayGoal || "No previous plan",
      goalAchieved: currentBot.memory?.achievedGoal === true ? "YES" : (currentBot.memory?.achievedGoal === false ? "NO" : "UNKNOWN/NEW")
    },
    otherBots: allBots
      .filter(b => b.id !== currentBot.id)
      .map(b => ({
        id: b.id,
        personality: b.personality,
        netWorth: Math.floor(
          b.lvMON + 
          (b.meme + b.stakedMeme) * globalState.marketPrice + 
          b.wealth * 1.5
        ),
        medalsInvested: b.investedMedals,
        stakedMeme: Math.floor(b.stakedMeme)
      }))
  });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash', // Use efficient model
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            botId: { type: Type.INTEGER },
            craftCount: { type: Type.INTEGER },
            salvageCount: { type: Type.INTEGER },
            openChests: { type: Type.INTEGER },
            investMedals: { type: Type.BOOLEAN },
            unstakeMemePercent: { type: Type.NUMBER },
            sellMemePercent: { type: Type.NUMBER },
            stakeMemePercent: { type: Type.NUMBER },
            rationale: { type: Type.STRING },
            tomorrowGoal: { type: Type.STRING, description: "Optional: Your plan for tomorrow (one sentence)" }
          },
          required: ["botId", "craftCount", "salvageCount", "openChests", "investMedals", "unstakeMemePercent", "sellMemePercent", "stakeMemePercent", "rationale"]
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("Empty response from Gemini");
    
    const action = JSON.parse(jsonText) as BotAction;
    return action;

  } catch (error) {
    console.error("Gemini AI Error for Bot", currentBot.id, error);
    return generateFallbackDecision(currentBot, globalState);
  }
};

// Fallback for single bot
const generateFallbackDecision = (bot: Bot, state: GlobalState): BotAction => {
    let craft = 0;
    let open = 0;
    let invest = true;
    let sell = 0;
    let stake = 0;
    let unstake = 0;
    const rationale = "Fallback Logic (AI Unavailable)";

    if (bot.personality === BotPersonality.Farmer) {
       if (bot.lvMON > CRAFT_COST * 5) { craft = 2; open = 1; }
       sell = 1.0; 
    } else if (bot.personality === BotPersonality.Degen) {
       if (bot.lvMON > CRAFT_COST) { craft = 5; open = 5; }
       stake = 0.5; sell = 0.5;
    } else if (bot.personality === BotPersonality.Whale) {
       if (bot.lvMON > CRAFT_COST * 10) { craft = 10; open = 10; }
       stake = 0.8;
       if (state.priceTrend === 'Up') sell = 0.2;
    } else if (bot.personality === BotPersonality.PaperHand) {
        if (bot.lvMON > CRAFT_COST) craft = 1;
        sell = 1.0;
    } else {
        // Diamond Hand
        if (bot.lvMON > CRAFT_COST) craft = 1;
        stake = 1.0;
    }

    return {
      botId: bot.id,
      craftCount: craft,
      salvageCount: 0,
      openChests: open,
      investMedals: invest,
      unstakeMemePercent: unstake,
      sellMemePercent: sell,
      stakeMemePercent: stake,
      rationale
    };
};