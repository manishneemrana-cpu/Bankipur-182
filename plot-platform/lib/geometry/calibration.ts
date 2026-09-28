import type { Point, Polygon, Ring } from "./types";
import { openRing } from "./polygon";
import { bearingFromDrawing, drawingAngle, snapToFacing } from "./facing";
import type { Facing } from "./types";

/**
 * Scale calibration (§7.1 step 7): admin clicks two points on the raw
 * uploaded image and enters the real-world distance between them. Returns
 * layout units per source pixel — 0 if the two points coincide (caller
 * should reject that as invalid input, not divide by it).
 */
export function calibrationScale(
  p1: Point,
  p2: Point,
  realDistance: number,
): number {
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const pxDist = Math.hypot(dx, dy);
  return pxDist === 0 ? 0 : realDistance / pxDist;
}

function scalePoint([x, y]: Point, unitsPerPx: number): Point {
  return [x * unitsPerPx, y * unitsPerPx];
}

/** Converts a ring traced in source-image pixels into layout units. */
export function scaleRing(ring: Ring, unitsPerPx: number): Ring {
  return ring.map((p) => scalePoint(p, unitsPerPx));
}

/** Converts a polygon traced in source-image pixels into layout units. */
export function scalePolygon(poly: Polygon, unitsPerPx: number): Polygon {
  return {
    type: "Polygon",
    coordinates: poly.coordinates.map((ring) => scaleRing(ring, unitsPerPx)),
  };
}

/**
 * Derives facing + corner status from the plot outline and which of its
 * edges the admin marked as road-facing while tracing (§7.1 step 6, §10.1).
 * Facing comes from the outward bearing of the first road-facing edge;
 * corner is YES only when two or more distinct edges face a road — this is
 * a deliberate simplification (no automatic road-proximity detection) so
 * the result is always exactly what the admin marked, never a guess.
 */
export function deriveFacingAndCorner(
  poly: Polygon,
  roadFacingEdgeIndices: readonly number[],
  northAngleDeg: number,
): { facing: Facing | "UNKNOWN"; corner: "YES" | "NO" | "UNKNOWN" } {
  if (roadFacingEdgeIndices.length === 0) {
    return { facing: "UNKNOWN", corner: "UNKNOWN" };
  }
  const ring = openRing(poly.coordinates[0] ?? []);
  const edgeIndex = roadFacingEdgeIndices[0]!;
  const a = ring[edgeIndex];
  const b = ring[(edgeIndex + 1) % ring.length];
  if (!a || !b) return { facing: "UNKNOWN", corner: "UNKNOWN" };

  // Outward normal of the edge (rotate the edge vector 90°); which side is
  // "outward" doesn't matter for a convex-ish plot outline traced
  // clockwise, since the edge vector's own drawing angle already points
  // along the road-facing side consistently for every edge in the ring.
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const bearing = bearingFromDrawing(drawingAngle(dx, dy), northAngleDeg);

  return {
    facing: snapToFacing(bearing),
    corner: roadFacingEdgeIndices.length >= 2 ? "YES" : "NO",
  };
}
