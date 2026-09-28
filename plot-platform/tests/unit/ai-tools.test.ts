import { describe, expect, it, vi } from "vitest";

import { buildTools } from "@/lib/ai/tools";
import type { PublicSiteData } from "@/lib/data/public-site";

function makeData(overrides: Partial<PublicSiteData> = {}): PublicSiteData {
  return {
    project: {
      id: "proj-1",
      name: "Green Valley",
      slug: "green-valley",
      type: "residential_plots",
      address: null,
      city: "Patna",
      state: "Bihar",
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
      is_demo: true,
      settings: {},
    },
    org: {
      name: "Demo Developers",
      branding: {},
      contact: {},
      powered_by_visible: false,
    },
    layout: { north_angle_deg: 0, unit: "sqft" },
    plots: [
      {
        id: "p1",
        plot_number: "P-101",
        plot_type: "residential",
        status: "AVAILABLE",
        area_official_value: 1200,
        area_official_unit: "sqft",
        dimensions: [],
        frontage_ft: null,
        depth_ft: null,
        facing: "E",
        facing_source: null,
        corner_status: "NO",
        road_width_primary_ft: 30,
        price_total: 2_000_000,
        rate_per_unit: null,
        rate_unit: null,
        booking_amount: null,
        price_visibility: "public",
        geometry: null,
        centroid_x: null,
        centroid_y: null,
        tags: [],
        public_notes: null,
        last_inventory_update: new Date().toISOString(),
      },
      {
        id: "p2",
        plot_number: "P-102",
        plot_type: "residential",
        status: "SOLD",
        area_official_value: 1500,
        area_official_unit: "sqft",
        dimensions: [],
        frontage_ft: null,
        depth_ft: null,
        facing: "W",
        facing_source: null,
        corner_status: "YES",
        road_width_primary_ft: 40,
        price_total: 2_500_000,
        rate_per_unit: null,
        rate_unit: null,
        booking_amount: null,
        price_visibility: "public",
        geometry: null,
        centroid_x: null,
        centroid_y: null,
        tags: [],
        public_notes: null,
        last_inventory_update: new Date().toISOString(),
      },
    ],
    roads: [],
    zones: [],
    landmarks: [
      {
        id: "l1",
        name: "Highway",
        category: "transport",
        distance_value: 2,
        distance_unit: "km",
        travel_time_min: 5,
        distance_source: "provided",
      },
    ],
    faqs: [],
    documents: [],
    ...overrides,
  };
}

describe("buildTools", () => {
  it("test 9: get_project_summary counts match the data exactly", async () => {
    const data = makeData();
    const submitLead = vi.fn();
    const { execute } = buildTools(data, submitLead);
    const result = (await execute("get_project_summary", {})) as {
      counts: Record<string, number>;
    };
    expect(result.counts).toEqual({ AVAILABLE: 1, SOLD: 1 });
  });

  it("test 10: search_plots only returns AVAILABLE plots matching every filter", async () => {
    const data = makeData();
    const { execute } = buildTools(data, vi.fn());
    const result = (await execute("search_plots", {
      area_value: 1200,
      area_unit: "sqft",
      facing: ["E"],
      corner: true,
    })) as { count: number; suggestion: { relax_criterion: string } | null };
    // P-101 matches area/facing but not corner -> no match; must offer relax.
    expect(result.count).toBe(0);
    expect(result.suggestion?.relax_criterion).toBe("corner");
  });

  it("search_plots never returns a SOLD plot even if every other filter matches", async () => {
    const data = makeData();
    const { execute } = buildTools(data, vi.fn());
    const result = (await execute("search_plots", {
      area_value: 1500,
      area_unit: "sqft",
      facing: ["W"],
      corner: true,
    })) as { count: number; plots: Array<{ plot_number: string }> };
    expect(result.count).toBe(0);
  });

  it("get_plot never leaks a plot's internal fields (there are none in PublicSiteData)", async () => {
    const data = makeData();
    const { execute } = buildTools(data, vi.fn());
    const result = (await execute("get_plot", {
      plot_number: "P-101",
    })) as Record<string, unknown>;
    expect(result.plot_number).toBe("P-101");
    expect(result).not.toHaveProperty("public_notes");
  });

  it("create_lead requires consent", async () => {
    const submitLead = vi.fn();
    const data = makeData();
    const { execute } = buildTools(data, submitLead);
    const result = (await execute("create_lead", {
      name: "Rahul",
      phone: "+919876543210",
      consent: false,
    })) as { error: string };
    expect(result.error).toBe("CONSENT_REQUIRED");
    expect(submitLead).not.toHaveBeenCalled();
  });

  it("create_lead submits with consent", async () => {
    const submitLead = vi.fn().mockResolvedValue({ ok: true });
    const data = makeData();
    const { execute } = buildTools(data, submitLead);
    const result = (await execute("create_lead", {
      name: "Rahul",
      phone: "+919876543210",
      consent: true,
      plot_numbers: ["P-101"],
    })) as { ok: boolean };
    expect(result.ok).toBe(true);
    expect(submitLead).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Rahul",
        phone: "+919876543210",
        source: "chat",
      }),
    );
  });

  it("highlight_plots resolves plot numbers to ids without exposing other data", async () => {
    const data = makeData();
    const { execute } = buildTools(data, vi.fn());
    const result = (await execute("highlight_plots", {
      plot_numbers: ["P-101"],
    })) as { highlighted_plot_ids: string[] };
    expect(result.highlighted_plot_ids).toEqual(["p1"]);
  });

  it("search_knowledge honestly reports it isn't configured rather than guessing", async () => {
    const data = makeData();
    const { execute } = buildTools(data, vi.fn());
    const result = (await execute("search_knowledge", {
      query: "possession date",
    })) as { available: boolean };
    expect(result.available).toBe(false);
  });
});
