import { describe, expect, it } from "vitest";

import { parseKmlFeatures } from "@/lib/import/kml";

const origin = { lat: 25.6, lng: 85.1 };

const SAMPLE_KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>P-101</name>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
              85.1,25.6,0 85.1001,25.6,0 85.1001,25.6001,0 85.1,25.6001,0 85.1,25.6,0
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
    <Placemark>
      <name>Main Road</name>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>85.1,25.6,0 85.1002,25.6,0 85.1002,25.6001,0</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>`;

describe("parseKmlFeatures", () => {
  it("parses Placemark polygons into local-ft features", () => {
    const { features, errors } = parseKmlFeatures(SAMPLE_KML, origin);
    expect(errors).toEqual([]);
    expect(features).toHaveLength(2);
    expect(features[0]!.kind).toBe("plot");
    expect(features[0]!.plotNumber).toBe("P-101");
    expect(features[0]!.geometry.coordinates[0]).toHaveLength(5);
  });

  it("classifies a placemark named with 'road' as a road", () => {
    const { features } = parseKmlFeatures(SAMPLE_KML, origin);
    expect(features[1]!.kind).toBe("road");
  });

  it("reports a Placemark with no Polygon rather than throwing", () => {
    const kml = `<kml><Document><Placemark><name>No geometry</name></Placemark></Document></kml>`;
    const { features, errors } = parseKmlFeatures(kml, origin);
    expect(features).toEqual([]);
    expect(errors[0]).toMatch(/no Polygon geometry/);
  });

  it("reports when there are no Placemarks at all", () => {
    const { errors } = parseKmlFeatures(
      "<kml><Document></Document></kml>",
      origin,
    );
    expect(errors[0]).toMatch(/No Placemark/);
  });
});
