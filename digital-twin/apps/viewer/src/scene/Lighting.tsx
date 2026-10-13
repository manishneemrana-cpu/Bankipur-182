import { Sky, Stars } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { Color, Fog } from 'three';
import { useStore } from '../store';

/** Day: procedural sky + sun with shadows. Night: dark gradient, stars, moonlight (windows glow via setNightLook). */
export function Lighting({ shadows }: { shadows: boolean }) {
  const night = useStore((s) => s.night);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const c = new Color(night ? '#070b16' : '#bcd6ee');
    scene.background = night ? c : null;
    scene.fog = new Fog(night ? '#070b16' : '#cfe0ef', 220, 720);
    return () => { scene.fog = null; };
  }, [night, scene]);
  return (
    <>
      {night ? <Stars radius={500} depth={80} count={2500} factor={5} fade speed={0.4} /> : <Sky distance={4500} sunPosition={[120, 90, 60]} turbidity={6} rayleigh={1.6} />}
      <hemisphereLight args={[night ? '#3a4a7a' : '#dfeeff', night ? '#10131c' : '#6e6a5a', night ? 0.55 : 1.0]} />
      <directionalLight
        position={night ? [-80, 120, -60] : [120, 160, 80]}
        color={night ? '#8fa6ff' : '#fff4e0'}
        intensity={night ? 0.7 : 2.4}
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-130} shadow-camera-right={130} shadow-camera-top={130} shadow-camera-bottom={-130}
        shadow-camera-near={10} shadow-camera-far={500} shadow-bias={-0.0004}
      />
    </>
  );
}
