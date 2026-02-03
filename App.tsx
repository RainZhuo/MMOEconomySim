import React, { useState, useEffect, useRef } from 'react';
import 
  { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, AreaChart, Area, BarChart, Bar } 
from 'recharts';
import * as XLSX from 'xlsx';
import { 
  Bot, BotAction, GlobalState, BotPersonality, PriceTrend, LogEntry, DailyStat
} from './types';
import { 
  INITIAL_RESERVE_LVMON, INITIAL_RESERVE_MEME, PERSONALITY_DISTRIBUTION, PERSONALITY_CONFIG,
  CRAFT_COST, WEALTH_PER_ITEM, RESERVOIR_CONTRIBUTION_RATE, CHEST_OPEN_COST,
  DAILY_MEME_REWARD, TAX_RATE, STAKING_DIVIDEND_RATE
} from './constants';
import { 
  randomInt, getAmountOut, getSpotPrice, calculateBuybackRate, calculateNewChests, formatCurrency 
} from './utils';
import { generateSingleBotDecision } from './services/geminiService';
import InfoCard from './components/InfoCard';
import BotTable from './components/BotTable';
import { 
  Coins, TrendingUp, Pickaxe, Landmark, Play, Pause, FolderInput, RotateCcw, Activity, FileSpreadsheet
} from 'lucide-react';

const App: React.FC = () => {
  // --- State ---
  const [day, setDay] = useState<number>(1);
  const [simulationRunning, setSimulationRunning] = useState<boolean>(false);
  const [processing, setProcessing] = useState<boolean>(false);
  const [activeBotId, setActiveBotId] = useState<number | null>(null);
  
  const [bots, setBots] = useState<Bot[]>([]);
  const [globalState, setGlobalState] = useState<GlobalState>({
    day: 1,
    reserveMEME: INITIAL_RESERVE_MEME,
    reserveLvMON: INITIAL_RESERVE_LVMON,
    reservoirLvMON: 0,
    totalWealth: 0,
    totalStakedMeme: 0,
    totalMedalsInPool: 0,
    dailyChestRevenue: 0,
    dailyNewWealth: 0,
    dailyTaxPool: 0,
    marketPrice: INITIAL_RESERVE_LVMON / INITIAL_RESERVE_MEME,
    priceTrend: PriceTrend.Stable,
    buybackHistory: []
  });

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [history, setHistory] = useState<DailyStat[]>([]);
  const [botHistory, setBotHistory] = useState<any[]>([]); // For Excel export
  
  // File System Handle for Real-time Logging
  const [dirHandle, setDirHandle] = useState<any>(null); // Using any for FileSystemDirectoryHandle to avoid ts lib issues

  const scrollRef = useRef<HTMLDivElement>(null);

  // --- Initialization ---
  useEffect(() => {
    initializeBots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = (type: LogEntry['type'], message: string) => {
    setLogs(prev => [...prev, { day, type, message }]);
  };

  const initializeBots = () => {
    const newBots: Bot[] = PERSONALITY_DISTRIBUTION.map((personality, index) => {
      const config = PERSONALITY_CONFIG[personality];
      const initialFunds = randomInt(config.minStart, config.maxStart);
      return {
        id: index,
        personality,
        initialLvMON: initialFunds,
        lvMON: initialFunds,
        meme: 0,
        stakedMeme: 0,
        medals: 0,
        investedMedals: 0,
        wealth: 0,
        chests: 0,
        chestsOpenedToday: 0,
        equipmentCount: 0,
        lastActionLog: "Initialized"
      };
    });
    setBots(newBots);
    setLogs([{ day: 0, type: 'INFO', message: 'Simulation Initialized' }]);
    
    // Initial Chart Point
    setHistory([{
      day: 1,
      price: INITIAL_RESERVE_LVMON / INITIAL_RESERVE_MEME,
      wealth: 0,
      reservoir: 0,
      staked: 0
    }]);
  };

  // --- Real-time Logging ---
  const selectLogFolder = async () => {
    try {
      // @ts-ignore - showDirectoryPicker is standard in modern browsers but might need dom lib update
      const handle = await window.showDirectoryPicker();
      setDirHandle(handle);
      addLog('INFO', 'Logging enabled: Excel files will update in real-time in selected folder.');
    } catch (err) {
      console.error("Folder selection failed:", err);
      addLog('ERROR', 'Failed to select folder for logging.');
    }
  };

  const writeLogsToDisk = async (currentHistory: DailyStat[], currentBotHistory: any[]) => {
    if (!dirHandle) return;

    try {
      // 1. Write Global Stats
      const wbGlobal = XLSX.utils.book_new();
      const globalData = currentHistory.map(h => ({
        Day: h.day,
        Price: h.price,
        TotalWealth: h.wealth,
        Reservoir: h.reservoir,
        TotalStaked: h.staked
      }));
      const wsGlobal = XLSX.utils.json_to_sheet(globalData);
      XLSX.utils.book_append_sheet(wbGlobal, wsGlobal, "Global Overview");
      const globalBuffer = XLSX.write(wbGlobal, { bookType: 'xlsx', type: 'array' });
      
      const globalFileHandle = await dirHandle.getFileHandle('MMO_Economy_Sim.xlsx', { create: true });
      const globalWritable = await globalFileHandle.createWritable();
      await globalWritable.write(globalBuffer);
      await globalWritable.close();

      // 2. Write Bot Logs
      const wbBots = XLSX.utils.book_new();
      const wsBots = XLSX.utils.json_to_sheet(currentBotHistory);
      XLSX.utils.book_append_sheet(wbBots, wsBots, "Bot Logs");
      const botsBuffer = XLSX.write(wbBots, { bookType: 'xlsx', type: 'array' });
      
      const botsFileHandle = await dirHandle.getFileHandle('BotLogs.xlsx', { create: true });
      const botsWritable = await botsFileHandle.createWritable();
      await botsWritable.write(botsBuffer);
      await botsWritable.close();

    } catch (err: any) {
      // Check if it's a file lock error (common if user has Excel open)
      if (err.name === 'NoModificationAllowedError' || err.message.includes('locked')) {
         addLog('ERROR', 'File Write Failed: Excel file is likely open and locked. Close it to resume logging.');
      } else {
         console.error("Real-time write failed", err);
         addLog('ERROR', `Log Write Error: ${err.message}`);
      }
    }
  };

  // --- Core Simulation Logic ---

  const advanceDay = async () => {
    if (processing) return;
    setProcessing(true);

    try {
      addLog('INFO', `--- Day ${day} Start ---`);
      
      // Reset daily counters
      let currentBots: Bot[] = bots.map(b => ({ ...b, chestsOpenedToday: 0 }));
      let currentState = { ...globalState };

      // 1. Morning Rewards (Based on Yesterday's Pool) & Daily Chest Issuance
      const poolTotal = currentState.totalMedalsInPool; 
      let distributedRewardTotal = 0;
      let taxCollected = 0;
      let totalDailyChestsIssued = 0;

      // First pass: Distribute Pool Rewards and Issue Daily Chests
      currentBots = currentBots.map(bot => {
        let newMeme = bot.meme;
        let newInvested = bot.investedMedals;
        
        // Medal Pool Reward
        if (bot.investedMedals > 0 && poolTotal > 0) {
          const share = bot.investedMedals / poolTotal;
          const rawReward = DAILY_MEME_REWARD * share;
          const tax = rawReward * TAX_RATE;
          const netReward = rawReward - tax;
          
          taxCollected += tax;
          distributedRewardTotal += netReward;
          newMeme += netReward;
          newInvested = 0; // Reset after payout
        }

        // Chest Issuance (Morning Stipend based on Wealth)
        const dailyChests = Math.floor(bot.wealth / 100);
        totalDailyChestsIssued += dailyChests;

        return {
          ...bot,
          meme: newMeme,
          investedMedals: newInvested,
          chests: bot.chests + dailyChests // Accumulate chests
        };
      });
      
      if (poolTotal > 0) {
        addLog('INFO', `Distributed ${formatCurrency(distributedRewardTotal)} MEME. Tax: ${formatCurrency(taxCollected)} MEME.`);
      } else {
        addLog('INFO', 'No medals in pool yesterday. No rewards distributed.');
      }
      
      if (totalDailyChestsIssued > 0) {
         addLog('INFO', `Morning Supply: Issued ${totalDailyChestsIssued} chests based on bot wealth.`);
      }

      // 2. Tax Redistribution (Based on Wealth)
      if (taxCollected > 0 && currentState.totalWealth > 0) {
         currentBots = currentBots.map(bot => {
           if (bot.wealth > 0) {
             const share = bot.wealth / currentState.totalWealth;
             const dividend = taxCollected * share;
             return { ...bot, meme: bot.meme + dividend };
           }
           return bot;
         });
         addLog('INFO', `Redistributed tax dividends to wealthy bots.`);
      }

      // Update State Initial Reward Phase
      setBots(currentBots);
      setGlobalState(currentState);

      // 3. Sequential Execution Phase
      // Shuffle bots for random turn order
      const turnOrder = [...currentBots].sort(() => Math.random() - 0.5);
      const botMap = new Map<number, Bot>(currentBots.map(b => [b.id, b]));
      
      // Track logs for export
      const turnLogs = new Map<number, { log: string, rationale: string }>();

      let todayNewWealth = 0;
      let todayChestRevenue = 0;
      let todayInvestedMedals = 0;

      addLog('INFO', '--- Bot Turns Start ---');

      // Loop through shuffled bots sequentially
      for (let i = 0; i < turnOrder.length; i++) {
        const botRef = turnOrder[i];

        // --- Rate Limiting Strategy for Free Tier ---
        // 15 requests per minute = 1 request every 4 seconds.
        // We add a 3 second delay between bots. 
        // Including API latency (~1-2s), this ensures ~5s per bot.
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }

        // Highlight current bot
        setActiveBotId(botRef.id);

        // Always get fresh bot state from map (though in this local scope botRef is stale, we use map)
        const bot = botMap.get(botRef.id);
        
        if (!bot) {
            console.error(`Bot ${botRef.id} not found in map`);
            continue;
        }
        
        // Pass CURRENT state (including price changes from previous bots in this loop)
        const action = await generateSingleBotDecision(day, currentState, bot, Array.from(botMap.values()));
        
        let actionLog = "";
        
        // --- Execute Decision ---

        // 4.1 Salvage (Emergency)
        if (action.salvageCount > 0 && bot.equipmentCount >= action.salvageCount) {
           const refund = action.salvageCount * CRAFT_COST * 0.5;
           bot.lvMON += refund;
           bot.equipmentCount -= action.salvageCount;
           bot.wealth -= action.salvageCount * WEALTH_PER_ITEM;
           currentState.totalWealth -= action.salvageCount * WEALTH_PER_ITEM;
           todayNewWealth -= action.salvageCount * WEALTH_PER_ITEM;
           actionLog += `Salvaged ${action.salvageCount}. `;
        }

        // 4.2 Craft
        const maxCraft = Math.floor(bot.lvMON / CRAFT_COST);
        const actualCraft = Math.min(action.craftCount, maxCraft);
        if (actualCraft > 0) {
          const cost = actualCraft * CRAFT_COST;
          bot.lvMON -= cost;
          bot.equipmentCount += actualCraft;
          
          const oldWealth = bot.wealth;
          const wealthGain = actualCraft * WEALTH_PER_ITEM;
          bot.wealth += wealthGain;
          
          // Incremental Chest Issuance (based on wealth GAIN this turn)
          // Uses delta of floors to handle remainders correctly across multiple turns
          const addedChests = Math.floor(bot.wealth / 100) - Math.floor(oldWealth / 100);
          bot.chests += addedChests;

          currentState.totalWealth += wealthGain;
          todayNewWealth += wealthGain;
          
          currentState.reservoirLvMON += cost * RESERVOIR_CONTRIBUTION_RATE;
          actionLog += `Crafted ${actualCraft} (+${addedChests} chests). `;
        }

        // 4.3 Open Chests
        // Limit: Can't open more than you have, or more than you can afford
        const maxOpen = Math.min(bot.chests, Math.floor(bot.lvMON / CHEST_OPEN_COST));
        const actualOpen = Math.min(action.openChests, maxOpen);
        
        if (actualOpen > 0) {
          const cost = actualOpen * CHEST_OPEN_COST;
          bot.lvMON -= cost;
          bot.chests -= actualOpen; // CONSUME Chests
          bot.chestsOpenedToday += actualOpen;
          todayChestRevenue += cost;
          
          let medalsGained = 0;
          for(let i=0; i<actualOpen; i++) {
            medalsGained += randomInt(5, 15);
          }
          bot.medals += medalsGained;
          actionLog += `Opened ${actualOpen} chests (+${medalsGained} medals). `;
        }

        // 4.4 Invest Medals
        if (action.investMedals && bot.medals > 0) {
          const investAmount = bot.medals;
          bot.investedMedals += investAmount; 
          todayInvestedMedals += investAmount;
          bot.medals = 0;
          actionLog += `Invested ${investAmount} medals. `;
        }

        // 4.5 Unstake
        if (action.unstakeMemePercent > 0 && bot.stakedMeme > 0) {
           const amount = Math.floor(bot.stakedMeme * action.unstakeMemePercent);
           if (amount > 0) {
             bot.stakedMeme -= amount;
             bot.meme += amount;
             currentState.totalStakedMeme -= amount;
             actionLog += `Unstaked ${formatCurrency(amount)} MEME. `;
           }
        }

        // 4.6 Sell / Stake (Normalized)
        const availableMeme = bot.meme;
        let sellPct = action.sellMemePercent;
        let stakePct = action.stakeMemePercent;

        if (sellPct + stakePct > 1.0) {
            const factor = sellPct + stakePct;
            sellPct = sellPct / factor;
            stakePct = stakePct / factor;
        }

        const plannedSellAmount = Math.floor(availableMeme * sellPct);
        const plannedStakeAmount = Math.floor(availableMeme * stakePct);

        // Sell
        if (plannedSellAmount > 0) {
           const amountIn = Math.min(bot.meme, plannedSellAmount);
           if (amountIn > 0) {
             const amountOut = getAmountOut(amountIn, currentState.reserveMEME, currentState.reserveLvMON);
             
             bot.meme -= amountIn;
             bot.lvMON += amountOut;
             
             currentState.reserveMEME += amountIn;
             currentState.reserveLvMON -= amountOut;
             
             // UPDATE MARKET PRICE IMMEDIATELY FOR NEXT BOT
             currentState.marketPrice = getSpotPrice(currentState.reserveLvMON, currentState.reserveMEME);
             const prevPrice = globalState.marketPrice; 
             
             actionLog += `Sold ${formatCurrency(amountIn)} MEME. `;
           }
        }

        // Stake
        if (plannedStakeAmount > 0) {
           const amount = Math.min(bot.meme, plannedStakeAmount);
           if (amount > 0) {
             bot.meme -= amount;
             bot.stakedMeme += amount;
             currentState.totalStakedMeme += amount;
             actionLog += `Staked ${formatCurrency(amount)} MEME. `;
           }
        }

        bot.lastActionLog = `[D${day}] ${actionLog || "Idle"}`;
        bot.lastDecisionRationale = action.rationale;
        
        turnLogs.set(bot.id, { log: actionLog, rationale: action.rationale });

        // Update Maps & State incrementally
        botMap.set(bot.id, bot);
        
      } // End Sequential Loop

      setActiveBotId(null); // Clear active status

      currentBots = Array.from(botMap.values());
      setBots(currentBots); // Bulk update bots after all turns

      // 5. System Buyback
      const buybackRate = calculateBuybackRate(todayNewWealth);
      const budgetFromReservoir = currentState.reservoirLvMON * buybackRate;
      const budgetFromChests = todayChestRevenue;
      const totalBuybackBudget = budgetFromReservoir + budgetFromChests;

      let burnedMEME = 0;
      let distributedStaking = 0;

      if (totalBuybackBudget > 0 && currentState.reserveMEME > 1000) {
         addLog('MARKET', `Buyback Analysis:
          Reservoir (${formatCurrency(currentState.reservoirLvMON)}) * Rate (${(buybackRate * 100).toFixed(2)}%) = ${formatCurrency(budgetFromReservoir)}
          + Chest Revenue = ${formatCurrency(budgetFromChests)}
          = Total Budget ${formatCurrency(totalBuybackBudget)}`);

         const amountInLvMON = totalBuybackBudget;
         const memeBought = getAmountOut(amountInLvMON, currentState.reserveLvMON, currentState.reserveMEME);
         
         currentState.reserveLvMON += amountInLvMON;
         currentState.reserveMEME -= memeBought;
         currentState.reservoirLvMON -= budgetFromReservoir;

         const toStakers = memeBought * STAKING_DIVIDEND_RATE;
         const toBurn = memeBought - toStakers;
         
         burnedMEME = toBurn;
         distributedStaking = toStakers;

         if (currentState.totalStakedMeme > 0) {
            currentBots = currentBots.map(bot => {
              if (bot.stakedMeme > 0) {
                 const share = bot.stakedMeme / currentState.totalStakedMeme;
                 return { ...bot, meme: bot.meme + (toStakers * share) };
              }
              return bot;
            });
         } else {
             burnedMEME += toStakers; 
         }

         addLog('MARKET', `Buyback Execution: Bought ${formatCurrency(memeBought)} MEME. Burned ${formatCurrency(burnedMEME)}. Distributed ${formatCurrency(distributedStaking)}.`);
      } else {
        addLog('INFO', `Buyback skipped (Budget: ${formatCurrency(totalBuybackBudget)})`);
      }

      // 6. Finalize Day
      const currentPrice = getSpotPrice(currentState.reserveLvMON, currentState.reserveMEME);
      const prevPrice = globalState.marketPrice; // Price at START of day
      
      currentState.marketPrice = currentPrice;
      currentState.priceTrend = currentPrice > prevPrice ? PriceTrend.Up : (currentPrice < prevPrice ? PriceTrend.Down : PriceTrend.Stable);
      currentState.dailyNewWealth = todayNewWealth; 
      currentState.totalMedalsInPool = todayInvestedMedals; 
      
      const newHistoryItem: DailyStat = {
        day: day + 1,
        price: currentPrice,
        wealth: currentState.totalWealth,
        reservoir: currentState.reservoirLvMON,
        staked: currentState.totalStakedMeme
      };

      setBots(currentBots);
      setGlobalState({ ...currentState, day: day + 1 });
      const nextHistory = [...history, newHistoryItem];
      setHistory(nextHistory);
      setDay(d => d + 1);

      // --- RECORD BOT HISTORY FOR EXPORT ---
      // We do this at the very end to capture final balances (after buyback dividends)
      const dailyBotRecords = currentBots.map(bot => {
         const turnLog = turnLogs.get(bot.id) || { log: '-', rationale: '-' };
         return {
            Day: day,
            BotID: bot.id,
            Personality: bot.personality,
            Strategy_Rationale: turnLog.rationale,
            Action_Log: turnLog.log,
            LvMON: bot.lvMON,
            PnL: bot.lvMON - bot.initialLvMON,
            MEME: bot.meme,
            Staked_MEME: bot.stakedMeme,
            Wealth: bot.wealth,
            Chests_Total: bot.chests,
            Chests_Opened_Today: bot.chestsOpenedToday,
            Medals_Held: bot.medals,
            Medals_Invested: bot.investedMedals,
            // Global Context
            Global_Price: currentPrice,
            Global_Reservoir: currentState.reservoirLvMON,
            Global_Total_Wealth: currentState.totalWealth,
            Global_Total_Staked: currentState.totalStakedMeme
         };
      });
      const nextBotHistory = [...botHistory, ...dailyBotRecords];
      setBotHistory(nextBotHistory);

      // --- REAL TIME LOGGING ---
      if (dirHandle) {
         await writeLogsToDisk(nextHistory, nextBotHistory);
      }

    } catch (e) {
      console.error(e);
      addLog('ERROR', 'Simulation step failed');
      setActiveBotId(null);
    } finally {
      setProcessing(false);
    }
  };

  // --- Controls ---

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (simulationRunning && !processing) {
      interval = setInterval(() => {
        advanceDay();
      }, 500); // Faster polling since async operations take time
    }
    return () => {
      if (interval) clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulationRunning, processing]); 

  const resetSim = () => {
    setSimulationRunning(false);
    setDay(1);
    initializeBots();
    setGlobalState({
      day: 1,
      reserveMEME: INITIAL_RESERVE_MEME,
      reserveLvMON: INITIAL_RESERVE_LVMON,
      reservoirLvMON: 0,
      totalWealth: 0,
      totalStakedMeme: 0,
      totalMedalsInPool: 0,
      dailyChestRevenue: 0,
      dailyNewWealth: 0,
      dailyTaxPool: 0,
      marketPrice: INITIAL_RESERVE_LVMON / INITIAL_RESERVE_MEME,
      priceTrend: PriceTrend.Stable,
      buybackHistory: []
    });
    setLogs([]);
    setHistory([{
      day: 1,
      price: INITIAL_RESERVE_LVMON / INITIAL_RESERVE_MEME,
      wealth: 0,
      reservoir: 0,
      staked: 0
    }]);
    setBotHistory([]);
    setActiveBotId(null);
    setDirHandle(null); // Reset file handle
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 font-sans">
      <header className="flex justify-between items-center mb-8 border-b border-slate-700 pb-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            MMO Economy Simulator
          </h1>
          <p className="text-slate-400 text-sm mt-1">AI-Driven Autonomous Agent Economy (Sequential Turn-Based)</p>
        </div>
        <div className="flex gap-3">
           <button 
             onClick={() => setSimulationRunning(!simulationRunning)}
             className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all ${simulationRunning ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}
           >
             {simulationRunning ? <Pause size={18} /> : <Play size={18} />}
             {simulationRunning ? "Pause" : "Start"}
           </button>
           <button onClick={() => advanceDay()} disabled={simulationRunning || processing} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50">
             Next Day
           </button>
           <button onClick={resetSim} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300" title="Reset Simulation">
             <RotateCcw size={20} />
           </button>
           
           <button 
             onClick={selectLogFolder} 
             className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${dirHandle ? 'bg-green-600/20 text-green-400 border border-green-600' : 'bg-slate-700 hover:bg-slate-600'}`}
             title={dirHandle ? "Logging Active: Real-time updates to folder" : "Select folder to enable real-time Excel logging"}
           >
             {dirHandle ? <FileSpreadsheet size={18} /> : <FolderInput size={18} />}
             {dirHandle ? "Logging Active" : "Set Log Folder"}
           </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        <InfoCard 
          title="MEME Price" 
          value={formatCurrency(globalState.marketPrice)} 
          subValue={`Trend: ${globalState.priceTrend}`}
          icon={<TrendingUp size={20} />} 
          color={globalState.priceTrend === 'Up' ? 'green' : (globalState.priceTrend === 'Down' ? 'red' : 'blue')}
        />
        <InfoCard 
          title="Reservoir" 
          value={formatCurrency(globalState.reservoirLvMON)} 
          subValue="LvMON for Buyback"
          icon={<Landmark size={20} />} 
          color="purple"
        />
        <InfoCard 
          title="Total Wealth" 
          value={formatCurrency(globalState.totalWealth)} 
          subValue="All Bots"
          icon={<Pickaxe size={20} />} 
          color="yellow"
        />
        <InfoCard 
          title="Staked MEME" 
          value={formatCurrency(globalState.totalStakedMeme)} 
          subValue={`${((globalState.totalStakedMeme/globalState.reserveMEME)*100).toFixed(1)}% of Supply`}
          icon={<Coins size={20} />} 
          color="blue"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Charts */}
        <div className="lg:col-span-2 h-[400px] bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
            <Activity size={18} /> Market History
          </h3>
          <ResponsiveContainer width="100%" height="90%">
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="day" stroke="#9ca3af" />
              <YAxis yAxisId="left" stroke="#34d399" domain={['auto', 'auto']} />
              <YAxis yAxisId="right" orientation="right" stroke="#c084fc" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
              />
              <Line yAxisId="left" type="monotone" dataKey="price" stroke="#34d399" dot={false} strokeWidth={2} name="Price" />
              <Line yAxisId="right" type="monotone" dataKey="reservoir" stroke="#c084fc" dot={false} strokeWidth={2} name="Reservoir" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Logs */}
        <div className="h-[400px] bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex flex-col">
           <h3 className="text-lg font-medium mb-2">Simulation Logs</h3>
           <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto scrollbar-thin text-xs font-mono space-y-1 p-2 bg-slate-900/50 rounded-lg">
             {logs.map((log, i) => (
               <div key={i} className={`
                 ${log.type === 'ACTION' ? 'text-slate-400' : ''}
                 ${log.type === 'INFO' ? 'text-blue-300 font-bold mt-2' : ''}
                 ${log.type === 'MARKET' ? 'text-amber-300' : ''}
                 ${log.type === 'ERROR' ? 'text-red-500' : ''}
                 whitespace-pre-line
               `}>
                 <span className="opacity-50 mr-2">[D{log.day}]</span>
                 {log.message}
               </div>
             ))}
           </div>
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-xl font-bold mb-4">Live Bot Status</h3>
        <BotTable bots={bots} activeBotId={activeBotId} />
      </div>
    </div>
  );
};

export default App;