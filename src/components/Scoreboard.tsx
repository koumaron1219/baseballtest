import React from 'react';
import { MatchState } from '../types';
import { Trophy, Shield, Swords, Info } from 'lucide-react';

interface ScoreboardProps {
  match: MatchState;
}

export default function Scoreboard({ match }: ScoreboardProps) {
  const { scoring, inning, isTop, strikes, balls, outs, runners, currentRole } = match;

  // SBO Indicator lights arrays
  const ballsArray = Array(3).fill(0).map((_, i) => i < balls);
  const strikesArray = Array(2).fill(0).map((_, i) => i < strikes);
  const outsArray = Array(2).fill(0).map((_, i) => i < outs);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 w-full">
      {/* 1. Retro Score Table Block */}
      <div className="lg:col-span-8 bg-[#13161c] border border-slate-800 rounded-xl p-3 shadow-[0_4px_24px_rgba(0,0,0,0.6)] flex flex-col justify-between">
        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-mono tracking-wider text-slate-400 uppercase">
                <th className="py-1 text-left font-sans pl-1.5">チーム名 (TEAM)</th>
                <th className="py-1 w-10">1</th>
                <th className="py-1 w-10">2</th>
                <th className="py-1 w-10">3</th>
                <th className="py-1 w-12 border-l border-slate-800 text-amber-500 font-bold">R</th>
                <th className="py-1 w-10 text-slate-300">H</th>
                <th className="py-1 w-10 text-slate-300">E</th>
              </tr>
            </thead>
            <tbody className="font-mono text-sm font-bold divide-y divide-slate-800/40 animate-fade-in">
              {/* CPU Row */}
              <tr className={`${currentRole === 'PITCHING' && isTop === false ? 'bg-amber-500/5' : ''}`}>
                <td className="py-1.5 text-left font-sans pl-1.5 flex items-center gap-1.5 text-white">
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block shadow-[0_0_8px_rgba(239,68,68,0.5)]"></span>
                  <span className="text-slate-200 text-xs">CPU (アウェイ)</span>
                </td>
                <td className="py-1.5 text-xs text-slate-400">{scoring.cpuRuns[0] !== undefined ? scoring.cpuRuns[0] : '-'}</td>
                <td className="py-1.5 text-xs text-slate-400">{scoring.cpuRuns[1] !== undefined ? scoring.cpuRuns[1] : '-'}</td>
                <td className="py-1.5 text-xs text-slate-400">{scoring.cpuRuns[2] !== undefined ? scoring.cpuRuns[2] : '-'}</td>
                <td className="py-1.5 border-l border-slate-800 text-rose-400 text-sm font-black">{scoring.cpuTotalRuns}</td>
                <td className="py-1.5 text-xs text-slate-400 font-normal">{scoring.cpuTotalHits}</td>
                <td className="py-1.5 text-xs text-slate-500 font-normal">{scoring.cpuTotalErrors}</td>
              </tr>
              {/* Player Row */}
              <tr className={`${currentRole === 'BATTING' && isTop === false ? 'bg-amber-500/5' : ''}`}>
                <td className="py-1.5 text-left font-sans pl-1.5 flex items-center gap-1.5 text-white">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block shadow-[0_0_8px_rgba(245,158,11,0.5)]"></span>
                  <span className="text-white text-xs">PLAYER (ホーム)</span>
                </td>
                <td className="py-1.5 text-xs text-slate-400">{scoring.playerRuns[0] !== undefined ? scoring.playerRuns[0] : '-'}</td>
                <td className="py-1.5 text-xs text-slate-400">{scoring.playerRuns[1] !== undefined ? scoring.playerRuns[1] : '-'}</td>
                <td className="py-1.5 text-xs text-slate-400">{scoring.playerRuns[2] !== undefined ? scoring.playerRuns[2] : '-'}</td>
                <td className="py-1.5 border-l border-slate-800 text-amber-500 text-sm font-black">{scoring.playerTotalRuns}</td>
                <td className="py-1.5 text-xs text-slate-400 font-normal">{scoring.playerTotalHits}</td>
                <td className="py-1.5 text-xs text-slate-500 font-normal">{scoring.playerTotalErrors}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Current Turn Notification Info */}
        <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5 font-medium">
            <Info size={11} className="text-amber-500 shrink-0" />
            <span className="text-slate-400 truncate max-w-[320px] md:max-w-none">3イニング終了時により多くの得点を獲得して勝利を目指します！</span>
          </div>
          <div className="flex gap-2">
            <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-[9px] text-amber-500 font-black font-mono whitespace-nowrap">
              ROLE: {currentRole === 'BATTING' ? '打撃' : '投球'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. SBO & Bases Panel Block */}
      <div className="lg:col-span-4 bg-[#13161c] border border-slate-800 rounded-xl p-3 shadow-[0_4px_24px_rgba(0,0,0,0.6)] grid grid-cols-2 gap-3 items-center">
        
        {/* Left Side: SBO indicators */}
        <div className="flex flex-col gap-1.5 justify-center">
          {/* BALLS indicator */}
          <div className="flex items-center gap-1.5">
            <span className="w-4 text-xs font-mono font-black text-emerald-400">B</span>
            <div className="flex gap-1">
              {ballsArray.map((active, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full border transition-all duration-300 ${
                    active ? 'bg-emerald-500 border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-[#0a0c10] border-slate-800'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* STRIKES indicator */}
          <div className="flex items-center gap-1.5">
            <span className="w-4 text-xs font-mono font-black text-amber-500">S</span>
            <div className="flex gap-1">
              {strikesArray.map((active, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full border transition-all duration-300 ${
                    active ? 'bg-amber-500 border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.6)]' : 'bg-[#0a0c10] border-slate-800'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* OUTS indicator */}
          <div className="flex items-center gap-1.5">
            <span className="w-4 text-xs font-mono font-black text-rose-500">O</span>
            <div className="flex gap-1">
              {outsArray.map((active, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full border transition-all duration-300 ${
                    active ? 'bg-rose-500 border-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.6)]' : 'bg-[#0a0c10] border-slate-800'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: 3D Diamond runner view */}
        <div className="flex flex-col items-center justify-center">
          <div className="relative w-20 h-20 transform rotate-45 border-2 border-slate-800/40 bg-[#0a0c10]/85 rounded-sm">
            {/* 1st Base (Right Corner) */}
            <div
              className={`absolute -right-1 top-1/2 -translate-y-1/2 w-3 h-3 transform rotate-12 transition-all duration-300 border-2 ${
                runners[0]
                  ? 'bg-amber-500 border-amber-400 rotate-45 scale-110 shadow-[0_0_8px_rgba(245,158,11,0.6)]'
                  : 'bg-slate-900 border-slate-800'
              }`}
              title="1塁"
            />
            {/* 2nd Base (Top Corner) */}
            <div
              className={`absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 transform rotate-12 transition-all duration-300 border-2 ${
                runners[1]
                  ? 'bg-amber-500 border-amber-400 rotate-45 scale-110 shadow-[0_0_8px_rgba(245,158,11,0.6)]'
                  : 'bg-slate-900 border-slate-800'
              }`}
              title="2塁"
            />
            {/* 3rd Base (Left Corner) */}
            <div
              className={`absolute -left-1 top-1/2 -translate-y-1/2 w-3 h-3 transform rotate-12 transition-all duration-300 border-2 ${
                runners[2]
                  ? 'bg-amber-500 border-amber-400 rotate-45 scale-110 shadow-[0_0_8px_rgba(245,158,11,0.6)]'
                  : 'bg-slate-900 border-slate-800'
              }`}
              title="3塁"
            />
            {/* Home Base (Bottom Corner) */}
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-4 bg-slate-300 border border-slate-700 rounded-sm hover:scale-105" />

            {/* Inning HUD Text overlay */}
            <div className="absolute inset-0 transform -rotate-45 flex flex-col justify-center items-center">
              <span className="text-xl font-black text-white leading-none tracking-tighter">
                {inning}
              </span>
              <span className="text-[10px] text-amber-500 font-bold mt-0.5 font-mono">
                {isTop ? '表' : '裏'}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
