import React, { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { useChatStore } from '../../chat/stores/chatStore';

interface KrishnaAvatarProps {
  modelPath?: string;
}

export const KrishnaAvatar: React.FC<KrishnaAvatarProps> = ({ 
  modelPath = "/models/krishna.glb" 
}) => {
  const group = useRef<THREE.Group>(null);
  const { currentMessage, onMessagePlayed, isLoading } = useChatStore();
  const [isPlaying, setIsPlaying] = useState(false);
  
  try {
    const { scene, animations } = useGLTF(modelPath);
    const { actions, mixer } = useAnimations(animations, group);
    
    // Available animations for Krishna model
    const availableAnimations = Object.keys(actions);

    // Handle message changes
    useEffect(() => {
      if (currentMessage) {
        // Play audio if available
        if (currentMessage.audio) {
          playAudio(currentMessage.audio);
        }
        
        // Set animation based on message or default to talking
        const animationName = currentMessage.animation || 'Talking' || availableAnimations[0];
        if (actions[animationName]) {
          // Stop all other animations
          Object.values(actions).forEach((action: any) => {
            if (action !== actions[animationName]) {
              action.fadeOut(0.5);
            }
          });
          
          // Play the selected animation
          actions[animationName].reset().fadeIn(0.5).play();
        }
        
        setIsPlaying(true);
      } else {
        // Reset to idle animation
        const idleAnimation = 'Idle' || availableAnimations[0];
        if (actions[idleAnimation]) {
          Object.values(actions).forEach((action: any) => {
            if (action !== actions[idleAnimation]) {
              action.fadeOut(0.5);
            }
          });
          actions[idleAnimation].reset().fadeIn(0.5).play();
        }
        setIsPlaying(false);
      }
    }, [currentMessage, actions, availableAnimations]);

    // Handle loading state
    useEffect(() => {
      if (isLoading) {
        const thinkingAnimation = 'Thinking' || availableAnimations[0];
        if (actions[thinkingAnimation]) {
          Object.values(actions).forEach((action: any) => {
            if (action !== actions[thinkingAnimation]) {
              action.fadeOut(0.5);
            }
          });
          actions[thinkingAnimation].reset().fadeIn(0.5).play();
        }
      }
    }, [isLoading, actions, availableAnimations]);

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

    // Add subtle breathing animation and movement
    useFrame((state) => {
      if (group.current) {
        const time = state.clock.getElapsedTime();
        
        // Subtle breathing
        group.current.position.y = Math.sin(time * 0.5) * 0.02;
        
        // Slight movement when speaking
        if (isPlaying) {
          group.current.rotation.y = Math.sin(time * 2) * 0.03;
          group.current.position.x = Math.sin(time * 1.5) * 0.01;
        } else {
          // Smooth return to center
          group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, 0, 0.05);
          group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, 0, 0.05);
        }
      }
    });

    return (
      <group ref={group} dispose={null}>
        <primitive object={scene} scale={1} />
      </group>
    );
  } catch (error) {
    console.error('Error loading Krishna avatar:', error);
    
    // Fallback: Simple Krishna-colored representation
    return (
      <group ref={group}>
        <mesh position={[0, 1, 0]}>
          <cylinderGeometry args={[0.3, 0.4, 2, 8]} />
          <meshStandardMaterial color="#1e40af" />
        </mesh>
        <mesh position={[0, 2.2, 0]}>
          <sphereGeometry args={[0.4, 16, 16]} />
          <meshStandardMaterial color="#fbbf24" />
        </mesh>
        {/* Simple crown representation */}
        <mesh position={[0, 2.8, 0]}>
          <cylinderGeometry args={[0.45, 0.35, 0.2, 8]} />
          <meshStandardMaterial color="#fbbf24" />
        </mesh>
      </group>
    );
  }
};

// Preload the Krishna model
try {
  useGLTF.preload("/models/krishna.glb");
} catch (error) {
  console.warn('Could not preload Krishna avatar model:', error);
}
