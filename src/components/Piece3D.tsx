import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Group } from 'three';

import { squareToBoardPosition } from '../utils/chess-helpers';

// Chess piece primitives with smooth movement animation.
interface Piece3DProps {
  square: string;
  type: string;
  color: 'w' | 'b';
}

const pieceColor = (color: 'w' | 'b'): string => (color === 'w' ? '#f8fafc' : '#111827');

const PieceShape = ({ type, color }: { type: string; color: 'w' | 'b' }) => {
  const material = <meshStandardMaterial color={pieceColor(color)} metalness={0.35} roughness={0.45} />;

  switch (type) {
    case 'k':
      return (
        <>
          <mesh position={[0, 0.22, 0]}>{material}<cylinderGeometry args={[0.18, 0.24, 0.44, 24]} /></mesh>
          <mesh position={[0, 0.52, 0]}>{material}<boxGeometry args={[0.14, 0.14, 0.14]} /></mesh>
          <mesh position={[0, 0.67, 0]}>{material}<boxGeometry args={[0.04, 0.22, 0.04]} /></mesh>
        </>
      );
    case 'q':
      return (
        <>
          <mesh position={[0, 0.22, 0]}>{material}<cylinderGeometry args={[0.17, 0.25, 0.44, 24]} /></mesh>
          <mesh position={[0, 0.56, 0]}>{material}<sphereGeometry args={[0.09, 16, 16]} /></mesh>
          <mesh position={[0.1, 0.5, 0]}>{material}<sphereGeometry args={[0.04, 12, 12]} /></mesh>
          <mesh position={[-0.1, 0.5, 0]}>{material}<sphereGeometry args={[0.04, 12, 12]} /></mesh>
        </>
      );
    case 'r':
      return (
        <>
          <mesh position={[0, 0.2, 0]}>{material}<cylinderGeometry args={[0.18, 0.24, 0.4, 20]} /></mesh>
          <mesh position={[0, 0.47, 0]}>{material}<boxGeometry args={[0.28, 0.1, 0.28]} /></mesh>
        </>
      );
    case 'b':
      return (
        <>
          <mesh position={[0, 0.22, 0]}>{material}<cylinderGeometry args={[0.15, 0.23, 0.44, 20]} /></mesh>
          <mesh position={[0, 0.57, 0]}>{material}<coneGeometry args={[0.12, 0.25, 20]} /></mesh>
          <mesh position={[0, 0.7, 0]}>{material}<sphereGeometry args={[0.05, 12, 12]} /></mesh>
        </>
      );
    case 'n':
      return (
        <>
          <mesh position={[0, 0.2, 0]}>{material}<cylinderGeometry args={[0.16, 0.22, 0.4, 20]} /></mesh>
          <mesh position={[0, 0.5, 0]} rotation={[0, 0, -0.2]}>{material}<boxGeometry args={[0.16, 0.32, 0.1]} /></mesh>
          <mesh position={[0.06, 0.62, 0]} rotation={[0, 0, -0.2]}>{material}<coneGeometry args={[0.05, 0.12, 10]} /></mesh>
        </>
      );
    default:
      return (
        <>
          <mesh position={[0, 0.17, 0]}>{material}<cylinderGeometry args={[0.15, 0.22, 0.34, 20]} /></mesh>
          <mesh position={[0, 0.4, 0]}>{material}<sphereGeometry args={[0.1, 14, 14]} /></mesh>
        </>
      );
  }
};

export function Piece3D({ square, type, color }: Piece3DProps) {
  const groupRef = useRef<Group>(null);
  const [targetX, targetZ] = useMemo(() => squareToBoardPosition(square), [square]);

  useFrame((_state, delta) => {
    if (!groupRef.current) {
      return;
    }

    const lerpFactor = Math.min(1, delta * 8);
    groupRef.current.position.x += (targetX - groupRef.current.position.x) * lerpFactor;
    groupRef.current.position.z += (targetZ - groupRef.current.position.z) * lerpFactor;
  });

  return (
    <group ref={groupRef} position={[targetX, 0.02, targetZ]}>
      <PieceShape type={type} color={color} />
    </group>
  );
}
