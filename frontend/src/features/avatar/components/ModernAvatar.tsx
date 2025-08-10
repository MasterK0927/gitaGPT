import React, { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useChatStore } from '../../chat/stores/chatStore';

interface ModernAvatarProps {
  modelPath?: string;
}

export const ModernAvatar: React.FC<ModernAvatarProps> = ({
  modelPath = "/models/65e2b637b8a463791b67f732.glb"
}) => {
  const group = useRef<THREE.Group>(null);
  const { scene } = useGLTF(modelPath);

  const { currentMessage, onMessagePlayed, isLoading } = useChatStore();
  const [isPlaying, setIsPlaying] = useState(false);

  // Handle message changes
  useEffect(() => {
    if (currentMessage) {
      // Play audio if available
      if (currentMessage.audio) {
        playAudio(currentMessage.audio);
      }
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  }, [currentMessage]);

  // Play audio function
  const playAudio = async (audioBase64: string) => {
    try {
      const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
      audio.volume = 1.0;

      audio.onended = () => {
        onMessagePlayed();
        setIsPlaying(false);
      };

      await audio.play();
    } catch (error) {
      console.error('Error playing audio:', error);
      // Fallback: mark message as played after a delay
      setTimeout(() => {
        onMessagePlayed();
        setIsPlaying(false);
      }, 3000);
    }
  };

  // Add subtle breathing animation
  useFrame((state) => {
    if (group.current) {
      const time = state.clock.getElapsedTime();
      group.current.position.y = Math.sin(time * 0.5) * 0.02;

      // Add slight rotation when speaking
      if (isPlaying) {
        group.current.rotation.y = Math.sin(time * 2) * 0.05;
      } else {
        group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, 0, 0.1);
      }
    }
  });

  return (
    <group ref={group} dispose={null}>
      <primitive object={scene} scale={1} />
    </group>
  );
};

// Preload the model
useGLTF.preload("/models/65e2b637b8a463791b67f732.glb");
