import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { verifyMetaSignature } from "@/server/webhooks/verify-signature";
import { computeEventHash } from "@/server/webhooks/event-hash";

function sign(body: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
}

describe("verifyMetaSignature", () => {
  const secret = "test-app-secret";
  const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });

  it("accepts a correctly signed body", () => {
    expect(verifyMetaSignature(body, sign(body, secret), secret)).toBe(true);
  });

  it("rejects a body signed with the wrong secret", () => {
    expect(verifyMetaSignature(body, sign(body, "wrong-secret"), secret)).toBe(false);
  });

  it("rejects a tampered body even with a validly-formatted signature", () => {
    const tampered = body + " ";
    expect(verifyMetaSignature(tampered, sign(body, secret), secret)).toBe(false);
  });

  it("rejects a missing signature header", () => {
    expect(verifyMetaSignature(body, null, secret)).toBe(false);
  });

  it("rejects a signature missing the sha256= prefix", () => {
    const raw = createHmac("sha256", secret).update(body, "utf8").digest("hex");
    expect(verifyMetaSignature(body, raw, secret)).toBe(false);
  });

  it("rejects a malformed non-hex signature without throwing", () => {
    expect(() => verifyMetaSignature(body, "sha256=not-hex-!!", secret)).not.toThrow();
    expect(verifyMetaSignature(body, "sha256=not-hex-!!", secret)).toBe(false);
  });
});

describe("computeEventHash", () => {
  it("is deterministic for the same content", () => {
    const body = JSON.stringify({ a: 1 });
    expect(computeEventHash(body)).toBe(computeEventHash(body));
  });

  it("differs for different content", () => {
    expect(computeEventHash("a")).not.toBe(computeEventHash("b"));
  });
});
