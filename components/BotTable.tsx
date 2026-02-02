import React from 'react';
import { Bot, BotPersonality } from '../types';
import { formatCurrency } from '../utils';

interface BotTableProps {
  bots: Bot[];
}

const BotTable: React.FC<BotTableProps> = ({ bots }) => {
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

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-800/50">
      <table className="w-full text-sm text-left text-slate-300">
        <thead className="text-xs uppercase bg-slate-900/50 text-slate-400">
          <tr>
            <th className="px-4 py-3">ID</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3 text-right">LvMON</th>
            <th className="px-4 py-3 text-right">MEME</th>
            <th className="px-4 py-3 text-right">Staked</th>
            <th className="px-4 py-3 text-right">Wealth</th>
            <th className="px-4 py-3 text-right">Medals</th>
            <th className="px-4 py-3">Last Action</th>
          </tr>
        </thead>
        <tbody>
          {bots.map((bot) => (
            <tr key={bot.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
              <td className="px-4 py-2 font-mono">#{bot.id}</td>
              <td className={`px-4 py-2 font-bold ${getPersonalityColor(bot.personality)}`}>
                {bot.personality}
              </td>
              <td className="px-4 py-2 text-right font-mono text-emerald-300">
                {formatCurrency(bot.lvMON)}
              </td>
              <td className="px-4 py-2 text-right font-mono text-pink-300">
                {formatCurrency(bot.meme)}
              </td>
              <td className="px-4 py-2 text-right font-mono text-indigo-300">
                {formatCurrency(bot.stakedMeme)}
              </td>
              <td className="px-4 py-2 text-right">{formatCurrency(bot.wealth)}</td>
              <td className="px-4 py-2 text-right">{bot.medals} ({bot.investedMedals})</td>
              <td className="px-4 py-2 text-xs truncate max-w-[200px] text-slate-400" title={bot.lastActionLog}>
                {bot.lastActionLog || '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default BotTable;
