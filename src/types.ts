export type PitchType = 'FAST' | 'CURVE' | 'SLIDER' | 'FORK';

export type GamePhase = 'MENU' | 'PLAYING' | 'SUMMARY';

export type PlayState = 
  | 'PITCHER_WINDUP'
  | 'PITCH_FLIGHT'
  | 'SWING_RESULT'
  | 'BALL_FLIGHT'  // Hit ball flying
  | 'RUNNER_ADVANCE'
  | 'INNING_CHANGE'
  | 'TOUCHOUT';

export type Team = 'PLAYER' | 'CPU';

export interface ScoreState {
  playerRuns: number[];
  cpuRuns: number[];
  playerTotalRuns: number;
  cpuTotalRuns: number;
  playerTotalHits: number;
  cpuTotalHits: number;
  playerTotalErrors: number;
  cpuTotalErrors: number;
}

export interface MatchState {
  inning: number; // 1, 2, 3
  isTop: boolean; // true = Top (表), false = Bottom (裏)
  strikes: number; // 0, 1, 2
  balls: number; // 0, 1, 2, 3
  outs: number; // 0, 1, 2
  runners: boolean[]; // [1st Base, 2nd Base, 3rd Base]
  playerScore: number;
  cpuScore: number;
  scoring: ScoreState;
  playerTeam: 'PLAYER' | 'CPU'; // Which team is player (typically Bottom/Home or Top/Away)
  currentRole: 'BATTING' | 'PITCHING';
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface Ball3D {
  pos: Vector3D;
  vel: Vector3D;
  r: number;
  isHit: boolean;
  type?: PitchType;
}

export interface CPULevel {
  id: 'EASY' | 'NORMAL' | 'HARD';
  name: string;
  pitchSpeedMult: number;
  swingAccuracy: number;
  pitchAccuracy: number;
}
