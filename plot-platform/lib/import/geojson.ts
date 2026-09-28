import type { LatLngOrigin } from "@/lib/geometry/projection";
import { projectLngLatToLocalFt } from "@/lib/geometry/projection";
import type { Point, Polygon, Ring } from "@/lib/geometry/types";

export interface ImportedFeature {
  kind: "plot" | "road" | "zone";
  plotNumber?: string;
  zoneKind?: string;
  name?: string;
  geometry: Polygon;
}

export interface ParseResult {
  features: ImportedFeature[];
  errors: string[];
}

function classify(properties: Record<string, unknown>): {
  kind: ImportedFeature["kind"];
  plotNumber?: string;
  zoneKind?: string;
  name?: string;
} {
  const plotNumber =
    (properties.plot_number as string | undefined) ??
    (properties.plotNumber as string | undefined) ??
    (properties.name as string | undefined);
  const rawKind = String(
    properties.kind ?? properties.type ?? properties.layer ?? "",
  ).toLowerCase();

  if (rawKind.includes("road"))
    return { kind: "road", name: properties.name as string };
  if (
    rawKind &&
    !rawKind.includes("plot") &&
    [
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
    ].includes(rawKind)
  ) {
    return { kind: "zone", zoneKind: rawKind, name: properties.name as string };
  }
  return { kind: "plot", plotNumber };
}

function ringToLocal(ring: number[][], origin: LatLngOrigin): Ring {
  return ring.map(([lng, lat]): Point =>
    projectLngLatToLocalFt(lng ?? 0, lat ?? 0, origin),
  );
}

/** Parses a GeoJSON FeatureCollection of Polygons (§7.1, Phase 10) into the
 * same shape the tracing editor produces, projected into the project's
 * local feet coordinates. Never throws on a malformed feature — it's
 * skipped and reported so a partial file still imports the rest. */
export function parseGeoJsonFeatures(
  text: string,
  origin: LatLngOrigin,
): ParseResult {
  const errors: string[] = [];
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { features: [], errors: ["Invalid JSON."] };
  }

  const obj = json as { type?: string; features?: unknown[] };
  const rawFeatures =
    obj.type === "FeatureCollection" && Array.isArray(obj.features)
      ? obj.features
      : obj.type === "Feature"
        ? [json]
        : [];
  if (rawFeatures.length === 0) {
    errors.push("No GeoJSON features found.");
  }

  const features: ImportedFeature[] = [];
  rawFeatures.forEach((f, i) => {
    const feature = f as {
      geometry?: { type?: string; coordinates?: unknown };
      properties?: Record<string, unknown>;
    };
    const geom = feature.geometry;
    if (!geom || geom.type !== "Polygon" || !Array.isArray(geom.coordinates)) {
      errors.push(`Feature ${i}: only Polygon geometry is supported, skipped.`);
      return;
    }
    const rings = geom.coordinates as number[][][];
    const outer = rings[0];
    if (!outer || outer.length < 3) {
      errors.push(`Feature ${i}: polygon has too few points, skipped.`);
      return;
    }
    const classified = classify(feature.properties ?? {});
    features.push({
      ...classified,
      geometry: {
        type: "Polygon",
        coordinates: rings.map((r) => ringToLocal(r, origin)),
      },
    });
  });

  return { features, errors };
}
