import React, { useState } from 'react';
import { GamePhase, MatchState, PlayState, ScoreState, CPULevel } from './types';
import StadiumCanvas from './components/StadiumCanvas';
import Scoreboard from './components/Scoreboard';
import GameSummary from './components/GameSummary';
import { gameAudio } from './utils/audio';
import { Volume2, VolumeX, Swords, Award, Sparkles, RefreshCw, Trophy, Settings2, Info } from 'lucide-react';

const CPU_DIFFICULTIES: CPULevel[] = [
  { id: 'EASY', name: 'イージー (EASY)', pitchSpeedMult: 0.8, swingAccuracy: 0.45, pitchAccuracy: 0.5 },
  { id: 'NORMAL', name: 'ノーマル (NORMAL)', pitchSpeedMult: 1.1, swingAccuracy: 0.65, pitchAccuracy: 0.75 },
  { id: 'HARD', name: 'プロ野球 (HARD)', pitchSpeedMult: 1.4, swingAccuracy: 0.85, pitchAccuracy: 0.92 }
];

const initialScoreState = (): ScoreState => ({
  playerRuns: [],
  cpuRuns: [],
  playerTotalRuns: 0,
  cpuTotalRuns: 0,
  playerTotalHits: 0,
  cpuTotalHits: 0,
  playerTotalErrors: 0,
  cpuTotalErrors: 0,
});

const initialMatchState = (startingRole: 'BATTING' | 'PITCHING'): MatchState => ({
  inning: 1,
  isTop: true, // true = Top, false = Bottom
  strikes: 0,
  balls: 0,
  outs: 0,
  runners: [false, false, false], // 1st, 2nd, 3rd bases
  playerScore: 0,
  cpuScore: 0,
  scoring: initialScoreState(),
  playerTeam: startingRole === 'BATTING' ? 'PLAYER' : 'CPU', // Batting first = Away/PLAYER, Pitching first = Home/PLAYER later
  currentRole: startingRole,
});

export default function App() {
  const [phase, setPhase] = useState<GamePhase>('MENU');
  const [playState, setPlayState] = useState<PlayState>('PITCHER_WINDUP');
  const [match, setMatch] = useState<MatchState>(initialMatchState('BATTING'));
  const [selectedDifficulty, setSelectedDifficulty] = useState<CPULevel>(CPU_DIFFICULTIES[1]);
  const [startRoleSelection, setStartRoleSelection] = useState<'BATTING' | 'PITCHING'>('BATTING');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [narratorFeed, setNarratorFeed] = useState<string>('プレイ開始！');

  // Helper: Walk logic (ランナー押し出し / 四球)
  const executeWalk = (currentMatch: MatchState) => {
    let newRunners = [...currentMatch.runners];
    let runsScored = 0;
    
    // Walk advancement rules
    if (!newRunners[0]) {
      // 1st base empty
      newRunners[0] = true;
    } else if (!newRunners[1]) {
      // 1st and 2nd base occupied, 2nd gets filled
      newRunners[1] = true;
    } else if (!newRunners[2]) {
      // 1st, 2nd and 3rd occupied, 3rd gets filled
      newRunners[2] = true;
    } else {
      // All paths filled: Force-play on home plate! Run scored!
      runsScored = 1;
    }

    const { isTop, scoring } = currentMatch;
    let nextScoring = { ...scoring };

    if (runsScored > 0) {
      if (isTop) {
        // Top batting team gets point
        const activeIdx = currentMatch.inning - 1;
        const currentInningRuns = isTop ? (nextScoring.cpuRuns[activeIdx] ?? 0) : (nextScoring.playerRuns[activeIdx] ?? 0);
        
        if (currentMatch.currentRole === 'BATTING') {
          nextScoring.playerTotalRuns += 1;
          const updatedPlayerRuns = [...nextScoring.playerRuns];
          updatedPlayerRuns[activeIdx] = (updatedPlayerRuns[activeIdx] ?? 0) + 1;
          nextScoring.playerRuns = updatedPlayerRuns;
        } else {
          nextScoring.cpuTotalRuns += 1;
          const updatedCpuRuns = [...nextScoring.cpuRuns];
          updatedCpuRuns[activeIdx] = (updatedCpuRuns[activeIdx] ?? 0) + 1;
          nextScoring.cpuRuns = updatedCpuRuns;
        }
      } else {
        // Bottom batting team gets point
        const activeIdx = currentMatch.inning - 1;
        if (currentMatch.currentRole === 'BATTING') {
          nextScoring.playerTotalRuns += 1;
          const updatedPlayerRuns = [...nextScoring.playerRuns];
          updatedPlayerRuns[activeIdx] = (updatedPlayerRuns[activeIdx] ?? 0) + 1;
          nextScoring.playerRuns = updatedPlayerRuns;
        } else {
          nextScoring.cpuTotalRuns += 1;
          const updatedCpuRuns = [...nextScoring.cpuRuns];
          updatedCpuRuns[activeIdx] = (updatedCpuRuns[activeIdx] ?? 0) + 1;
          nextScoring.cpuRuns = updatedCpuRuns;
        }
      }
    }

    setMatch({
      ...currentMatch,
      balls: 0,
      strikes: 0,
      runners: newRunners,
      scoring: nextScoring,
    });
    setPlayState('PITCHER_WINDUP');
  };

  // Helper: Inning switch logic (3 Outs transition)
  const advanceHalfInning = (currentMatch: MatchState) => {
    gameAudio.playInningSting();
    const isNextBottom = currentMatch.isTop; // if we were on Top (isTop=true), we now go to Bottom (isTop=false)
    
    // Check if match ends (Bottom of 3rd inning finishes)
    if (!isNextBottom && currentMatch.inning === 3) {
      // 3rd Inning bottom ends. Game complete!
      setPhase('SUMMARY');
      return;
    }

    let nextInning = currentMatch.inning;
    if (!isNextBottom) {
      // transition from Bottom back to Top of next inning
      nextInning += 1;
    }

    // Toggle current play role
    const nextRole = currentMatch.currentRole === 'BATTING' ? 'PITCHING' : 'BATTING';
    
    setNarratorFeed(
      nextInning + '回' + (isNextBottom ? '裏 (後攻)' : '表 (先行)') + 'の攻撃に移ります。役割交代：' + 
      (nextRole === 'BATTING' ? 'バッティング開始！' : 'ピッチャー投球開始！')
    );

    setMatch({
      ...currentMatch,
      inning: nextInning,
      isTop: isNextBottom,
      strikes: 0,
      balls: 0,
      outs: 0,
      runners: [false, false, false], // Clear bases on side switch
      currentRole: nextRole,
    });
    setPlayState('PITCHER_WINDUP');
  };

  // Handle Play outcome from Pitch/Bat
  const handlePlayResult = (result: {
    type: 'STRIKE' | 'BALL' | 'OUT' | 'HIT' | 'HOMERUN' | 'FOUL' | 'SINGLE' | 'DOUBLE' | 'TRIPLE';
    detail?: string;
  }) => {
    setMatch((prev) => {
      let { strikes, balls, outs, runners, scoring, inning, isTop, currentRole } = prev;
      let nextScoring = { ...scoring };
      let newNarratorText = '';

      const activeIdx = inning - 1;

      // Handle Strike
      if (result.type === 'STRIKE') {
        const nextStrikes = strikes + 1;
        if (nextStrikes >= 3) {
          // STRIKEOUT!
          const nextOuts = outs + 1;
          gameAudio.playOutCall();
          newNarratorText = currentRole === 'BATTING' ? '三振アウト！落ち着いていきましょう。' : '見事な三振アウト！三球勝負！';
          
          if (nextOuts >= 3) {
            setTimeout(() => advanceHalfInning({ ...prev, strikes: 0, balls: 0, outs: nextOuts }), 1000);
            return { ...prev, strikes: 0, balls: 0, outs: nextOuts };
          } else {
            setPlayState('PITCHER_WINDUP');
            return { ...prev, strikes: 0, balls: 0, outs: nextOuts };
          }
        } else {
          setPlayState('PITCHER_WINDUP');
          return { ...prev, strikes: nextStrikes };
        }
      }

      // Handle Ball
      if (result.type === 'BALL') {
        const nextBalls = balls + 1;
        if (nextBalls >= 4) {
          newNarratorText = 'フォアボール！ランナー出塁。';
          setNarratorFeed(newNarratorText);
          setTimeout(() => executeWalk({ ...prev, balls: nextBalls }), 1000);
          return { ...prev, balls: nextBalls };
        } else {
          setPlayState('PITCHER_WINDUP');
          return { ...prev, balls: nextBalls };
        }
      }

      // Handle Foul
      if (result.type === 'FOUL') {
        newNarratorText = 'ファウルボール。ストライクカウント追加等';
        const nextStrikes = strikes < 2 ? strikes + 1 : strikes;
        setPlayState('PITCHER_WINDUP');
        return { ...prev, strikes: nextStrikes };
      }

      // Handle Out (Flyout, Catchout, etc.)
      if (result.type === 'OUT') {
        const nextOuts = outs + 1;
        newNarratorText = 'アウト！次のバッターに期待しましょう！';
        
        if (nextOuts >= 3) {
          setTimeout(() => advanceHalfInning({ ...prev, strikes: 0, balls: 0, outs: nextOuts }), 1000);
          return { ...prev, strikes: 0, balls: 0, outs: nextOuts };
        } else {
          setPlayState('PITCHER_WINDUP');
          return { ...prev, strikes: 0, balls: 0, outs: nextOuts };
        }
      }

      // Handle Hits (Single, Double, Triple, Home Run)
      if (['HIT', 'SINGLE', 'DOUBLE', 'TRIPLE', 'HOMERUN'].includes(result.type)) {
        let runsScored = 0;
        let nextRunners = [...runners];

        // Increment Hits Count
        if (currentRole === 'BATTING') {
          nextScoring.playerTotalHits += 1;
        } else {
          nextScoring.cpuTotalHits += 1;
        }

        if (result.type === 'HOMERUN') {
          // HOME RUN! All runners plus batter scores
          const activeRunnersCount = nextRunners.filter(r => r).length;
          runsScored = activeRunnersCount + 1;
          nextRunners = [false, false, false]; // clear bases
          newNarratorText = currentRole === 'BATTING' ? 'お見事！満塁弾レベルの特大ホームラン！' : '痛恨の一発！CPUがスタンドに運びました。';

        } else if (result.type === 'TRIPLE') {
          // Triple: All runners on base score
          runsScored = nextRunners.filter(r => r).length;
          nextRunners = [false, false, true]; // Batter on 3rd
          newNarratorText = 'スリーベースヒット！ランナー一掃の大ヒット！';

        } else if (result.type === 'DOUBLE') {
          // Double: runners on 2nd and 3rd score. Runner on 1st goes to 3rd.
          if (nextRunners[2]) { runsScored++; nextRunners[2] = false; } // 3rd base runner
          if (nextRunners[1]) { runsScored++; nextRunners[1] = false; } // 2nd base runner
          if (nextRunners[0]) { nextRunners[2] = true; nextRunners[0] = false; } // 1st base to 3rd
          nextRunners[1] = true; // Batter on 2nd
          newNarratorText = 'ツーベースヒット！チャンスが広がります。';

        } else {
          // Single / Default HIT: runner on 3rd scores, 2nd to 3rd, 1st to 2nd. Batter to 1st.
          if (nextRunners[2]) { runsScored++; nextRunners[2] = false; }
          if (nextRunners[1]) { nextRunners[2] = true; nextRunners[1] = false; }
          if (nextRunners[0]) { nextRunners[1] = true; nextRunners[0] = false; }
          nextRunners[0] = true; // Batter on 1st
          newNarratorText = 'センター前ヒット！ナイスバッティング！';
        }

        // Add Runs to proper team score state
        if (runsScored > 0) {
          if (currentRole === 'BATTING') {
            nextScoring.playerTotalRuns += runsScored;
            const updatedPlayerRuns = [...nextScoring.playerRuns];
            updatedPlayerRuns[activeIdx] = (updatedPlayerRuns[activeIdx] ?? 0) + runsScored;
            nextScoring.playerRuns = updatedPlayerRuns;
          } else {
            nextScoring.cpuTotalRuns += runsScored;
            const updatedCpuRuns = [...nextScoring.cpuRuns];
            updatedCpuRuns[activeIdx] = (updatedCpuRuns[activeIdx] ?? 0) + runsScored;
            nextScoring.cpuRuns = updatedCpuRuns;
          }
          
          gameAudio.playCheer();
          newNarratorText = `ヒットで ${runsScored}点 獲得！得点圏大盛り上がり！`;
        }

        setNarratorFeed(newNarratorText);
        setPlayState('PITCHER_WINDUP');

        // Check Sayonara Say goodbye ending trigger:
        // If bottom of 3rd inning, and Home player already beats CPU runs, we can end right away
        if (!isTop && inning === 3 && nextScoring.playerTotalRuns > nextScoring.cpuTotalRuns) {
          setTimeout(() => {
            setPhase('SUMMARY');
          }, 1500);
        }

        return {
          ...prev,
          strikes: 0,
          balls: 0,
          runners: nextRunners,
          scoring: nextScoring,
        };
      }

      setNarratorFeed(newNarratorText);
      return prev;
    });
  };

  const handleStartGame = () => {
    // initialize game play
    const freshMatch = initialMatchState(startRoleSelection);
    setMatch(freshMatch);
    setPhase('PLAYING');
    setPlayState('PITCHER_WINDUP');
    setNarratorFeed('プレイボール！3イニング対戦ゲーム開始！');
    gameAudio.playInningSting();
  };

  return (
    <div className="min-h-screen bg-[#0a0c10] text-slate-100 flex flex-col justify-between py-2 md:py-3.5 px-4 md:px-8 font-sans transition-all selection:bg-amber-500/30 selection:text-white">
      {/* Upper Brand Nav Rail */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between pb-2 border-b border-slate-800 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-gradient-to-br from-amber-500 to-amber-700 rounded-lg shadow-lg shadow-amber-500/20 text-slate-950">
            <Swords size={18} className="stroke-[2.5]" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 font-mono tracking-widest leading-none block">3D BASEBALL PRO</span>
            <h1 className="text-lg font-black tracking-tight text-white leading-none mt-0.5">
              スタジアム・<span className="text-amber-500">ベースボール</span>
            </h1>
          </div>
        </div>

        {/* Difficulty Badge Display in play */}
        {phase === 'PLAYING' && (
          <div className="px-2.5 py-0.5 bg-[#1a1c24] border border-slate-800 rounded-full text-[11px] font-semibold text-slate-300 flex items-center gap-1.5 shadow-sm">
            <Sparkles size={11} className="text-amber-500 animate-pulse" />
            <span>対戦難易度: <span className="text-yellow-400">{selectedDifficulty.name}</span></span>
          </div>
        )}
      </header>

      {/* Main Container Workspace */}
      <main className="max-w-6xl w-full mx-auto flex-grow flex flex-col justify-center gap-4">

        {/* Phase 1: START WELCOME MENU */}
        {phase === 'MENU' && (
          <div className="max-w-2xl w-full mx-auto bg-[#1a1c24] border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl text-center space-y-8 animate-fade-in">
            <div className="space-y-3">
              <div className="inline-block bg-amber-500/10 text-amber-500 px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase border border-amber-500/20">
                PRO Retro-Arcade Console
              </div>
              <h2 className="text-4xl font-extrabold tracking-tight text-white">
                野球スタジアム<span className="text-amber-500">野球ゲーム</span>
              </h2>
              <p className="text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
                CPUと戦う3イニング制の本格的野球ゲーム！バッターとしての特大ホームラン、ピッチャーとしての魔球変化球、両方の魅力が楽しめます。
              </p>
            </div>

            {/* Config Box */}
            <div className="bg-[#0c0e14] p-6 rounded-xl border border-slate-800 space-y-6 text-left">
              {/* CPU Selection */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-400 flex items-center gap-1.5 uppercase font-mono">
                  <Settings2 size={13} className="text-amber-500" /> CPU対戦難易度の設定
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {CPU_DIFFICULTIES.map((diff) => (
                    <button
                      key={diff.id}
                      onClick={() => setSelectedDifficulty(diff)}
                      className={`py-3 px-3 rounded-lg border text-xs font-bold text-center transition-all cursor-pointer ${
                        selectedDifficulty.id === diff.id
                          ? 'bg-amber-500/10 border-amber-500 text-amber-500 shadow-lg shadow-amber-500/5'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                      }`}
                    >
                      {diff.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pitch or Bat Selection first */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-400 flex items-center gap-1.5 uppercase font-mono">
                  <Swords size={13} className="text-amber-500" /> プレイ順の決定 (先行・後攻)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setStartRoleSelection('BATTING')}
                    className={`p-3 rounded-lg border text-xs font-bold text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                      startRoleSelection === 'BATTING'
                        ? 'bg-amber-500/10 border-amber-500 text-amber-500 shadow-md shadow-amber-500/5'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-base font-black">1回表 先行バッティング</span>
                    <span className="text-[10px] text-slate-500 normal-case">最初はバッティング、裏にまわってピッチング</span>
                  </button>
                  
                  <button
                    onClick={() => setStartRoleSelection('PITCHING')}
                    className={`p-3 rounded-lg border text-xs font-bold text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                      startRoleSelection === 'PITCHING'
                        ? 'bg-amber-500/10 border-amber-500 text-amber-500 shadow-md shadow-amber-500/5'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-base font-black">1回表 後攻ピッチャー</span>
                    <span className="text-[10px] text-slate-500 normal-case">最初は魔球ピッチング、裏にまわってバッティング</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Start Button */}
            <button
              onClick={handleStartGame}
              className="w-full bg-gradient-to-r from-amber-600 to-amber-500 text-slate-950 hover:from-amber-500 hover:to-amber-400 hover:shadow-xl hover:shadow-amber-500/15 py-4 px-6 rounded-xl font-black text-sm tracking-widest uppercase flex items-center justify-center gap-2 group transition-all transform active:scale-[0.99] cursor-pointer"
              id="start-match-btn"
            >
              試合を開始する (PLAY BALL)
              <span className="text-xs px-2 py-0.5 rounded bg-slate-950 text-amber-500 font-mono font-black group-hover:scale-105 transition-all">3 INNING</span>
            </button>

            {/* Instruction quick help list */}
            <div className="pt-2 text-left space-y-2 border-t border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5 uppercase font-mono">
                <Info size={12} className="text-amber-500" /> 簡単プレイマニュアル
              </span>
              <ul className="text-[11px] text-slate-500 list-disc pl-4 space-y-1">
                <li>バッティング時：マウス（または矢印キー）でバットカーソルを動かし、クリック（またはスペースキー）でタイミングよくスイング！</li>
                <li>ピッチング時：球種（ストレート・カーブ・スライダー・フォーク）を選び、画面クリックでコースを狙って投げ込みましょう。</li>
                <li>3イニング経過すると自動で試合終了となり、最終スコアと安打数による勝敗が判定されます。</li>
              </ul>
            </div>
          </div>
        )}

        {/* Phase 2: ACTIVE MATCH PLAYING IN STADIUM */}
        {phase === 'PLAYING' && (
          <div className="space-y-4 animate-fade-in">
            {/* Retro LED Scoreboard at Top */}
            <Scoreboard match={match} />

            {/* 3D Stadium Field Action Canvas Area */}
            <StadiumCanvas
              match={match}
              onPlayResult={handlePlayResult}
              cpuLevel={selectedDifficulty}
              playState={playState}
              setPlayState={setPlayState}
              isMuted={isMuted}
              setIsMuted={setIsMuted}
            />

            {/* Live Stadium Commentary Box */}
            <div className="p-2.5 bg-black/40 border border-slate-800 rounded-xl flex items-center gap-3">
              <span className="px-2 py-0.5 bg-red-600 rounded text-[11px] font-bold font-mono text-white shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-pulse">LIVE</span>
              <p className="text-xs text-slate-300 font-medium">
                {narratorFeed ? narratorFeed : 'スタジアム熱戦中！バットとボールのタイミングを合わせよう。'}
              </p>
            </div>
          </div>
        )}

        {/* Phase 3: SUMMARY END REPORT CARD */}
        {phase === 'SUMMARY' && (
          <GameSummary
            match={match}
            onRestart={() => setPhase('MENU')}
          />
        )}

      </main>

      {/* Retro aesthetic footnote footer */}
      <footer className="max-w-6xl w-full mx-auto text-center pt-3 border-t border-slate-800 text-[10px] text-slate-600 font-mono tracking-wider flex flex-col md:flex-row justify-between items-center gap-2 mt-2">
        <span>© 2026 STADIUM BASEBALL PRO. WORKSPACE EDITION.</span>
        <span>CRAFTED WITH REACT & PERSPECTIVE 3D ENGINE</span>
      </footer>
    </div>
  );
}
