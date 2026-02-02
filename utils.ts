import { WEALTH_PER_ITEM, AMM_FEE } from './constants';

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
