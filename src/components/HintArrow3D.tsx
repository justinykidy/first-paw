import { Line } from '@react-three/drei';
import { useMemo } from 'react';
import type { Vector3Tuple } from 'three';

import { squareToBoardPosition } from '../utils/chess-helpers';

// Curved 3D line showing hint move from square A to B.
interface HintArrow3DProps {
  from: string;
  to: string;
}

export function HintArrow3D({ from, to }: HintArrow3DProps) {
  const points = useMemo(() => {
    const [fromX, fromZ] = squareToBoardPosition(from);
    const [toX, toZ] = squareToBoardPosition(to);

    const midX = (fromX + toX) / 2;
    const midZ = (fromZ + toZ) / 2;

    return [
      [fromX, 0.35, fromZ],
      [midX, 0.9, midZ],
      [toX, 0.35, toZ],
    ] as Vector3Tuple[];
  }, [from, to]);

  return <Line points={points} color="#22c55e" lineWidth={3} transparent opacity={0.9} />;
}
