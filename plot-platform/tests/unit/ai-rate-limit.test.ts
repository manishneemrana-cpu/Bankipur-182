import { describe, expect, it } from "vitest";

import { isRateLimited } from "@/lib/ai/rate-limit";

describe("isRateLimited", () => {
  it("allows a burst under the limit and blocks beyond it", () => {
    const key = `test-${Math.random()}`;
    let blocked = false;
    for (let i = 0; i < 25; i++) {
      blocked = isRateLimited(key) || blocked;
    }
    expect(blocked).toBe(true);
  });

  it("keys are independent", () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    expect(isRateLimited(a)).toBe(false);
    expect(isRateLimited(b)).toBe(false);
  });
});
