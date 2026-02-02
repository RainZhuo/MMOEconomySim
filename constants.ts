import { BotPersonality } from './types';

export const CRAFT_COST = 300; // LvMON
export const WEALTH_PER_ITEM = 286;
export const CHEST_OPEN_COST = 10; // LvMON
export const DAILY_MEME_REWARD = 1000000;
export const RESERVOIR_CONTRIBUTION_RATE = 0.5; // 50% of craft cost goes to reservoir
export const TAX_RATE = 0.1; // 10% tax on rewards
export const STAKING_DIVIDEND_RATE = 0.1; // 10% of buyback goes to stakers
export const AMM_FEE = 0.003; // 0.3%

export const INITIAL_RESERVE_MEME = 1000000;
export const INITIAL_RESERVE_LVMON = 2000000;

export const PERSONALITY_DISTRIBUTION = [
  BotPersonality.Whale, BotPersonality.Whale,
  BotPersonality.Degen, BotPersonality.Degen,
  BotPersonality.Farmer, BotPersonality.Farmer,
  BotPersonality.PaperHand, BotPersonality.PaperHand,
  BotPersonality.DiamondHand, BotPersonality.DiamondHand
];

export const PERSONALITY_CONFIG = {
  [BotPersonality.Whale]: { minStart: 80000, maxStart: 150000 },
  [BotPersonality.Degen]: { minStart: 1000, maxStart: 8000 },
  [BotPersonality.Farmer]: { minStart: 15000, maxStart: 30000 },
  [BotPersonality.PaperHand]: { minStart: 5000, maxStart: 20000 },
  [BotPersonality.DiamondHand]: { minStart: 5000, maxStart: 20000 },
};
