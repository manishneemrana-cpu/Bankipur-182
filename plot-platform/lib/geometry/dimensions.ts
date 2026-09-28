import type { Point, Polygon } from "./types";
import { openRing } from "./polygon";

export interface EdgeDimension {
  /** Midpoint of the edge, offset outward slightly for the label. */
  labelPos: Point;
  /** Edge endpoints, for drawing the dimension line itself. */
  from: Point;
  to: Point;
  /** Rotation (degrees) to keep the label text upright along the edge. */
  angleDeg: number;
  lengthLayoutUnits: number;
}

/**
 * Dimension lines for every edge of a polygon's outer ring (§10.1: "dimension
 * lines drawn on the selected plot"). Labels are offset outward from the
 * polygon centroid so they read outside the fill, not on top of it.
 */
export function edgeDimensions(poly: Polygon, offset = 6): EdgeDimension[] {
  const ring = openRing(poly.coordinates[0] ?? []);
  if (ring.length < 2) return [];

  const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const cy = ring.reduce((s, p) => s + p[1], 0) / ring.length;

  return ring.map((from, i) => {
    const to = ring[(i + 1) % ring.length]!;
    const midX = (from[0] + to[0]) / 2;
    const midY = (from[1] + to[1]) / 2;
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const length = Math.hypot(dx, dy);

    // Outward normal: away from the centroid.
    let nx = -dy / (length || 1);
    let ny = dx / (length || 1);
    if ((midX - cx) * nx + (midY - cy) * ny < 0) {
      nx = -nx;
      ny = -ny;
    }

    const rawAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
    // Normalize into (-90, 90] so the label text is never upside down.
    const angleDeg = ((((rawAngle + 90) % 180) + 180) % 180) - 90;

    return {
      labelPos: [midX + nx * offset, midY + ny * offset],
      from,
      to,
      angleDeg,
      lengthLayoutUnits: length,
    };
  });
}
