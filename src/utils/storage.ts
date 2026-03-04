import type { Difficulty, SavedGame, Settings, TimerMode } from '../types';

// Local storage CRUD for saved games and user settings.
const SAVED_GAMES_KEY = 'fancy-chess-saved-games';
const SETTINGS_KEY = 'fancy-chess-settings';
const MAX_GAMES = 50;

const DEFAULT_SETTINGS: Settings = {
  soundEnabled: true,
  lastDifficulty: 'medium',
  lastTimer: '10min',
  cameraAngle: 'white',
};

const isBrowser = (): boolean => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const safeParse = <T>(raw: string | null, fallback: T): T => {
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error('Failed to parse localStorage JSON', error);
    return fallback;
  }
};

const normalizeDifficulty = (value: unknown): Difficulty => {
  return value === 'easy' || value === 'medium' || value === 'hard' || value === 'hell' ? value : 'medium';
};

const normalizeTimer = (value: unknown): TimerMode => {
  return value === '3min' || value === '5min' || value === '10min' || value === 'unlimited' ? value : '10min';
};

export const storage = {
  getSavedGames(): SavedGame[] {
    if (!isBrowser()) {
      return [];
    }

    const parsed = safeParse<SavedGame[]>(window.localStorage.getItem(SAVED_GAMES_KEY), []);
    return Array.isArray(parsed) ? parsed : [];
  },

  saveGame(game: SavedGame): void {
    if (!isBrowser()) {
      return;
    }

    const games = this.getSavedGames();
    const nextGames = [game, ...games].slice(0, MAX_GAMES);
    window.localStorage.setItem(SAVED_GAMES_KEY, JSON.stringify(nextGames));
  },

  deleteSavedGame(id: string): void {
    if (!isBrowser()) {
      return;
    }

    const nextGames = this.getSavedGames().filter((savedGame) => savedGame.id !== id);
    window.localStorage.setItem(SAVED_GAMES_KEY, JSON.stringify(nextGames));
  },

  getSettings(): Settings {
    if (!isBrowser()) {
      return DEFAULT_SETTINGS;
    }

    const parsed = safeParse<Partial<Settings>>(window.localStorage.getItem(SETTINGS_KEY), {});

    return {
      soundEnabled: typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : DEFAULT_SETTINGS.soundEnabled,
      lastDifficulty: normalizeDifficulty(parsed.lastDifficulty),
      lastTimer: normalizeTimer(parsed.lastTimer),
      cameraAngle: parsed.cameraAngle === 'white' || parsed.cameraAngle === 'black' || parsed.cameraAngle === 'top'
        ? parsed.cameraAngle
        : DEFAULT_SETTINGS.cameraAngle,
    };
  },

  updateSettings(partial: Partial<Settings>): void {
    if (!isBrowser()) {
      return;
    }

    const merged = { ...this.getSettings(), ...partial };
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
  },
};
