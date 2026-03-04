import { formatTimeMs } from '../utils/chess-helpers';

// Displays player and AI remaining clocks.
interface TimerProps {
  playerTimeMs: number;
  aiTimeMs: number;
}

const displayTime = (ms: number): string => {
  if (!Number.isFinite(ms)) {
    return '∞';
  }
  return formatTimeMs(ms);
};

export function Timer({ playerTimeMs, aiTimeMs }: TimerProps) {
  return (
    <section className="space-y-2 rounded-xl border border-slate-700 bg-slate-900/70 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Timer</h2>
      <p className="text-sm">Player: <span className="font-semibold">{displayTime(playerTimeMs)}</span></p>
      <p className="text-sm">AI: <span className="font-semibold">{displayTime(aiTimeMs)}</span></p>
    </section>
  );
}
