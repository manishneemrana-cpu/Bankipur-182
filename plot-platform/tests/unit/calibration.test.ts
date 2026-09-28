import { describe, expect, it } from "vitest";

import {
  calibrationScale,
  deriveFacingAndCorner,
  scalePolygon,
} from "@/lib/geometry/calibration";
import type { Polygon } from "@/lib/geometry/types";

describe("calibrationScale", () => {
  it("converts a known pixel distance + real distance into units-per-px", () => {
    // 100px apart on screen, admin says that's really 50 real-world feet.
    const scale = calibrationScale([0, 0], [100, 0], 50);
    expect(scale).toBeCloseTo(0.5);
  });

  it("returns 0 (not NaN/Infinity) for coincident points", () => {
    expect(calibrationScale([10, 10], [10, 10], 50)).toBe(0);
  });
});

describe("scalePolygon", () => {
  it("scales every vertex by the units-per-px factor", () => {
    const poly: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [100, 0],
          [100, 100],
          [0, 100],
          [0, 0],
        ],
      ],
    };
    const scaled = scalePolygon(poly, 0.5);
    expect(scaled.coordinates[0]![2]).toEqual([50, 50]);
  });
});

describe("deriveFacingAndCorner", () => {
  // A square plot in layout (pixel) coords: [0,0]->[10,0]->[10,10]->[0,10].
  const square: Polygon = {
    type: "Polygon",
    coordinates: [
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0],
      ],
    ],
  };

  it("returns UNKNOWN/UNKNOWN when no edge is marked road-facing", () => {
    expect(deriveFacingAndCorner(square, [], 0)).toEqual({
      facing: "UNKNOWN",
      corner: "UNKNOWN",
    });
  });

  it("one road-facing edge -> NO corner, facing from that edge's bearing", () => {
    // Edge 0 is the top edge (0,0)->(10,0): a rightward vector in a y-down
    // system, drawing angle 90° (east on the drawing); north is up (0°), so
    // that edge points due east.
    const result = deriveFacingAndCorner(square, [0], 0);
    expect(result.corner).toBe("NO");
    expect(result.facing).toBe("E");
  });

  it("two road-facing edges -> YES corner (test-12-style: geometry drives the fact, admin marks the evidence)", () => {
    const result = deriveFacingAndCorner(square, [0, 1], 0);
    expect(result.corner).toBe("YES");
  });

  it("north angle rotates the derived facing", () => {
    // Same top edge, but the drawing's "up" is actually east (north rotated
    // 90° clockwise from drawing-up) -> the edge's true bearing shifts.
    const result = deriveFacingAndCorner(square, [0], 90);
    expect(result.facing).not.toBe("E");
  });
});
