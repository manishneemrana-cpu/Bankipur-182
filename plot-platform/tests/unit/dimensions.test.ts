import { describe, expect, it } from "vitest";

import { edgeDimensions } from "@/lib/geometry/dimensions";
import { rect } from "@/lib/geometry/polygon";

describe("edgeDimensions (§10.1 dimension lines)", () => {
  it("returns one entry per edge, with correct lengths", () => {
    const dims = edgeDimensions(rect(0, 0, 30, 40));
    expect(dims).toHaveLength(4);
    const lengths = dims.map((d) => d.lengthLayoutUnits).sort((a, b) => a - b);
    expect(lengths).toEqual([30, 30, 40, 40]);
  });

  it("offsets labels outward from the centroid", () => {
    const [top] = edgeDimensions(rect(0, 0, 10, 10), 5);
    // Top edge (0,0)-(10,0): centroid is at (5,5), so the label should sit
    // above the edge (smaller y), not inside the polygon.
    expect(top!.labelPos[1]).toBeLessThan(0);
  });

  it("keeps label rotation within ±90° so text never reads upside down", () => {
    for (const d of edgeDimensions(rect(0, 0, 10, 10))) {
      expect(d.angleDeg).toBeGreaterThanOrEqual(-90);
      expect(d.angleDeg).toBeLessThanOrEqual(90);
    }
  });
});
