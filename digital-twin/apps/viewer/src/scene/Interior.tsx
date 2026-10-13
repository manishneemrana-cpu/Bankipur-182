import { useGLTF } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Box3, type Mesh, type Object3D, Vector3 } from 'three';
import { walkKeys } from '../lib/input';
import { selectors, useStore } from '../store';
import { boundsOf, glbUrl, prepareSimple } from './models';
import { useMeasureClick } from './useMeasureClick';

/** Collision boxes (XZ) from every mesh under nodes named Wall*. */
function collectColliders(root: Object3D): Box3[] {
  root.updateMatrixWorld(true);
  const out: Box3[] = [];
  root.traverse((o) => {
    if (!(o as Mesh).isMesh) return;
    for (let p: Object3D | null = o; p; p = p.parent) if (/^wall/i.test(p.name)) { out.push(new Box3().setFromObject(o)); return; }
  });
  return out;
}

const RADIUS = 0.28;
const EYE = 1.6;

function Walk({ colliders, bounds, spawn }: { colliders: Box3[]; bounds: Box3; spawn: [number, number, number] }) {
  const { camera, gl } = useThree();
  const yaw = useRef(Math.PI);
  const pitch = useRef(0);
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    camera.position.set(spawn[0], EYE, spawn[2]);
    camera.rotation.order = 'YXZ';
    const el = gl.domElement;
    const down = (e: PointerEvent) => { drag.current = { x: e.clientX, y: e.clientY }; el.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => {
      if (!drag.current) return;
      yaw.current -= (e.clientX - drag.current.x) * 0.005;
      pitch.current = Math.max(-1.2, Math.min(1.2, pitch.current - (e.clientY - drag.current.y) * 0.004));
      drag.current = { x: e.clientX, y: e.clientY };
    };
    const up = () => { drag.current = null; };
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
      camera.rotation.order = 'XYZ';
    };
  }, [camera, gl, spawn]);

  const blocked = (x: number, z: number) =>
    colliders.some((b) => x > b.min.x - RADIUS && x < b.max.x + RADIUS && z > b.min.z - RADIUS && z < b.max.z + RADIUS && b.min.y < EYE);

  useFrame((_, dt) => {
    const k = walkKeys;
    const f = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
    const r = (k.has('d') ? 1 : 0) - (k.has('a') ? 1 : 0);
    const turn = (k.has('arrowleft') ? 1 : 0) - (k.has('arrowright') ? 1 : 0) + (k.has('q') ? 1 : 0) - (k.has('e') ? 1 : 0);
    yaw.current += turn * 1.8 * dt;
    if (f || r) {
      const sp = (k.has('shift') ? 3 : 1.7) * Math.min(dt, 0.05);
      const dx = (-Math.sin(yaw.current) * f + Math.cos(yaw.current) * r) * sp;
      const dz = (-Math.cos(yaw.current) * f - Math.sin(yaw.current) * r) * sp;
      let { x, z } = camera.position;
      // Axis-separated moves let the player slide along walls.
      if (!blocked(x + dx, z)) x += dx;
      if (!blocked(x, z + dz)) z += dz;
      camera.position.x = Math.min(bounds.max.x - 0.2, Math.max(bounds.min.x + 0.2, x));
      camera.position.z = Math.min(bounds.max.z - 0.2, Math.max(bounds.min.z + 0.2, z));
    }
    camera.position.y = EYE;
    camera.rotation.set(pitch.current, yaw.current, 0);
  });
  return null;
}

export function Interior() {
  const unit = useStore(selectors.unit);
  const type = useStore((s) => s.bundle?.unit_types.find((t) => t.id === selectors.unit(s)?.unit_type_id));
  const walk = useStore((s) => s.walk);
  const furnished = useStore((s) => s.furnished);
  const night = useStore((s) => s.night);
  if (!unit || !type?.glb_url) return null;
  return <InteriorModel url={type.glb_url} walk={walk} furnished={furnished} night={night} spawn={type.spawn} />;
}

function InteriorModel({ url, walk, furnished, night, spawn }: { url: string; walk: boolean; furnished: boolean; night: boolean; spawn: [number, number, number] }) {
  const gltf = useGLTF(glbUrl(url));
  const { root } = useMemo(() => prepareSimple(gltf.scene), [gltf]);
  const onClick = useMeasureClick();
  const { colliders, bounds, furniture, ceilings } = useMemo(() => {
    const furniture: Object3D[] = [], ceilings: Object3D[] = [];
    root.traverse((o) => { if (/^furniture/i.test(o.name)) furniture.push(o); else if (/^ceiling/i.test(o.name)) ceilings.push(o); });
    const b = boundsOf(root);
    return { colliders: collectColliders(root), bounds: new Box3(new Vector3(...b.min), new Vector3(...b.max)), furniture, ceilings };
  }, [root]);

  useEffect(() => { useStore.getState().interiorLoaded(boundsOf(root)); }, [root]);
  useEffect(() => { furniture.forEach((o) => { o.visible = furnished; }); }, [furniture, furnished]);
  // Ceiling hides in the dollhouse (orbit) view so you can look down into the rooms.
  useEffect(() => { ceilings.forEach((o) => { o.visible = walk; }); }, [ceilings, walk]);

  return (
    <>
      <color attach="background" args={[night ? '#10131c' : '#e6e9ef']} />
      <hemisphereLight args={['#ffffff', '#9a8f80', night ? 0.55 : 1.15]} />
      <directionalLight position={[6, 12, 4]} intensity={night ? 0.2 : 1.1} />
      {night && [[-2, 2.4, -1], [2.5, 2.4, 0.5]].map((p, i) => <pointLight key={i} position={p as [number, number, number]} intensity={14} color="#ffd9a8" distance={9} />)}
      <primitive object={root} onClick={onClick} />
      {walk && <Walk colliders={colliders} bounds={bounds} spawn={spawn} />}
    </>
  );
}
