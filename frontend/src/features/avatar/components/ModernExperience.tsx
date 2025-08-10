import React, { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  CameraControls,
  ContactShadows,
  Environment,
  Text,
  Float,
} from '@react-three/drei';
import { motion } from 'framer-motion';
import { useChatStore } from '../../chat/stores/chatStore';
import { KrishnaAvatar } from './KrishnaAvatar';
import { LoadingSpinner } from '../../../shared/components/ui';

const LoadingDots: React.FC<{ position?: [number, number, number] }> = ({ position = [0, 1.75, 0] }) => {
  const { isLoading } = useChatStore();
  const [loadingText, setLoadingText] = useState('');

  useEffect(() => {
    if (isLoading) {
      const interval = setInterval(() => {
        setLoadingText((prev) => {
          if (prev.length > 2) return '.';
          return prev + '.';
        });
      }, 800);
      return () => clearInterval(interval);
    } else {
      setLoadingText('');
    }
  }, [isLoading]);

  if (!isLoading) return null;

  return (
    <group position={position}>
      <Text fontSize={0.14} anchorX="left" anchorY="bottom" color="#333">
        {loadingText}
      </Text>
    </group>
  );
};



const CameraController: React.FC = () => {
  const cameraControls = useRef<CameraControls>(null);

  useEffect(() => {
    if (cameraControls.current) {
      // Position model slightly down and more zoomed in
      cameraControls.current.setLookAt(0, 1.5, 5, 0, 1, 0, true);
    }
  }, []);

  return <CameraControls ref={cameraControls} />;
};

const SceneLighting: React.FC = () => {
  return (
    <>
      <Environment preset="sunset" />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={1.2} castShadow />
      <pointLight position={[-5, 5, 5]} intensity={0.5} color="#ff6b6b" />
      <pointLight position={[5, 5, -5]} intensity={0.5} color="#4ecdc4" />
    </>
  );
};

interface ModernExperienceProps {
  className?: string;
}

export const ModernExperience: React.FC<ModernExperienceProps> = ({ className }) => {
  const [sceneReady, setSceneReady] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
      className={className}
    >
      <Canvas
        shadows
        camera={{ position: [0, 0.5, 3], fov: 35 }}
        onCreated={() => setSceneReady(true)}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={null}>
          <CameraController />
          <SceneLighting />

          <Float speed={1.5} rotationIntensity={0.5} floatIntensity={0.5}>
            <KrishnaAvatar />
          </Float>

          <LoadingDots />
          <ContactShadows opacity={0.4} scale={10} blur={2} far={10} resolution={256} />
        </Suspense>
      </Canvas>

      {!sceneReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="text-center space-y-4">
            <LoadingSpinner size="lg" />
            <p className="text-sm text-muted-foreground">Loading 3D scene...</p>
          </div>
        </div>
      )}
    </motion.div>
  );
};
