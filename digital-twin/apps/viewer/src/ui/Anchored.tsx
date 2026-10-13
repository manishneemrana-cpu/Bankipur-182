import { type ReactNode, useLayoutEffect, useRef } from 'react';
import { anchors } from '../lib/anchors';
import type { Vec3 } from '@dt/shared-types';

/** Renders `children` as a normal DOM element that follows a 3D world position. */
export function Anchored({ id, position, children, className }: { id: string; position: Vec3; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [x, y, z] = position;
  useLayoutEffect(() => {
    anchors.set(id, { pos: [x, y, z], el: ref.current! });
    return () => { anchors.delete(id); };
  }, [id, x, y, z]);
  return <div ref={ref} className={`anchor ${className ?? ''}`} style={{ display: 'none' }}>{children}</div>;
}
