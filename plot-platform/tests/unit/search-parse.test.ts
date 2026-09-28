import { describe, expect, it } from "vitest";

import { filtersToChips, parseSearchQuery } from "@/lib/search/parse";

describe("parseSearchQuery (§4, §12.4)", () => {
  it("parses the spec's own example end to end", () => {
    const f = parseSearchQuery("1200 east corner 30 ft road under 40 lakh");
    expect(f.areaValue).toBe(1200);
    expect(f.areaUnit).toBe("sqft");
    expect(f.facing).toEqual(["E"]);
    expect(f.corner).toBe(true);
    expect(f.minRoadWidthFt).toBe(30);
    expect(f.maxPriceInr).toBe(40 * 100_000);
  });

  it("test 5: '1200 east facing'", () => {
    const f = parseSearchQuery("1200 east facing");
    expect(f.areaValue).toBe(1200);
    expect(f.facing).toEqual(["E"]);
  });

  it("test 6: 'corner plot 40 ft road'", () => {
    const f = parseSearchQuery("corner plot 40 ft road");
    expect(f.corner).toBe(true);
    expect(f.minRoadWidthFt).toBe(40);
    expect(f.areaValue).toBeUndefined();
  });

  it("distinguishes north from north-east", () => {
    expect(parseSearchQuery("north east plot").facing).toEqual(["NE"]);
    expect(parseSearchQuery("north facing plot").facing).toEqual(["N"]);
  });

  it("handles crore and compact 'L' price notation", () => {
    expect(parseSearchQuery("under 1.2 crore").maxPriceInr).toBe(
      1.2 * 1_00_00_000,
    );
    expect(parseSearchQuery("under 25L").maxPriceInr).toBe(25 * 100_000);
  });

  it("recognizes non-sqft area units", () => {
    const f = parseSearchQuery("3 katha plot");
    expect(f.areaValue).toBe(3);
    expect(f.areaUnit).toBe("katha");
  });

  it("produces removable, human-readable chips", () => {
    const chips = filtersToChips(
      parseSearchQuery("1200 east corner 30 ft road under 40 lakh"),
    );
    expect(chips.map((c) => c.key)).toEqual([
      "areaValue",
      "facing",
      "corner",
      "minRoadWidthFt",
      "maxPriceInr",
    ]);
    expect(chips.find((c) => c.key === "maxPriceInr")?.label).toContain("40");
  });

  it("never throws on empty or nonsense input", () => {
    expect(() => parseSearchQuery("")).not.toThrow();
    expect(() => parseSearchQuery("asdkjhaskjdh")).not.toThrow();
  });
});
