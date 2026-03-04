import type { Chess } from 'chess.js';

// Shared type definitions for Fancy Chess state and persistence.
export type Difficulty = 'easy' | 'medium' | 'hard' | 'hell';
export type TimerMode = '3min' | '5min' | '10min' | 'unlimited';
export type GameStatus = 'idle' | 'playing' | 'check' | 'checkmate' | 'stalemate' | 'draw' | 'timeout';

export interface HintData {
  from: string;
  to: string;
}

export interface SavedGame {
  id: string;
  pgn: string;
  date: string;
  difficulty: Difficulty;
  result: string;
  playerColor: 'w' | 'b';
}

export interface Settings {
  soundEnabled: boolean;
  lastDifficulty: Difficulty;
  lastTimer: TimerMode;
  cameraAngle: 'white' | 'black' | 'top';
}

export interface SearchOptions {
  depth?: number;
  movetime?: number;
  skillLevel?: number;
}

export interface MoveDescriptor {
  from: string;
  to: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
}

export interface BoardPiece {
  square: string;
  type: string;
  color: 'w' | 'b';
}

export interface GameState {
  chess: Chess;
  playerColor: 'w' | 'b';
  difficulty: Difficulty;
  timerMode: TimerMode;
  playerTimeMs: number;
  aiTimeMs: number;
  hintsRemaining: number;
  currentHint: HintData | null;
  moveHistory: string[];
  status: GameStatus;
  selectedSquare: string | null;
  validMoves: string[];
  lastMove: { from: string; to: string } | null;
  promotionPending: { from: string; to: string } | null;
}
