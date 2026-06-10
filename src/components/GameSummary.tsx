import React from 'react';
import { MatchState } from '../types';
import { Trophy, RefreshCw, Zap, Volume2, Gamepad2, Award } from 'lucide-react';

interface GameSummaryProps {
  match: MatchState;
  onRestart: () => void;
}

export default function GameSummary({ match, onRestart }: GameSummaryProps) {
  const { scoring } = match;
  
  const playerScore = scoring.playerTotalRuns;
  const cpuScore = scoring.cpuTotalRuns;
  
  const isPlayerWin = playerScore > cpuScore;
  const isDraw = playerScore === cpuScore;

  return (
    <div className="flex flex-col items-center justify-center p-6 md:p-8 bg-[#1a1c24] border border-slate-800 rounded-2xl shadow-[0_12px_44px_rgba(0,0,0,0.8)] max-w-lg mx-auto my-8 animate-fade-in text-white text-center">
      
      {/* Dynamic Celebration Indicator Badge */}
      <div className="mb-4">
        {isPlayerWin ? (
          <div className="relative">
            <div className="absolute inset-0 bg-amber-500/20 blur-2xl rounded-full scale-115" />
            <div className="relative p-4 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-500">
              <Trophy size={50} className="mx-auto drop-shadow-[0_4px_12px_rgba(245,158,11,0.3)]" />
            </div>
          </div>
        ) : isDraw ? (
          <div className="relative p-4 bg-slate-800 border border-slate-700 rounded-full text-slate-300">
            <Gamepad2 size={50} className="mx-auto" />
          </div>
        ) : (
          <div className="relative p-4 bg-slate-800/80 border border-slate-700/80 rounded-full text-slate-500">
            <Award size={50} className="mx-auto" />
          </div>
        )}
      </div>

      <h1 className="text-3xl font-black tracking-tight mb-1 text-white">
        {isPlayerWin ? '試合終了！あなたの勝利！' : isDraw ? '試合終了！引き分け！' : '試合終了！CPUの勝利'}
      </h1>
      <p className="text-xs text-slate-400 mb-6 font-mono tracking-wider uppercase">3-Inning Pro Match Ended</p>

      {/* Modern Retro Final Score box */}
      <div className="w-full bg-[#0c0e14] p-4 rounded-xl border border-slate-800 mb-6 font-mono">
        <div className="grid grid-cols-2 gap-4 text-center items-center">
          <div className="border-r border-slate-800 pr-2">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-sans font-bold">PLAYER SCORE</p>
            <p className="text-4xl font-black text-amber-500">{playerScore}</p>
            <p className="text-[10px] text-slate-400 font-sans mt-1">Hits: {scoring.playerTotalHits}</p>
          </div>
          <div className="pl-2">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-sans font-bold">CPU SCORE</p>
            <p className="text-4xl font-black text-rose-500">{cpuScore}</p>
            <p className="text-[10px] text-slate-400 font-sans mt-1">Hits: {scoring.cpuTotalHits}</p>
          </div>
        </div>
      </div>

      {/* Breakdown per inning details */}
      <div className="w-full text-sm mb-6 max-h-[140px] overflow-y-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-[10px] text-slate-400 font-mono text-center">
              <th className="py-1.5 text-left font-sans">回数 (INN)</th>
              <th className="py-1.5">1</th>
              <th className="py-1.5">2</th>
              <th className="py-1.5">3</th>
              <th className="py-1.5 font-bold text-amber-500 pl-4">合計 (R)</th>
            </tr>
          </thead>
          <tbody className="font-mono text-[12px] divide-y divide-slate-800/40">
            <tr>
              <td className="py-2 text-left font-sans text-rose-400 font-bold">CPU</td>
              <td className="py-2 text-center text-slate-400">{scoring.cpuRuns[0] ?? 0}</td>
              <td className="py-2 text-center text-slate-400">{scoring.cpuRuns[1] ?? 0}</td>
              <td className="py-2 text-center text-slate-400">{scoring.cpuRuns[2] ?? 0}</td>
              <td className="py-2 text-center text-rose-400 font-black pl-4">{scoring.cpuTotalRuns}</td>
            </tr>
            <tr>
              <td className="py-2 text-left font-sans text-amber-500 font-bold">PLAYER</td>
              <td className="py-2 text-center text-slate-400">{scoring.playerRuns[0] ?? 0}</td>
              <td className="py-2 text-center text-slate-400">{scoring.playerRuns[1] ?? 0}</td>
              <td className="py-2 text-center text-slate-400">{scoring.playerRuns[2] ?? 0}</td>
              <td className="py-2 text-center text-amber-500 font-black pl-4">{scoring.playerTotalRuns}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Button to restart game with motion transitions */}
      <button
        onClick={onRestart}
        className="w-full bg-gradient-to-r from-amber-600 to-amber-500 text-slate-950 hover:from-amber-500 hover:to-amber-400 hover:shadow-lg hover:shadow-amber-500/15 active:scale-[0.98] py-3.5 px-6 rounded-xl font-bold flex items-center justify-center gap-2 text-sm shadow-md transition-all cursor-pointer"
        id="restart-game-btn"
      >
        <RefreshCw size={15} />
        <b>もう一度遊ぶ (PLAY AGAIN)</b>
      </button>

    </div>
  );
}
