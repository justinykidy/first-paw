import type { Difficulty, SearchOptions } from '../types';

// Stockfish search presets by game difficulty.
export const DIFFICULTY_CONFIG: Record<Difficulty, SearchOptions & { skillLevel: number }> = {
  easy: { depth: 3, movetime: 500, skillLevel: 1 },
  medium: { depth: 8, movetime: 1500, skillLevel: 10 },
  hard: { depth: 15, movetime: 3000, skillLevel: 18 },
  hell: { depth: 25, movetime: 5000, skillLevel: 20 },
};

export const HINT_CONFIG: SearchOptions & { skillLevel: number } = {
  depth: 20,
  movetime: 2500,
  skillLevel: 20,
};

export const getDifficultyConfig = (difficulty: Difficulty): SearchOptions & { skillLevel: number } => {
  return DIFFICULTY_CONFIG[difficulty];
};
