import type { ThreeEvent } from '@react-three/fiber';
import type { Material, Mesh } from 'three';
import { useStore } from '../store';

/** Click handler for model meshes: while measuring, records the picked world point (ignoring x-ray ghosts and drags). */
export function useMeasureClick() {
  return (e: ThreeEvent<MouseEvent>) => {
    const s = useStore.getState();
    if (!s.measuring || e.delta > 4) return;
    const m = (e.object as Mesh).material as Material | undefined;
    if (m && (m as Material).opacity < 0.5 && !(m as Material).userData.baseTransparent) return; // pass through ghosted floors
    e.stopPropagation();
    s.addMeasurePoint([e.point.x, e.point.y, e.point.z]);
  };
}
