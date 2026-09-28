import type { Point } from "./types";

/**
 * Lightweight local projection for KML/GeoJSON import (§7.1, Phase 10):
 * an equirectangular projection centered on the project's own lat/lng is
 * accurate to well under a foot at the scale of a single plotted project
 * (a few hundred metres across) — good enough here without pulling in a
 * full projection library, and never presented as survey-grade (the
 * imported layout still goes through the same review/publish gate as a
 * manually traced one).
 */
const EARTH_RADIUS_M = 6_378_137;
const FT_PER_M = 3.280839895;

export interface LatLngOrigin {
  lat: number;
  lng: number;
}

/** Projects a (lng, lat) pair to local feet, x east, y south (matching the
 * layout's y-down drawing convention, §6). */
export function projectLngLatToLocalFt(
  lng: number,
  lat: number,
  origin: LatLngOrigin,
): Point {
  const latRad = (origin.lat * Math.PI) / 180;
  const dLngRad = ((lng - origin.lng) * Math.PI) / 180;
  const dLatRad = ((lat - origin.lat) * Math.PI) / 180;
  const xMeters = dLngRad * Math.cos(latRad) * EARTH_RADIUS_M;
  const yMeters = -dLatRad * EARTH_RADIUS_M;
  return [xMeters * FT_PER_M, yMeters * FT_PER_M];
}
