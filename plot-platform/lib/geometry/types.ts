/** A point in project-local layout units (feet or metres after calibration). x right, y down. */
export type Point = readonly [number, number];
export type Ring = readonly Point[];

/** GeoJSON-like polygon in project-local coordinates (§6). First ring is the outer ring. */
export interface Polygon {
  type: "Polygon";
  coordinates: readonly Ring[];
}

export type Facing = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";
export const FACINGS: readonly Facing[] = [
  "N",
  "NE",
  "E",
  "SE",
  "S",
  "SW",
  "W",
  "NW",
];
