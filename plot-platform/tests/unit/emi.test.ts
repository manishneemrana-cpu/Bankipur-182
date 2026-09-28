import { describe, expect, it } from "vitest";

import { calculateEmi, totalCostEstimate } from "@/lib/finance/emi";

describe("EMI calculator (§9.10, indicative only)", () => {
  it("matches the standard reducing-balance formula for a known case", () => {
    // ₹10,00,000 at 9% for 15 years ≈ ₹10,142.67/month (verified externally).
    const { monthlyEmi } = calculateEmi({
      principal: 1_000_000,
      annualRatePercent: 9,
      tenureYears: 15,
    });
    expect(monthlyEmi).toBeCloseTo(10142.67, 1);
  });

  it("handles a 0% rate as a plain amortization (no division by zero)", () => {
    const { monthlyEmi } = calculateEmi({
      principal: 120_000,
      annualRatePercent: 0,
      tenureYears: 10,
    });
    expect(monthlyEmi).toBeCloseTo(1000, 2);
  });

  it("returns zeros for a non-positive principal or tenure instead of NaN", () => {
    expect(
      calculateEmi({ principal: 0, annualRatePercent: 9, tenureYears: 15 })
        .monthlyEmi,
    ).toBe(0);
    expect(
      calculateEmi({ principal: 100, annualRatePercent: 9, tenureYears: 0 })
        .monthlyEmi,
    ).toBe(0);
  });

  it("totalCostEstimate adds PLC and percentage charges", () => {
    const total = totalCostEstimate(1_000_000, {
      plcTotal: 50_000,
      developmentPercent: 5,
      registrationPercent: 7,
    });
    expect(total).toBe(1_000_000 + 50_000 + 50_000 + 70_000);
  });
});
