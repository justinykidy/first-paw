import type { Chess } from 'chess.js';

import type { GameStatus } from '../types';

// Read-only game status panel including turn and captured pieces.
interface GameInfoProps {
  chess: Chess;
  status: GameStatus;
  playerColor: 'w' | 'b';
}

const labels: Record<GameStatus, string> = {
  idle: 'Idle',
  playing: 'Playing',
  check: 'Check',
  checkmate: 'Checkmate',
  stalemate: 'Stalemate',
  draw: 'Draw',
  timeout: 'Timeout',
};

const initialCounts: Record<'w' | 'b', Record<string, number>> = {
  w: { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 },
  b: { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 },
};

const pieceNames: Record<string, string> = {
  p: 'Pawn',
  n: 'Knight',
  b: 'Bishop',
  r: 'Rook',
  q: 'Queen',
  k: 'King',
};

const countCaptured = (chess: Chess): string[] => {
  const counts: Record<'w' | 'b', Record<string, number>> = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
  };

  chess.board().forEach((row) => {
    row.forEach((piece) => {
      if (piece) {
        counts[piece.color][piece.type] += 1;
      }
    });
  });

  const captured: string[] = [];

  (['w', 'b'] as const).forEach((color) => {
    (['p', 'n', 'b', 'r', 'q'] as const).forEach((type) => {
      const diff = initialCounts[color][type] - counts[color][type];
      if (diff > 0) {
        captured.push(`${color === 'w' ? 'White' : 'Black'} ${pieceNames[type]} x${diff}`);
      }
    });
  });

  return captured;
};

export function GameInfo({ chess, status, playerColor }: GameInfoProps) {
  const turn = chess.turn() === 'w' ? 'White' : 'Black';
  const captured = countCaptured(chess);

  return (
    <section className="space-y-2 rounded-xl border border-slate-700 bg-slate-900/70 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Game Info</h2>
      <p className="text-sm text-slate-100">Status: <span className="font-semibold">{labels[status]}</span></p>
      <p className="text-sm text-slate-100">Turn: <span className="font-semibold">{turn}</span></p>
      <p className="text-sm text-slate-100">You play: <span className="font-semibold">{playerColor === 'w' ? 'White' : 'Black'}</span></p>

      <div>
        <p className="text-sm text-slate-200">Captured:</p>
        <ul className="mt-1 space-y-1 text-xs text-slate-300">
          {captured.length === 0 ? <li>None</li> : captured.map((line) => <li key={line}>{line}</li>)}
        </ul>
      </div>
    </section>
  );
}
