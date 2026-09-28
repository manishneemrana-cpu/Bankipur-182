import { describe, expect, it } from "vitest";

import { plotShareText, whatsAppUrl } from "@/lib/messaging/whatsapp";

describe("plotShareText (§13, test 14)", () => {
  it("builds text from DB values including the deep link", () => {
    const text = plotShareText({
      plotNumber: "P-118",
      projectName: "Green Valley Enclave",
      areaValue: 1520,
      areaUnit: "sqft",
      facing: "NE",
      roadWidthFt: 30,
      deepLink: "https://example.com/p/green-valley/plot/P-118",
    });
    expect(text).toContain("Plot P-118");
    expect(text).toContain("Green Valley Enclave");
    expect(text).toContain("1520 sqft");
    expect(text).toContain("NE");
    expect(text).toContain("30 ft");
    expect(text).toContain("https://example.com/p/green-valley/plot/P-118");
  });

  it("omits facts that are not provided rather than fabricating them", () => {
    const text = plotShareText({
      plotNumber: "P-1",
      projectName: "X",
      areaValue: null,
      areaUnit: null,
      facing: "UNKNOWN",
      roadWidthFt: null,
      deepLink: "https://example.com/p/x/plot/P-1",
    });
    expect(text).not.toContain("Area:");
    expect(text).not.toContain("Facing:");
    expect(text).not.toContain("Road:");
  });
});

describe("whatsAppUrl", () => {
  it("builds a wa.me link with URL-encoded text", () => {
    const url = whatsAppUrl("+91 98765 43210", "Hello there");
    expect(url).toBe("https://wa.me/919876543210?text=Hello%20there");
  });

  it("falls back to a bare wa.me link when no phone is known", () => {
    expect(whatsAppUrl(undefined, "hi")).toBe("https://wa.me/?text=hi");
  });
});
