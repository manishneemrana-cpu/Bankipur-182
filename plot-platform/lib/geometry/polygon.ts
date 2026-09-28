import type { Point, Polygon, Ring } from "./types";

/** Drops a closing vertex equal to the first one. */
export function openRing(ring: Ring): Ring {
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (
    ring.length > 1 &&
    first &&
    last &&
    first[0] === last[0] &&
    first[1] === last[1]
  ) {
    return ring.slice(0, -1);
  }
  return ring;
}

/** Signed shoelace area; positive when vertices run clockwise on screen (y down). */
export function signedRingArea(ring: Ring): number {
  const r = openRing(ring);
  let sum = 0;
  for (let i = 0; i < r.length; i++) {
    const [x1, y1] = r[i]!;
    const [x2, y2] = r[(i + 1) % r.length]!;
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

/** Area of a polygon (outer ring minus holes) in squared layout units. */
export function polygonArea(poly: Polygon): number {
  const [outer, ...holes] = poly.coordinates;
  if (!outer) return 0;
  return holes.reduce(
    (a, h) => a - Math.abs(signedRingArea(h)),
    Math.abs(signedRingArea(outer)),
  );
}

/** Area centroid of the outer ring. */
export function polygonCentroid(poly: Polygon): Point {
  const r = openRing(poly.coordinates[0] ?? []);
  const a = signedRingArea(r);
  if (r.length === 0) return [0, 0];
  if (Math.abs(a) < 1e-12) {
    const sx = r.reduce((s, p) => s + p[0], 0);
    const sy = r.reduce((s, p) => s + p[1], 0);
    return [sx / r.length, sy / r.length];
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < r.length; i++) {
    const [x1, y1] = r[i]!;
    const [x2, y2] = r[(i + 1) % r.length]!;
    const f = x1 * y2 - x2 * y1;
    cx += (x1 + x2) * f;
    cy += (y1 + y2) * f;
  }
  return [cx / (6 * a), cy / (6 * a)];
}

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function bbox(polys: readonly Polygon[]): BBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of polys) {
    for (const [x, y] of p.coordinates[0] ?? []) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return { minX, minY, maxX, maxY };
}

export function rect(x: number, y: number, w: number, h: number): Polygon {
  return {
    type: "Polygon",
    coordinates: [
      [
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
        [x, y],
      ],
    ],
  };
}

export function isPolygon(value: unknown): value is Polygon {
  if (!value || typeof value !== "object") return false;
  const v = value as { type?: unknown; coordinates?: unknown };
  return (
    v.type === "Polygon" &&
    Array.isArray(v.coordinates) &&
    v.coordinates.length > 0 &&
    v.coordinates.every(
      (ring) =>
        Array.isArray(ring) &&
        ring.length >= 3 &&
        ring.every(
          (pt) =>
            Array.isArray(pt) &&
            pt.length >= 2 &&
            Number.isFinite(pt[0]) &&
            Number.isFinite(pt[1]),
        ),
    )
  );
}
