import type { BoardPiece } from '../types';

// Pure helpers for square conversion and FEN parsing.
const FILES = 'abcdefgh';

export const squareToCoords = (square: string): { x: number; y: number } => {
  const file = FILES.indexOf(square[0] ?? '');
  const rank = Number.parseInt(square[1] ?? '0', 10) - 1;

  return { x: file, y: rank };
};

export const coordsToSquare = (x: number, y: number): string => {
  return `${FILES[x]}${y + 1}`;
};

export const squareToBoardPosition = (square: string): [number, number] => {
  const { x, y } = squareToCoords(square);
  return [x - 3.5, y - 3.5];
};

export const boardPositionToSquare = (x: number, z: number): string => {
  const file = Math.max(0, Math.min(7, Math.round(x + 3.5)));
  const rank = Math.max(0, Math.min(7, Math.round(z + 3.5)));
  return coordsToSquare(file, rank);
};

export const fenToPieces = (fen: string): BoardPiece[] => {
  const board = fen.split(' ')[0] ?? '';
  const rows = board.split('/');
  const pieces: BoardPiece[] = [];

  rows.forEach((row, rowIndex) => {
    let fileIndex = 0;
    for (const char of row) {
      const gap = Number.parseInt(char, 10);
      if (Number.isFinite(gap)) {
        fileIndex += gap;
        continue;
      }

      const rank = 8 - rowIndex;
      const square = `${FILES[fileIndex]}${rank}`;
      const isWhite = char === char.toUpperCase();
      pieces.push({
        square,
        type: char.toLowerCase(),
        color: isWhite ? 'w' : 'b',
      });
      fileIndex += 1;
    }
  });

  return pieces;
};

export const formatTimeMs = (valueMs: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(valueMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};
