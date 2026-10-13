import type { Floor, Tower, Vec3 } from '@dt/shared-types';

/** A camera destination. `key` changes on every request so the rig re-animates even for an identical goal. */
export interface CamGoal {
  pos: Vec3;
  target: Vec3;
  /** Top-down plan: rotation disabled, left-drag pans. */
  lockRotate?: boolean;
  duration?: number;
  instant?: boolean;
  key: number;
}
export type GoalSpec = Omit<CamGoal, 'key'>;

const FOV = 45;
const norm = (v: Vec3): Vec3 => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];

/** Rotate about Y with three.js' convention (matches <group rotation-y>). */
export const rotateY = (v: Vec3, a: number): Vec3 => [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)];

export const towerHeight = (t: Tower) => t.floor_count * t.floor_height + 0.4;
export const towerCenter = (t: Tower): Vec3 => [t.position[0], t.position[1] + towerHeight(t) / 2, t.position[2]];

/** Tower-local point → site space. */
export const towerToWorld = (t: Tower, p: Vec3): Vec3 => add(rotateY(p, t.rotation_y), t.position);

export function exteriorGoal(towers: Tower[]): GoalSpec {
  if (!towers.length) return { pos: [90, 60, 90], target: [0, 10, 0], duration: 1.6 };
  const c: Vec3 = [0, 0, 0];
  towers.forEach((t) => { c[0] += t.position[0] / towers.length; c[2] += t.position[2] / towers.length; });
  const radius = Math.max(...towers.map((t) => Math.hypot(t.position[0] - c[0], t.position[2] - c[2]) + Math.max(t.footprint_w, t.footprint_d) / 2));
  const tallest = Math.max(...towers.map(towerHeight));
  const dist = Math.max(90, radius * 3.1 + tallest * 0.8);
  const target: Vec3 = [c[0], tallest * 0.3, c[2]];
  return { pos: add(target, scale(norm([0.55, 0.5, 1]), dist)), target, duration: 1.6 };
}

export function towerGoal(t: Tower): GoalSpec {
  const h = towerHeight(t);
  const target: Vec3 = [t.position[0], t.position[1] + h * 0.45, t.position[2]];
  const dist = Math.max(h * 1.35, Math.max(t.footprint_w, t.footprint_d) * 1.8) + 12;
  return { pos: add(target, scale(rotateY(norm([0.4, 0.22, 1]), t.rotation_y), dist)), target };
}

export function floorGoal(t: Tower, f: Floor): GoalSpec {
  const target: Vec3 = [t.position[0], t.position[1] + f.elevation + 1, t.position[2]];
  const dist = Math.max(t.footprint_w, t.footprint_d) * 1.45 + 10;
  return { pos: add(target, scale(rotateY(norm([0.3, 0.85, 1]), t.rotation_y), dist)), target };
}

/** Straight-down plan, framed so the whole floor plate fits at the given viewport aspect. */
export function planGoal(t: Tower, f: Floor, aspect: number): GoalSpec {
  const target: Vec3 = [t.position[0], t.position[1] + f.elevation + 0.3, t.position[2]];
  const k = 2 * Math.tan((FOV * Math.PI) / 360);
  // Reserve room for the side panel / bars → fit against ~78% of the viewport.
  const need = Math.max(t.footprint_d / k, t.footprint_w / (k * Math.max(aspect * 0.78, 0.3))) * 1.12;
  // On wide screens the side panel covers the right ~19%: slide the framing so the plate is centred in the free area.
  const visibleW = need * k * aspect;
  const shift = aspect > 1 ? rotateY([visibleW * 0.1, 0, 0], t.rotation_y) : ([0, 0, 0] as Vec3);
  const c = add(target, shift);
  return { pos: add(c, rotateY([0, need, 0.001], t.rotation_y)), target: c, lockRotate: true };
}

export interface Box { min: Vec3; max: Vec3 }
/** Dollhouse view of a unit interior from its bounding box. */
export function interiorGoal(b: Box): GoalSpec {
  const c: Vec3 = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
  const span = Math.max(b.max[0] - b.min[0], b.max[2] - b.min[2]);
  return { pos: [c[0], c[1] + span * 1.25, c[2] + span * 0.6], target: [c[0], 0.4, c[2]], duration: 0.9 };
}

export function hotspotGoal(p: Vec3): GoalSpec {
  return { pos: add(p, [24, 14, 24]), target: p, duration: 1.1 };
}
