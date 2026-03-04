import { useState } from 'react';

import type { Difficulty, TimerMode } from '../types';

// Start game modal for difficulty, timer, and side selection.
interface NewGameModalProps {
  open: boolean;
  defaults: { difficulty: Difficulty; timer: TimerMode; playerColor: 'w' | 'b' };
  onStart: (config: { difficulty: Difficulty; timer: TimerMode; playerColor: 'w' | 'b' }) => void;
  onClose: () => void;
}

export function NewGameModal({ open, defaults, onStart, onClose }: NewGameModalProps) {
  const [difficulty, setDifficulty] = useState<Difficulty>(defaults.difficulty);
  const [timer, setTimer] = useState<TimerMode>(defaults.timer);
  const [playerColor, setPlayerColor] = useState<'w' | 'b'>(defaults.playerColor);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-600 bg-slate-900 p-4">
        <h2 className="text-lg font-semibold">Start New Game</h2>

        <label className="mt-3 block text-sm text-slate-200">
          Difficulty
          <select
            className="mt-1 w-full rounded-md border border-slate-600 bg-slate-800 px-2 py-2"
            value={difficulty}
            onChange={(event) => setDifficulty(event.target.value as Difficulty)}
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
            <option value="hell">Hell</option>
          </select>
        </label>

        <label className="mt-3 block text-sm text-slate-200">
          Timer
          <select
            className="mt-1 w-full rounded-md border border-slate-600 bg-slate-800 px-2 py-2"
            value={timer}
            onChange={(event) => setTimer(event.target.value as TimerMode)}
          >
            <option value="3min">3 minutes</option>
            <option value="5min">5 minutes</option>
            <option value="10min">10 minutes</option>
            <option value="unlimited">Unlimited</option>
          </select>
        </label>

        <label className="mt-3 block text-sm text-slate-200">
          Play as
          <select
            className="mt-1 w-full rounded-md border border-slate-600 bg-slate-800 px-2 py-2"
            value={playerColor}
            onChange={(event) => setPlayerColor(event.target.value as 'w' | 'b')}
          >
            <option value="w">White</option>
            <option value="b">Black</option>
          </select>
        </label>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-md bg-blue-600 px-3 py-2 font-medium hover:bg-blue-500"
            onClick={() => onStart({ difficulty, timer, playerColor })}
          >
            Start
          </button>
          <button type="button" className="rounded-md bg-slate-700 px-3 py-2 hover:bg-slate-600" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
