import type { Vec3 } from '@dt/shared-types';

/** Real-world distance between two model-space points. `metresPerUnit` = project.model_scale. */
export function measureDistance(a: Vec3, b: Vec3, metresPerUnit = 1): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * metresPerUnit;
}

export function formatDistance(metres: number): string {
  const ft = metres * 3.28084;
  return `${metres >= 100 ? metres.toFixed(0) : metres.toFixed(1)} m  (${ft >= 100 ? ft.toFixed(0) : ft.toFixed(1)} ft)`;
}
