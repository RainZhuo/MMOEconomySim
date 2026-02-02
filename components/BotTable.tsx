import React from 'react';
import { Bot, BotPersonality } from '../types';
import { formatCurrency } from '../utils';

interface BotTableProps {
  bots: Bot[];
  activeBotId: number | null;
}

const BotTable: React.FC<BotTableProps> = ({ bots, activeBotId }) => {
  const getPersonalityColor = (p: BotPersonality) => {
    switch (p) {
      case BotPersonality.Whale: return 'text-purple-400';
      case BotPersonality.Degen: return 'text-red-400';
      case BotPersonality.Farmer: return 'text-green-400';
      case BotPersonality.DiamondHand: return 'text-cyan-400';
      case BotPersonality.PaperHand: return 'text-yellow-400';
      default: return 'text-slate-400';
    }
  };

  if (!bots || bots.length === 0) {
    return <div className="p-4 text-slate-500 italic text-center">No bots initialized...</div>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-800/50">
      <table className="w-full text-sm text-left text-slate-300">
        <thead className="text-xs uppercase bg-slate-900/50 text-slate-400">
          <tr>
            <th className="px-4 py-3">ID</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3 text-right">LvMON</th>
            <th className="px-4 py-3 text-right">PnL</th>
            <th className="px-4 py-3 text-right">MEME</th>
            <th className="px-4 py-3 text-right">Staked</th>
            <th className="px-4 py-3 text-right">Wealth</th>
            <th className="px-4 py-3 text-right">宝箱<br/><span className="text-[10px] normal-case opacity-70">Today(Total)</span></th>
            <th className="px-4 py-3 text-right">Medals</th>
            <th className="px-4 py-3">Last Action</th>
          </tr>
        </thead>
        <tbody>
          {bots.map((bot) => {
            const pnl = bot.lvMON - (bot.initialLvMON || 0);
            const pnlColor = pnl >= 0 ? 'text-green-400' : 'text-red-400';
            const pnlSign = pnl >= 0 ? '+' : '';
            const isActive = bot.id === activeBotId;
            
            return (
              <tr 
                key={bot.id} 
                className={`
                  border-b border-slate-700/50 transition-colors duration-200
                  ${isActive 
                    ? 'bg-blue-900/40 border-l-4 border-l-blue-400' 
                    : 'hover:bg-slate-700/30 border-l-4 border-l-transparent'
                  }
                `}
              >
                <td className="px-4 py-2 font-mono flex items-center gap-2">
                  #{bot.id}
                  {isActive && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                    </span>
                  )}
                </td>
                <td className={`px-4 py-2 font-bold ${getPersonalityColor(bot.personality)}`}>
                  {bot.personality}
                </td>
                <td className="px-4 py-2 text-right font-mono text-emerald-300">
                  {formatCurrency(bot.lvMON)}
                </td>
                <td className={`px-4 py-2 text-right font-mono ${pnlColor}`}>
                  {pnlSign}{formatCurrency(pnl)}
                </td>
                <td className="px-4 py-2 text-right font-mono text-pink-300">
                  {formatCurrency(bot.meme)}
                </td>
                <td className="px-4 py-2 text-right font-mono text-indigo-300">
                  {formatCurrency(bot.stakedMeme)}
                </td>
                <td className="px-4 py-2 text-right">{formatCurrency(bot.wealth)}</td>
                <td className="px-4 py-2 text-right font-mono text-amber-300">
                  {bot.chestsOpenedToday || 0}({bot.chests})
                </td>
                <td className="px-4 py-2 text-right">{bot.medals} ({bot.investedMedals})</td>
                <td className="px-4 py-2 text-xs truncate max-w-[200px] text-slate-400" title={bot.lastActionLog}>
                  {isActive ? <span className="text-blue-400 animate-pulse">Thinking...</span> : (bot.lastActionLog || '-')}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default BotTable;