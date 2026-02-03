import { WEALTH_PER_ITEM, AMM_FEE } from './constants';
import { Bot } from './types';

// Random integer between min and max (inclusive)
export const randomInt = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Uniswap v2 style getAmountOut
export const getAmountOut = (amountIn: number, reserveIn: number, reserveOut: number): number => {
  if (amountIn <= 0 || reserveIn <= 0 || reserveOut <= 0) return 0;
  
  const amountInWithFee = amountIn * (1 - AMM_FEE);
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn + amountInWithFee;
  
  return numerator / denominator;
};

// Calculate Spot Price (Reference only, not for execution)
export const getSpotPrice = (reserveLvMON: number, reserveMEME: number): number => {
  if (reserveMEME === 0) return 0;
  return reserveLvMON / reserveMEME;
};

// Sigmoid Buyback Rate Calculation
export const calculateBuybackRate = (dailyNewWealth: number): number => {
  // Base 2%, Max 10%. 
  // Center sigmoid around 50,000 wealth increase
  const k = 0.0001; 
  const x0 = 50000;
  const base = 0.02;
  const added = 0.08;
  
  return base + added / (1 + Math.exp(-k * (dailyNewWealth - x0)));
};

// Calculate Wealth to Chest conversion (100 Wealth -> 1 Chest)
export const calculateNewChests = (currentWealth: number): number => {
  return Math.floor(currentWealth / 100);
};

export const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
    notation: 'compact',
    compactDisplay: 'short'
  }).format(val);
};

// --- Memory & Planning Utils ---

export const extractGoalMetrics = (goalText: string) => {
  const metrics: { targetLvMON?: number; targetMedals?: number; targetChests?: number } = {};
  
  // Simple regex to find patterns like "500 LvMON", "10 chests", "100 medals"
  // Case insensitive
  
  const lvmonMatch = goalText.match(/(\d+)\s*(?:k)?\s*LvMON/i);
  if (lvmonMatch) {
    let val = parseInt(lvmonMatch[1]);
    if (goalText.toLowerCase().includes('k lvmon')) val *= 1000;
    metrics.targetLvMON = val;
  }

  const chestsMatch = goalText.match(/(\d+)\s*chest/i); // matches chest or chests
  if (chestsMatch) {
    metrics.targetChests = parseInt(chestsMatch[1]);
  }

  const medalsMatch = goalText.match(/(\d+)\s*medal/i);
  if (medalsMatch) {
    metrics.targetMedals = parseInt(medalsMatch[1]);
  }

  return metrics;
};

export const checkGoalCompletion = (bot: Bot, metrics?: { targetLvMON?: number; targetMedals?: number; targetChests?: number }): boolean => {
  if (!metrics) return false;
  
  let achieved = true;

  if (metrics.targetLvMON !== undefined) {
    if (bot.lvMON < metrics.targetLvMON) achieved = false;
  }
  
  // For chests/medals, we check strictly if they hold it OR invested it (for medals)
  // But usually goals are about "Accumulate X". 
  if (metrics.targetChests !== undefined) {
    if (bot.chests < metrics.targetChests) achieved = false;
  }

  if (metrics.targetMedals !== undefined) {
    // Check both held and invested, as investing is usually the goal
    if ((bot.medals + bot.investedMedals) < metrics.targetMedals) achieved = false;
  }

  // If no metrics were found/defined, we can't programmatically verify, 
  // so we default to false (or true, but let's say false to force AI to re-evaluate)
  // unless the metrics object is empty, in which case it's a text goal we can't check.
  if (metrics.targetLvMON === undefined && metrics.targetChests === undefined && metrics.targetMedals === undefined) {
      return false; 
  }

  return achieved;
};