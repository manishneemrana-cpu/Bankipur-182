import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import { anchors } from '../lib/anchors';

const v = new Vector3();
/** Projects every registered anchor to screen space. Direct style writes (no React work per frame). */
export function AnchorProjector() {
  useFrame(({ camera, size }) => {
    for (const { pos, el } of anchors.values()) {
      v.set(pos[0], pos[1], pos[2]).applyMatrix4(camera.matrixWorldInverse);
      if (v.z >= -0.1) { el.style.display = 'none'; continue; } // behind the camera
      const depth = -v.z;
      v.applyMatrix4(camera.projectionMatrix);
      const sx = (v.x * 0.5 + 0.5) * size.width, sy = (-v.y * 0.5 + 0.5) * size.height;
      if (sx < -200 || sx > size.width + 200 || sy < -100 || sy > size.height + 100) { el.style.display = 'none'; continue; }
      el.style.display = '';
      el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -50%)`;
      el.style.zIndex = String(Math.max(1, 1000 - Math.round(depth))); // nearer labels on top
    }
  });
  return null;
}
