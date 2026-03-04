import type { GameStatus } from '../types';

// Button panel for gameplay actions.
interface GameControlsProps {
  onNewGame: () => void;
  onUndo: () => void;
  onHint: () => void;
  onResign: () => void;
  onSave: () => void;
  hintsRemaining: number;
  canUndo: boolean;
  status: GameStatus;
}

export function GameControls({
  onNewGame,
  onUndo,
  onHint,
  onResign,
  onSave,
  hintsRemaining,
  canUndo,
  status,
}: GameControlsProps) {
  const finished = status === 'checkmate' || status === 'stalemate' || status === 'draw' || status === 'timeout' || status === 'resigned';

  return (
    <section className="space-y-2 rounded-xl border border-slate-700 bg-slate-900/70 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Game Controls</h2>

      <button type="button" onClick={onNewGame} className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium hover:bg-blue-500">
        New Game
      </button>

      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo || finished}
        className="w-full rounded-md bg-slate-700 px-3 py-2 text-sm font-medium hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Undo
      </button>

      <button
        type="button"
        onClick={onHint}
        disabled={hintsRemaining <= 0 || finished}
        className="w-full rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Hint ({hintsRemaining})
      </button>

      <button
        type="button"
        onClick={onSave}
        className="w-full rounded-md bg-indigo-700 px-3 py-2 text-sm font-medium hover:bg-indigo-600"
      >
        Save PGN
      </button>

      <button
        type="button"
        onClick={onResign}
        disabled={finished}
        className="w-full rounded-md bg-rose-700 px-3 py-2 text-sm font-medium hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Resign
      </button>
    </section>
  );
}
