import { useProgress } from '@react-three/drei';
import { Suspense, useEffect, useState } from 'react';
import { useStore } from './store';
import { useKeyboard } from './ui/useKeyboard';
import { Splash } from './ui/Splash';
import { TopBar } from './ui/TopBar';
import { PresetBar } from './ui/PresetBar';
import { SidePanel } from './ui/SidePanel';
import { HotspotCard } from './ui/HotspotCard';
import { MeasureBar } from './ui/MeasureBar';
import { UnitCard } from './ui/UnitCard';
import { WalkPad } from './ui/WalkPad';
import { Help } from './ui/Help';
import { Overlay } from './ui/Overlay';
import ViewerCanvas from './scene/ViewerCanvas';

function Loading() {
  const { progress, active } = useProgress();
  const bundle = useStore((s) => s.bundle)!;
  const level = useStore((s) => s.level);
  // The splash covers only the very first load; later model streaming shows a small corner indicator instead.
  const [first, setFirst] = useState(true);
  useEffect(() => { if (progress >= 100 && !active) setFirst(false); }, [progress, active]);
  useEffect(() => { const t = setTimeout(() => setFirst(false), 8000); return () => clearTimeout(t); }, []); // never trap the user behind the splash
  if (first) return <Splash name={bundle.project.name} cover={bundle.project.cover_image_url} progress={progress} label="Loading 3D model…" />;
  return active ? <div className="streaming" role="status">Loading {level === 'unit' ? 'interior' : 'detail'}… {Math.round(progress)}%</div> : null;
}

export default function ViewerRoot() {
  useKeyboard();
  const fade = useStore((s) => s.fade);
  const level = useStore((s) => s.level);
  return (
    <div className="app" data-level={level}>
      <div className="canvas-wrap">
        <Suspense fallback={null}><ViewerCanvas /></Suspense>
      </div>
      <Overlay />
      <TopBar />
      <SidePanel />
      <UnitCard />
      <PresetBar />
      <MeasureBar />
      <WalkPad />
      <HotspotCard />
      <Help />
      <Loading />
      <div className={`fade${fade ? ' on' : ''}`} aria-hidden />
    </div>
  );
}
