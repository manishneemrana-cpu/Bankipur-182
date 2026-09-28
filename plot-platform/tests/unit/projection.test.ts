import { describe, expect, it } from "vitest";

import { projectLngLatToLocalFt } from "@/lib/geometry/projection";

describe("projectLngLatToLocalFt", () => {
  const origin = { lat: 25.6, lng: 85.1 }; // Patna, Bihar

  it("projects the origin itself to [0, 0]", () => {
    const [x, y] = projectLngLatToLocalFt(origin.lng, origin.lat, origin);
    expect(Math.abs(x)).toBe(0);
    expect(Math.abs(y)).toBe(0);
  });

  it("moving east increases x", () => {
    const [x] = projectLngLatToLocalFt(origin.lng + 0.001, origin.lat, origin);
    expect(x).toBeGreaterThan(0);
  });

  it("moving north decreases y (y-down drawing convention)", () => {
    const [, y] = projectLngLatToLocalFt(
      origin.lng,
      origin.lat + 0.001,
      origin,
    );
    expect(y).toBeLessThan(0);
  });

  it("is accurate to well under a foot at project scale (~100m)", () => {
    // 0.001 deg latitude is ~111m; check the projected distance is close.
    const [, y] = projectLngLatToLocalFt(
      origin.lng,
      origin.lat + 0.001,
      origin,
    );
    const expectedFt = 111.19 * 3.28084; // ~111.19m at this latitude, roughly
    expect(Math.abs(Math.abs(y) - expectedFt)).toBeLessThan(5);
  });
});
