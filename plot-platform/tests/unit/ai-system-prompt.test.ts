import { describe, expect, it } from "vitest";

import { buildSystemPrompt } from "@/lib/ai/system-prompt";

describe("buildSystemPrompt", () => {
  const prompt = buildSystemPrompt({
    name: "Green Valley",
    city: "Patna",
    state: "Bihar",
  });

  it("includes the project name so replies are project-specific", () => {
    expect(prompt).toContain("Green Valley");
  });

  it("encodes §12.2's hard rules (rule 11 red-team behaviors)", () => {
    expect(prompt).toMatch(/never say a plot is available/i);
    expect(prompt).toMatch(/never invent or estimate prices/i);
    expect(prompt).toMatch(/never predict price appreciation/i);
    expect(prompt).toMatch(/never give legal opinions/i);
    expect(prompt).toMatch(/competitors/i);
    expect(prompt).toMatch(/consent/i);
    expect(prompt).toMatch(/do not rank plots/i);
  });

  it("never mentions a platform brand name (rule 1: white-label)", () => {
    expect(prompt.toLowerCase()).not.toContain("plot platform");
  });
});
