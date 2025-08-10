import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

interface SimpleAvatarProps {
  modelPath?: string;
}

export const SimpleAvatar: React.FC<SimpleAvatarProps> = ({
  modelPath = "/models/krishna.glb"
}) => {
  const group = useRef<THREE.Group>(null);

  try {
    const { scene } = useGLTF(modelPath);

    // Add subtle breathing animation
    useFrame((state) => {
      if (group.current) {
        const time = state.clock.getElapsedTime();
        group.current.position.y = Math.sin(time * 0.5) * 0.02;
      }
    });

    return (
      <group ref={group} dispose={null}>
        <primitive object={scene} scale={1} />
      </group>
    );
  } catch (error) {
    console.error('Error loading avatar:', error);

    // Fallback: Simple colored box
    return (
      <group ref={group}>
        <mesh>
          <boxGeometry args={[1, 2, 0.5]} />
          <meshStandardMaterial color="#8b5cf6" />
        </mesh>
      </group>
    );
  }
};

// Preload the model
try {
  useGLTF.preload("/models/krishna.glb");
} catch (error) {
  console.warn('Could not preload avatar model:', error);
}
