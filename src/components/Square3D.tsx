import { Text } from '@react-three/drei';

import { squareToBoardPosition, squareToCoords } from '../utils/chess-helpers';

// Single board square mesh with highlight states and optional coordinate labels.
interface Square3DProps {
  square: string;
  onClick: (square: string) => void;
  isSelected?: boolean;
  isValidMove?: boolean;
  isLastMove?: boolean;
  isCheckSquare?: boolean;
}

const baseColor = (square: string): string => {
  const { x, y } = squareToCoords(square);
  return (x + y) % 2 === 0 ? '#e6d3b1' : '#8c5d3d';
};

const highlightColor = (props: Square3DProps): string => {
  if (props.isCheckSquare) {
    return '#dc2626';
  }
  if (props.isSelected) {
    return '#2563eb';
  }
  if (props.isValidMove) {
    return '#10b981';
  }
  if (props.isLastMove) {
    return '#eab308';
  }
  return baseColor(props.square);
};

export function Square3D({ square, onClick, isSelected, isValidMove, isLastMove, isCheckSquare }: Square3DProps) {
  const [x, z] = squareToBoardPosition(square);
  const showFileLabel = square[1] === '1';
  const showRankLabel = square[0] === 'a';

  return (
    <group position={[x, 0, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} onClick={() => onClick(square)}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color={highlightColor({ square, onClick, isSelected, isValidMove, isLastMove, isCheckSquare })} />
      </mesh>

      {showFileLabel ? (
        <Text
          position={[0.35, 0.02, 0.42]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.14}
          color="#111827"
          anchorX="center"
          anchorY="middle"
        >
          {square[0]}
        </Text>
      ) : null}

      {showRankLabel ? (
        <Text
          position={[-0.42, 0.02, -0.35]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.14}
          color="#111827"
          anchorX="center"
          anchorY="middle"
        >
          {square[1]}
        </Text>
      ) : null}
    </group>
  );
}
