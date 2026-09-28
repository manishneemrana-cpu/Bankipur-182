import { describe, expect, it } from "vitest";

import { toMapLayoutData } from "@/lib/data/public-map-adapter";
import { rect } from "@/lib/geometry/polygon";
import type { PublicSiteData } from "@/lib/data/public-site";

function basePayload(overrides: Partial<PublicSiteData> = {}): PublicSiteData {
  return {
    project: {
      id: "p1",
      name: "Test",
      slug: "test",
      type: "residential_plots",
      address: null,
      city: null,
      state: null,
      lat: null,
      lng: null,
      location_verified: false,
      total_area_value: null,
      total_area_unit: null,
      rera_number: null,
      rera_authority: null,
      rera_url: null,
      possession_info: null,
      description: null,
      visibility: "public",
      price_visibility: "public",
      is_demo: false,
      settings: {},
    },
    org: { name: "Org", branding: {}, contact: {}, powered_by_visible: false },
    layout: { north_angle_deg: 23, unit: "ft" },
    plots: [],
    roads: [],
    zones: [],
    landmarks: [],
    faqs: [],
    documents: [],
    ...overrides,
  };
}

describe("toMapLayoutData (public site -> PlotMap adapter)", () => {
  it("carries the north angle and unit through", () => {
    const map = toMapLayoutData(basePayload());
    expect(map.northAngleDeg).toBe(23);
    expect(map.unit).toBe("ft");
  });

  it("drops plots/roads/zones with missing or invalid geometry rather than crashing", () => {
    const payload = basePayload({
      plots: [
        {
          id: "1",
          plot_number: "P-1",
          plot_type: "residential",
          status: "AVAILABLE",
          area_official_value: 1200,
          area_official_unit: "sqft",
          dimensions: [],
          frontage_ft: null,
          depth_ft: null,
          facing: "N",
          facing_source: null,
          corner_status: "NO",
          road_width_primary_ft: null,
          price_total: null,
          rate_per_unit: null,
          rate_unit: null,
          booking_amount: null,
          price_visibility: "on_request",
          geometry: rect(0, 0, 10, 10),
          centroid_x: 5,
          centroid_y: 5,
          tags: [],
          public_notes: null,
          last_inventory_update: new Date().toISOString(),
        },
        {
          id: "2",
          plot_number: "P-2",
          plot_type: "residential",
          status: "AVAILABLE",
          area_official_value: null,
          area_official_unit: null,
          dimensions: [],
          frontage_ft: null,
          depth_ft: null,
          facing: "N",
          facing_source: null,
          corner_status: "NO",
          road_width_primary_ft: null,
          price_total: null,
          rate_per_unit: null,
          rate_unit: null,
          booking_amount: null,
          price_visibility: "on_request",
          geometry: null, // not yet traced
          centroid_x: null,
          centroid_y: null,
          tags: [],
          public_notes: null,
          last_inventory_update: new Date().toISOString(),
        },
      ],
    });
    const map = toMapLayoutData(payload);
    expect(map.plots).toHaveLength(1);
    expect(map.plots[0]!.plot_number).toBe("P-1");
  });
});
