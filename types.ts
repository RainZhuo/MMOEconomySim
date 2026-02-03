export enum BotPersonality {
  Whale = 'Whale',
  Degen = 'Degen',
  Farmer = 'Farmer',
  PaperHand = 'PaperHand',
  DiamondHand = 'DiamondHand'
}

export enum PriceTrend {
  Up = 'Up',
  Down = 'Down',
  Stable = 'Stable'
}

export interface BotMemory {
  lastDayGoal: string;
  targetMetrics?: {
    targetLvMON?: number;
    targetMedals?: number;
    targetChests?: number;
  };
  achievedGoal?: boolean;
}

export interface Bot {
  id: number;
  personality: BotPersonality;
  initialLvMON: number; // For PnL calculation
  lvMON: number;
  meme: number;
  stakedMeme: number;
  medals: number;
  investedMedals: number; // Medals currently in the pool (from yesterday)
  wealth: number;
  chests: number;
  chestsOpenedToday: number; // Tracked for UI display N(M)
  equipmentCount: number;
  lastActionLog?: string;
  lastDecisionRationale?: string;
  memory?: BotMemory;
}

export interface GlobalState {
  day: number;
  reserveMEME: number;
  reserveLvMON: number;
  reservoirLvMON: number; // Accumulates 50% of crafting costs
  totalWealth: number;
  totalStakedMeme: number;
  totalMedalsInPool: number; // Sum of all bots' invested medals
  dailyChestRevenue: number; // Accumulates chest open costs
  dailyNewWealth: number; // Tracked for Sigmoid calculation
  dailyTaxPool: number; // Tracked for redistribution
  marketPrice: number;
  priceTrend: PriceTrend;
  buybackHistory: { day: number; amountLvMON: number; burnedMEME: number; distributedMEME: number }[];
}

export interface BotAction {
  botId: number;
  craftCount: number;
  salvageCount: number;
  openChests: number;
  investMedals: boolean;
  unstakeMemePercent: number; // 0.0 - 1.0
  sellMemePercent: number;    // 0.0 - 1.0
  stakeMemePercent: number;   // 0.0 - 1.0
  rationale: string;
  tomorrowGoal?: string;      // Optional future planning
}

export interface LogEntry {
  day: number;
  type: 'INFO' | 'ACTION' | 'MARKET' | 'ERROR';
  message: string;
}

export interface DailyStat {
  day: number;
  price: number;
  wealth: number;
  reservoir: number;
  staked: number;
}