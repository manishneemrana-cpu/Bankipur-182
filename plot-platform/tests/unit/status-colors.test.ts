import { describe, expect, it } from "vitest";

import { PLOT_STATUSES, statusStyle } from "@/lib/map/status-colors";

describe("status colors (§10, §22: color is never the only signal)", () => {
  it("gives every status a distinct fill and a human label", () => {
    const fills = PLOT_STATUSES.map((s) => statusStyle(s).fill);
    expect(new Set(fills).size).toBe(PLOT_STATUSES.length);
    for (const s of PLOT_STATUSES)
      expect(statusStyle(s).label.length).toBeGreaterThan(0);
  });

  it("falls back to Not released for an unrecognized status rather than throwing", () => {
    expect(statusStyle("SOMETHING_NEW").label).toBe("Not released");
  });
});
