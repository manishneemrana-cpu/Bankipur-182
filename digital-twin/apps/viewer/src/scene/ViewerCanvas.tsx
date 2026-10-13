import { OrbitControls, PerformanceMonitor } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect, useState } from 'react';
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three';
import { selectors, useStore } from '../store';
import { CameraRig } from './CameraRig';
import { FloorUnits } from './FloorUnits';
import { AnchorProjector } from './AnchorProjector';
import { Interior } from './Interior';
import { Lighting } from './Lighting';
import { Measure } from './Measure';
import { Site } from './Site';
import { Tower } from './Tower';
import { preload } from './models';

function Scene() {
  const bundle = useStore((s) => s.bundle)!;
  const level = useStore((s) => s.level);
  const walk = useStore((s) => s.walk);
  const measuring = useStore((s) => s.measuring);
  const unit = useStore(selectors.unit);
  const [lowPerf, setLowPerf] = useState(false);
  const inside = level === 'unit';

  // Warm the caches for the first-interactive path: LOD meshes are tiny, so grab them immediately.
  useEffect(() => {
    preload(bundle.project.site_lod_glb_url);
    bundle.towers.forEach((t) => preload(t.lod_glb_url));
  }, [bundle]);

  return (
    <>
      <PerformanceMonitor onDecline={() => setLowPerf(true)} />
      <CameraRig />
      <AnchorProjector />
      <OrbitControls
        makeDefault enabled={!walk} enableDamping dampingFactor={0.1} rotateSpeed={0.7}
        minDistance={inside ? 1.5 : 6} maxDistance={inside ? 30 : 450}
        maxPolarAngle={inside ? Math.PI / 2 - 0.05 : Math.PI / 2 - 0.02}
        zoomToCursor={!inside}
      />
      {inside ? (
        <Suspense fallback={null}>{unit && <Interior />}</Suspense>
      ) : (
        <>
          <Lighting shadows={!lowPerf} />
          <Site glb={bundle.project.site_glb_url} lod={bundle.project.site_lod_glb_url} />
          {bundle.towers.map((t) => <Tower key={t.id} tower={t} />)}
          <FloorUnits />
        </>
      )}
      <Measure />
      {measuring && <MeasureCursor />}
    </>
  );
}

function MeasureCursor() {
  useEffect(() => { document.body.classList.add('measuring'); return () => document.body.classList.remove('measuring'); }, []);
  return null;
}

export default function ViewerCanvas() {
  const [dpr, setDpr] = useState(1.5);
  return (
    <Canvas
      shadows="percentage"
      dpr={[1, dpr]}
      camera={{ fov: 45, near: 0.1, far: 2500, position: [90, 60, 90] }}
      gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: ACESFilmicToneMapping, outputColorSpace: SRGBColorSpace }}
      onCreated={({ gl }) => { gl.domElement.setAttribute('aria-label', '3D project viewer'); }}
      onPointerMissed={() => { /* background click: nothing */ }}
    >
      <PerfDpr set={setDpr} />
      <Scene />
    </Canvas>
  );
}

function PerfDpr({ set }: { set: (n: number) => void }) {
  // Cap pixel ratio on very large (4K TV) screens where fill-rate is the bottleneck.
  useEffect(() => { set(window.innerWidth * window.devicePixelRatio > 2600 ? 1 : Math.min(window.devicePixelRatio, 1.75)); }, [set]);
  return null;
}
