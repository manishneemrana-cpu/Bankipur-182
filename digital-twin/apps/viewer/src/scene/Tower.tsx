import type { Tower as TowerT } from '@dt/shared-types';
import { useGLTF } from '@react-three/drei';
import { type ThreeEvent, useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useState } from 'react';
import type { Material, Object3D } from 'three';
import { towerCenter, towerHeight } from '../lib/presets';
import { useStore } from '../store';
import { glbUrl, prepareSimple, prepareTower, setNightLook, type TowerParts } from './models';
import { useNear } from './useNear';
import { useMeasureClick } from './useMeasureClick';

function setOpacity(mats: Material[], o: number) {
  for (const m of mats) {
    const base = (m.userData.baseOpacity as number) ?? 1;
    const wasTransparent = m.userData.baseTransparent as boolean;
    const t = wasTransparent || o < 0.999;
    if (m.transparent !== t) { m.transparent = t; m.needsUpdate = true; } // opaque→blend needs a program rebuild in three.js
    m.opacity = base * o;
    m.depthWrite = o > 0.6;
  }
}

/** Full-detail tower with per-floor cutaway / x-ray driven by navigation state. */
function FullTower({ tower, onReady }: { tower: TowerT; onReady: () => void }) {
  const gltf = useGLTF(glbUrl(tower.glb_url!));
  const parts = useMemo<TowerParts>(() => prepareTower(gltf.scene, tower.floor_node_prefix), [gltf, tower.floor_node_prefix]);
  const onClick = useMeasureClick();
  useEffect(() => { onReady(); }, [onReady]);

  const night = useStore((s) => s.night);
  useEffect(() => {
    parts.floors.forEach((f) => setNightLook(f.mats, night, f.n + tower.sort_order * 17));
    if (parts.roof) setNightLook(parts.roof.mats, night, 99);
    setNightLook(parts.other, night, 0);
  }, [parts, night, tower.sort_order]);

  useFrame((_, dt) => {
    const s = useStore.getState();
    const mine = s.towerId === tower.id;
    const focus = (s.level === 'floor' || s.level === 'unit') && s.floorNumber != null;
    const sel = s.floorNumber ?? 0;
    const ghost = s.plan ? 0 : 0.07;
    const k = Math.min(1, dt * 7);
    const step = (f: { opacity: number; mats: Material[]; node: Object3D }, target: number) => {
      if (Math.abs(f.opacity - target) < 0.003) { if (f.opacity !== target) { f.opacity = target; setOpacity(f.mats, target); f.node.visible = target > 0.01; } return; }
      f.opacity += (target - f.opacity) * k;
      setOpacity(f.mats, f.opacity); f.node.visible = f.opacity > 0.01;
    };
    for (const f of parts.floors) {
      // Other towers fade back when a floor is in focus; this tower cuts away at/above the selected floor.
      const target = !focus ? 1 : !mine ? 0.12 : f.n > sel ? ghost : 1;
      step(f, target);
      const cut = focus && mine && f.n === sel;
      for (const sh of f.shells) sh.visible = !cut;
    }
    if (parts.roof) step(parts.roof, !focus ? 1 : !mine ? 0.12 : ghost);
  });

  return <primitive object={parts.root} onClick={onClick} />;
}

function LodTower({ tower }: { tower: TowerT }) {
  const gltf = useGLTF(glbUrl(tower.lod_glb_url!));
  const { root, mats } = useMemo(() => prepareSimple(gltf.scene), [gltf]);
  const night = useStore((s) => s.night);
  const onClick = useMeasureClick();
  useEffect(() => setNightLook(mats, night, tower.sort_order * 5 + 3), [mats, night, tower.sort_order]);
  return <primitive object={root} onClick={onClick} />;
}

export function Tower({ tower }: { tower: TowerT }) {
  const focus = useStore((s) => s.towerId === tower.id && s.level !== 'site');
  const [fullReady, setFullReady] = useState(false);
  const c = towerCenter(tower);
  const reach = Math.max(towerHeight(tower), tower.footprint_w, tower.footprint_d);
  // Full detail only when the camera is close (or we're inside this tower); LOD mesh covers the load gap.
  const near = useNear(c, reach * 2.6 + 30, focus);
  const wantFull = !!tower.glb_url && (near || !tower.lod_glb_url);
  const showLod = !!tower.lod_glb_url && !(wantFull && fullReady);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    const s = useStore.getState();
    if (s.measuring || e.delta > 4) return;
    if (s.level === 'site') { e.stopPropagation(); s.goTower(tower.id); }
  };

  return (
    <group position={tower.position} rotation-y={tower.rotation_y} onClick={onClick}>
      {showLod && <Suspense fallback={null}><LodTower tower={tower} /></Suspense>}
      {wantFull && <Suspense fallback={null}><FullTower tower={tower} onReady={() => setFullReady(true)} /></Suspense>}
    </group>
  );
}
