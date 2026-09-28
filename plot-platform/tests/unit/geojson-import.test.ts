import { describe, expect, it } from "vitest";

import { parseGeoJsonFeatures } from "@/lib/import/geojson";

const origin = { lat: 25.6, lng: 85.1 };

describe("parseGeoJsonFeatures", () => {
  it("parses a plot polygon and classifies it by plot_number property", () => {
    const geojson = JSON.stringify({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { plot_number: "P-101" },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [85.1, 25.6],
                [85.1001, 25.6],
                [85.1001, 25.6001],
                [85.1, 25.6001],
                [85.1, 25.6],
              ],
            ],
          },
        },
      ],
    });
    const { features, errors } = parseGeoJsonFeatures(geojson, origin);
    expect(errors).toEqual([]);
    expect(features).toHaveLength(1);
    expect(features[0]!.kind).toBe("plot");
    expect(features[0]!.plotNumber).toBe("P-101");
    expect(features[0]!.geometry.coordinates[0]).toHaveLength(5);
  });

  it("classifies a road by its kind property", () => {
    const geojson = JSON.stringify({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { kind: "road", name: "Main Road" },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [85.1, 25.6],
                [85.1001, 25.6],
                [85.1001, 25.6001],
                [85.1, 25.6],
              ],
            ],
          },
        },
      ],
    });
    const { features } = parseGeoJsonFeatures(geojson, origin);
    expect(features[0]!.kind).toBe("road");
  });

  it("classifies a zone by its kind property", () => {
    const geojson = JSON.stringify({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { kind: "park" },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [85.1, 25.6],
                [85.1001, 25.6],
                [85.1001, 25.6001],
                [85.1, 25.6],
              ],
            ],
          },
        },
      ],
    });
    const { features } = parseGeoJsonFeatures(geojson, origin);
    expect(features[0]!.kind).toBe("zone");
    expect(features[0]!.zoneKind).toBe("park");
  });

  it("skips a non-Polygon feature and reports it rather than throwing", () => {
    const geojson = JSON.stringify({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates: [85.1, 25.6] },
        },
      ],
    });
    const { features, errors } = parseGeoJsonFeatures(geojson, origin);
    expect(features).toEqual([]);
    expect(errors[0]).toMatch(/Polygon geometry is supported/);
  });

  it("reports invalid JSON instead of throwing", () => {
    const { features, errors } = parseGeoJsonFeatures("not json", origin);
    expect(features).toEqual([]);
    expect(errors[0]).toMatch(/Invalid JSON/);
  });
});
