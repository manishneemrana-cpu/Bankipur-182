import { XMLParser } from "fast-xml-parser";

import type { LatLngOrigin } from "@/lib/geometry/projection";
import { projectLngLatToLocalFt } from "@/lib/geometry/projection";
import type { Point, Polygon } from "@/lib/geometry/types";

import type { ImportedFeature, ParseResult } from "./geojson";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

function parseCoordinateString(text: string, origin: LatLngOrigin): Point[] {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((triplet) => {
      const [lng, lat] = triplet.split(",").map(Number);
      return projectLngLatToLocalFt(lng ?? 0, lat ?? 0, origin);
    });
}

function classify(name: string | undefined): {
  kind: ImportedFeature["kind"];
  plotNumber?: string;
  zoneKind?: string;
} {
  const lower = (name ?? "").toLowerCase();
  if (lower.includes("road")) return { kind: "road" };
  const zoneKinds = [
    "park",
    "amenity",
    "commercial",
    "residential",
    "utility",
    "gate_entry",
    "gate_exit",
    "boundary",
    "water",
    "other",
  ];
  const match = zoneKinds.find((k) => lower.includes(k));
  if (match) return { kind: "zone", zoneKind: match };
  return { kind: "plot", plotNumber: name };
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/** Parses KML Placemarks with Polygon geometry (§7.1, Phase 10) — the same
 * output shape as the GeoJSON importer so both feed the same pipeline. Only
 * single-ring (no holes) polygons and simple nested MultiGeometry are
 * handled; anything else is reported and skipped rather than guessed at. */
export function parseKmlFeatures(
  text: string,
  origin: LatLngOrigin,
): ParseResult {
  const errors: string[] = [];
  let doc: unknown;
  try {
    doc = parser.parse(text);
  } catch {
    return { features: [], errors: ["Invalid KML/XML."] };
  }

  const kml = doc as {
    kml?: {
      Document?: { Placemark?: unknown; Folder?: { Placemark?: unknown } };
    };
  };
  const placemarks = [
    ...asArray(kml.kml?.Document?.Placemark),
    ...asArray(kml.kml?.Document?.Folder?.Placemark),
  ];
  if (placemarks.length === 0) {
    errors.push("No Placemark elements found.");
  }

  const features: ImportedFeature[] = [];
  placemarks.forEach((p, i) => {
    const placemark = p as {
      name?: string;
      Polygon?: { outerBoundaryIs?: { LinearRing?: { coordinates?: string } } };
    };
    const coordText =
      placemark.Polygon?.outerBoundaryIs?.LinearRing?.coordinates;
    if (!coordText) {
      errors.push(`Placemark ${i}: no Polygon geometry, skipped.`);
      return;
    }
    const ring = parseCoordinateString(coordText, origin);
    if (ring.length < 3) {
      errors.push(`Placemark ${i}: polygon has too few points, skipped.`);
      return;
    }
    const classified = classify(placemark.name);
    const geometry: Polygon = { type: "Polygon", coordinates: [ring] };
    features.push({ ...classified, name: placemark.name, geometry });
  });

  return { features, errors };
}
