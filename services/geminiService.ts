import { GoogleGenAI, Type } from "@google/genai";
import { Bot, GlobalState, BotAction, BotPersonality } from '../types';
import { CRAFT_COST, WEALTH_PER_ITEM } from '../constants';

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API Key missing");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const generateBotDecisions = async (
  day: number,
  globalState: GlobalState,
  bots: Bot[]
): Promise<BotAction[]> => {
  const ai = getAiClient();
  
  // Fallback if no API key or error
  if (!ai) {
    return generateFallbackDecisions(bots, globalState);
  }

  const systemInstruction = `
    You are the simulation engine for an MMORPG economy. You control 10 Bots with specific personalities.
    Your goal is to maximize LvMON (fiat) for each bot based on their personality.
    
    Economic Context:
    - Craft Cost: ${CRAFT_COST} LvMON per item.
    - Wealth Gain: ${WEALTH_PER_ITEM} per item.
    - Wealth converts to Chests (1 per 100 wealth).
    - Opening Chests costs 10 LvMON -> yields 5-15 Medals.
    - Medals in Prize Pool share 1,000,000 MEME daily.
    - 90% MEME burned on buyback, 10% to stakers.
    
    Personalities:
    - Whale: Wealthy, stakes to control, sells high.
    - Degen: High risk, crafts/opens chests aggressively, dumps or stakes 100%.
    - Farmer: ROI focused. Only crafts if profitable. Sells MEME.
    - PaperHand: Sells MEME immediately if trend is Down.
    - DiamondHand: Never sells MEME, always stakes.

    Return a JSON array of actions for ALL 10 bots.
  `;

  const prompt = JSON.stringify({
    day,
    market: {
      price: globalState.marketPrice,
      trend: globalState.priceTrend,
      apy: globalState.totalStakedMeme > 0 ? ((globalState.buybackHistory[globalState.buybackHistory.length-1]?.distributedMEME || 0) * 365 / globalState.totalStakedMeme) : 0,
      totalMedalsInPool: globalState.totalMedalsInPool
    },
    bots: bots.map(b => ({
      id: b.id,
      personality: b.personality,
      lvMON: Math.floor(b.lvMON),
      meme: Math.floor(b.meme),
      staked: Math.floor(b.stakedMeme),
      medals: b.medals,
      chests: b.chests
    }))
  });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
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
              rationale: { type: Type.STRING }
            },
            required: ["botId", "craftCount", "salvageCount", "openChests", "investMedals", "unstakeMemePercent", "sellMemePercent", "stakeMemePercent", "rationale"]
          }
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("Empty response from Gemini");
    
    const actions = JSON.parse(jsonText) as BotAction[];
    
    // Validate output length
    if (actions.length !== 10) {
      console.warn("Gemini returned partial actions, filling with fallback");
      // Merge with fallback for missing bots
      const fallback = generateFallbackDecisions(bots, globalState);
      const actionMap = new Map(actions.map(a => [a.botId, a]));
      return fallback.map(fb => actionMap.get(fb.botId) || fb);
    }
    
    return actions;

  } catch (error) {
    console.error("Gemini AI Error:", error);
    return generateFallbackDecisions(bots, globalState);
  }
};

// Heuristic fallback if AI fails
const generateFallbackDecisions = (bots: Bot[], state: GlobalState): BotAction[] => {
  return bots.map(bot => {
    let craft = 0;
    let open = 0;
    let invest = true;
    let sell = 0;
    let stake = 0;
    let unstake = 0;
    const rationale = "Fallback Logic";

    // Simple Logic based on personality
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
  });
};