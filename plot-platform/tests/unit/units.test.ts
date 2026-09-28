import { describe, expect, it } from "vitest";

import {
  AREA_TOLERANCE,
  conversionTable,
  fromSqft,
  relativeDiff,
  toSqft,
} from "@/lib/units/area";

describe("area units (§5.1)", () => {
  it("converts fixed units anywhere", () => {
    const table = conversionTable(null);
    expect(toSqft(1, "acre", table)).toBe(43560);
    expect(toSqft(1, "sqyd", table)).toBe(9);
    expect(fromSqft(900, "sqyd", table)).toBe(100);
  });

  it("only converts regional units when the state has a template", () => {
    expect(toSqft(1, "katha", conversionTable(null))).toBeNull();
    expect(toSqft(1, "katha", conversionTable("Bihar"))).toBeCloseTo(1361.25);
    expect(toSqft(1, "katha", conversionTable("Kerala"))).toBeNull();
  });

  it("an org override wins over the state template", () => {
    const table = conversionTable("Bihar", { katha: 1500 });
    expect(toSqft(1, "katha", table)).toBe(1500);
  });

  it("flags area mismatches beyond the default tolerance", () => {
    expect(relativeDiff(1200, 1250)).toBeLessThan(AREA_TOLERANCE * 3);
    expect(relativeDiff(1200, 1250) > AREA_TOLERANCE).toBe(true);
    expect(relativeDiff(1200, 1205) > AREA_TOLERANCE).toBe(false);
  });
});
