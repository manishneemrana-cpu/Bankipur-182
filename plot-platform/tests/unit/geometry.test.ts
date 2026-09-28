import { describe, expect, it } from "vitest";

import {
  bearingFromDrawing,
  drawingAngle,
  facingAgrees,
  snapToFacing,
} from "@/lib/geometry/facing";
import {
  isPolygon,
  polygonArea,
  polygonCentroid,
  rect,
} from "@/lib/geometry/polygon";
import type { Polygon } from "@/lib/geometry/types";

describe("polygon geometry", () => {
  it("computes area and centroid of a rectangle", () => {
    const r = rect(0, 0, 10, 20);
    expect(polygonArea(r)).toBeCloseTo(200);
    expect(polygonCentroid(r)).toEqual([5, 10]);
  });

  it("subtracts holes from area", () => {
    const withHole: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
          [0, 0],
        ],
        [
          [2, 2],
          [4, 2],
          [4, 4],
          [2, 4],
          [2, 2],
        ],
      ],
    };
    expect(polygonArea(withHole)).toBeCloseTo(100 - 4);
  });

  it("validates polygon shape", () => {
    expect(isPolygon(rect(0, 0, 1, 1))).toBe(true);
    expect(isPolygon({ type: "Polygon", coordinates: [] })).toBe(false);
    expect(isPolygon({ type: "Point" })).toBe(false);
    expect(isPolygon(null)).toBe(false);
  });
});

describe("facing derivation (§6)", () => {
  it("converts a drawing-up vector to compass bearing with no rotation", () => {
    const angle = drawingAngle(0, -1); // straight up on the drawing
    expect(bearingFromDrawing(angle, 0)).toBeCloseTo(0);
    expect(snapToFacing(bearingFromDrawing(angle, 0))).toBe("N");
  });

  it("rotates by the layout's north angle", () => {
    const angle = drawingAngle(0, -1); // drawing-up
    // North arrow points 90° clockwise from drawing-up -> drawing-up is West.
    expect(snapToFacing(bearingFromDrawing(angle, 90))).toBe("W");
  });

  it("snaps to the nearest of 8 directions", () => {
    expect(snapToFacing(44)).toBe("NE");
    expect(snapToFacing(46)).toBe("NE");
    expect(snapToFacing(359)).toBe("N");
  });

  it("facingAgrees tolerates small disagreement but not a wrong quadrant", () => {
    expect(facingAgrees("N", 5)).toBe(true);
    expect(facingAgrees("N", 30)).toBe(true);
    expect(facingAgrees("N", 90)).toBe(false);
  });
});
