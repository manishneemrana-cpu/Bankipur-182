import { FACINGS, type Facing } from "./types";

/**
 * Direction conventions (§6). Drawing angles are measured clockwise from the
 * drawing's "up" (screen y down). `northAngleDeg` is the clockwise angle from
 * drawing-up to true north, i.e. where the north arrow points on the drawing.
 * Directions are never inferred from screen position alone.
 */

const norm = (deg: number) => ((deg % 360) + 360) % 360;

/** Drawing angle (clockwise from up) of a vector in layout coords (y down). */
export function drawingAngle(dx: number, dy: number): number {
  return norm((Math.atan2(dx, -dy) * 180) / Math.PI);
}

/** True compass bearing of a drawing direction. */
export function bearingFromDrawing(
  drawingAngleDeg: number,
  northAngleDeg: number,
): number {
  return norm(drawingAngleDeg - northAngleDeg);
}

/** Snaps a bearing to one of 8 compass directions. */
export function snapToFacing(bearingDeg: number): Facing {
  return FACINGS[Math.round(norm(bearingDeg) / 45) % 8]!;
}

export function facingBearing(f: Facing): number {
  return FACINGS.indexOf(f) * 45;
}

/** Smallest absolute angle between two bearings (0–180). */
export function angleBetween(a: number, b: number): number {
  const d = Math.abs(norm(a) - norm(b));
  return d > 180 ? 360 - d : d;
}

/**
 * Whether an admin-entered facing agrees with a geometric bearing. Builders
 * name facings to the nearest cardinal even on rotated layouts, so a facing is
 * accepted within its own 45° sector plus `toleranceDeg` either side.
 */
export function facingAgrees(
  adminFacing: Facing,
  bearingDeg: number,
  toleranceDeg = 10,
): boolean {
  return (
    angleBetween(facingBearing(adminFacing), bearingDeg) <= 22.5 + toleranceDeg
  );
}
