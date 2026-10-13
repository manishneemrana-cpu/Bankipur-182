import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import { Vector3 } from 'three';

/**
 * LOD gate: true when the camera is within `threshold` of `center` (with 12% hysteresis so it never flickers on the boundary).
 * `force` pins it on (e.g. when navigating inside that tower).
 */
export function useNear(center: [number, number, number], threshold: number, force = false) {
  const [near, setNear] = useState(force);
  const c = useRef(new Vector3(...center));
  c.current.set(...center);
  const was = useRef(near);
  useFrame(({ camera }) => {
    const d = camera.position.distanceTo(c.current);
    const next = force || (was.current ? d < threshold * 1.12 : d < threshold);
    if (next !== was.current) { was.current = next; setNear(next); }
  });
  return near || force;
}
