import { describe, expect, it } from "vitest";

import { parseSearchQuery } from "@/lib/search/parse";
import {
  bestCriterionToRelax,
  matchesAllFilters,
  type MatchablePlot,
} from "@/lib/search/match";

function plot(overrides: Partial<MatchablePlot> = {}): MatchablePlot {
  return {
    status: "AVAILABLE",
    area_official_value: 1200,
    area_official_unit: "sqft",
    facing: "E",
    corner_status: "NO",
    road_width_primary_ft: 30,
    price_total: 2_000_000,
    ...overrides,
  };
}

describe("matchesAllFilters", () => {
  it("test 5: only AVAILABLE 1200 sqft east-facing plots match", () => {
    const filters = parseSearchQuery("1200 east facing");
    expect(matchesAllFilters(plot(), filters)).toBe(true);
    expect(matchesAllFilters(plot({ facing: "W" }), filters)).toBe(false);
    expect(
      matchesAllFilters(plot({ area_official_value: 1500 }), filters),
    ).toBe(false);
    expect(matchesAllFilters(plot({ status: "SOLD" }), filters)).toBe(false);
  });

  it("test 6: only corner plots with a road >= 40 ft match", () => {
    const filters = parseSearchQuery("corner plot 40 ft road");
    expect(
      matchesAllFilters(
        plot({ corner_status: "YES", road_width_primary_ft: 40 }),
        filters,
      ),
    ).toBe(true);
    expect(
      matchesAllFilters(
        plot({ corner_status: "YES", road_width_primary_ft: 30 }),
        filters,
      ),
    ).toBe(false);
    expect(
      matchesAllFilters(
        plot({ corner_status: "NO", road_width_primary_ft: 60 }),
        filters,
      ),
    ).toBe(false);
  });

  it("accepts area within a small tolerance, not just exact equality", () => {
    const filters = parseSearchQuery("1200 sqft");
    expect(
      matchesAllFilters(plot({ area_official_value: 1210 }), filters),
    ).toBe(true);
    expect(
      matchesAllFilters(plot({ area_official_value: 1400 }), filters),
    ).toBe(false);
  });

  it("converts non-sqft units before comparing", () => {
    // 3.2 katha in Bihar ≈ 4356 sqft; searching "1200 sqft" should not match it.
    const filters = parseSearchQuery("1200 sqft");
    expect(
      matchesAllFilters(
        plot({ area_official_value: 3.2, area_official_unit: "katha" }),
        filters,
        "Bihar",
      ),
    ).toBe(false);
  });
});

describe("bestCriterionToRelax (§9.1, §12.2: offer to relax one condition)", () => {
  it("picks the criterion that unblocks the most plots when nothing matches", () => {
    const filters = parseSearchQuery("1200 east corner 40 ft road");
    const plots = [
      plot({ facing: "W", road_width_primary_ft: 40 }), // fails facing + corner
      plot({ corner_status: "NO", road_width_primary_ft: 40 }), // fails only corner
      plot({ corner_status: "NO", road_width_primary_ft: 40 }), // fails only corner
    ];
    expect(plots.every((p) => !matchesAllFilters(p, filters))).toBe(true);
    const relaxed = bestCriterionToRelax(plots, filters);
    expect(relaxed?.criterion).toBe("corner");
    expect(relaxed?.matchCount).toBe(2);
  });
});
