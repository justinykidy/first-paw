import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Chess } from 'chess.js';
import { useMemo } from 'react';

import { HintArrow3D } from './HintArrow3D';
import { Piece3D } from './Piece3D';
import { Square3D } from './Square3D';
import { fenToPieces } from '../utils/chess-helpers';

// 3D board view composed of 64 squares and dynamic chess pieces.
interface Board3DProps {
  fen: string;
  selectedSquare: string | null;
  validMoves: string[];
  onSquareClick: (square: string) => void;
  lastMove: { from: string; to: string } | null;
  cameraAngle?: 'white' | 'black' | 'top';
  hint?: { from: string; to: string } | null;
}

const allSquares = (): string[] => {
  const files = 'abcdefgh';
  const squares: string[] = [];

  for (let rank = 1; rank <= 8; rank += 1) {
    for (let file = 0; file < files.length; file += 1) {
      squares.push(`${files[file]}${rank}`);
    }
  }

  return squares;
};

const cameraPosition = (angle: 'white' | 'black' | 'top'): [number, number, number] => {
  if (angle === 'black') {
    return [0, 7.5, -8.5];
  }
  if (angle === 'top') {
    return [0, 12, 0.1];
  }
  return [0, 7.5, 8.5];
};

const findCheckedKingSquare = (fen: string): string | null => {
  const chess = new Chess(fen);
  if (!chess.inCheck()) {
    return null;
  }

  const sideToMove = chess.turn();
  const files = 'abcdefgh';

  for (let rank = 1; rank <= 8; rank += 1) {
    for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
      const square = `${files[fileIndex]}${rank}`;
      const piece = chess.get(square);
      if (piece?.type === 'k' && piece.color === sideToMove) {
        return square;
      }
    }
  }

  return null;
};

const SQUARES = allSquares();

export function Board3D({
  fen,
  selectedSquare,
  validMoves,
  onSquareClick,
  lastMove,
  cameraAngle = 'white',
  hint,
}: Board3DProps) {
  const pieces = useMemo(() => fenToPieces(fen), [fen]);
  const checkedKingSquare = useMemo(() => findCheckedKingSquare(fen), [fen]);

  return (
    <div className="h-[56vh] min-h-[360px] w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-900/50 sm:h-[62vh]">
      <Canvas camera={{ position: cameraPosition(cameraAngle), fov: 42 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[6, 12, 8]} intensity={0.9} />

        <group>
          <mesh position={[0, -0.03, 0]}>
            <boxGeometry args={[8.7, 0.1, 8.7]} />
            <meshStandardMaterial color="#374151" />
          </mesh>

          {SQUARES.map((square) => (
            <Square3D
              key={square}
              square={square}
              onClick={onSquareClick}
              isSelected={selectedSquare === square}
              isValidMove={validMoves.includes(square)}
              isLastMove={lastMove?.from === square || lastMove?.to === square}
              isCheckSquare={checkedKingSquare === square}
            />
          ))}

          {pieces.map((piece) => (
            <Piece3D key={`${piece.square}-${piece.type}-${piece.color}`} square={piece.square} type={piece.type} color={piece.color} />
          ))}

          {hint ? <HintArrow3D from={hint.from} to={hint.to} /> : null}
        </group>

        <OrbitControls enablePan={false} minDistance={7} maxDistance={18} maxPolarAngle={Math.PI / 2.02} />
      </Canvas>
    </div>
  );
}
