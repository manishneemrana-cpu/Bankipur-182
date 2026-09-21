import "dotenv/config";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { normalizeGraphError, MetaApiError } from "@/server/meta/errors";

describe("normalizeGraphError", () => {
  it("maps an expired/invalid token to TOKEN_EXPIRED", () => {
    const err = normalizeGraphError(401, { error: { message: "Invalid token", code: 190 } });
    expect(err).toBeInstanceOf(MetaApiError);
    expect(err.code).toBe("TOKEN_EXPIRED");
  });

  it("maps a permission error to PERMISSION_DENIED", () => {
    const err = normalizeGraphError(403, { error: { message: "Permission denied", code: 200 } });
    expect(err.code).toBe("PERMISSION_DENIED");
  });

  it("maps a rate limit response to RATE_LIMITED", () => {
    const err = normalizeGraphError(429, { error: { message: "Too many requests", code: 4 } });
    expect(err.code).toBe("RATE_LIMITED");
  });

  it("maps a template rejection code to TEMPLATE_REJECTED", () => {
    const err = normalizeGraphError(400, { error: { message: "Template paused", code: 132001 } });
    expect(err.code).toBe("TEMPLATE_REJECTED");
  });

  it("maps a 404 to WABA_NOT_FOUND", () => {
    const err = normalizeGraphError(404, { error: { message: "Not found", code: 100 } });
    expect(err.code).toBe("WABA_NOT_FOUND");
  });

  it("falls back to UNKNOWN for an unrecognized error shape", () => {
    const err = normalizeGraphError(500, { error: { message: "Something else", code: 99999 } });
    expect(err.code).toBe("UNKNOWN");
  });

  it("gives every normalized error a support-friendly id", () => {
    const err = normalizeGraphError(500, undefined);
    expect(err.supportId).toMatch(/^META-UNKNOWN-/);
  });
});

describe("Meta client in mock mode", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetModules();
    process.env.MOCK_META = "true";
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("never calls fetch and returns a mock message id", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const { sendTextMessage } = await import("@/server/meta/client");
    const result = await sendTextMessage({
      phoneNumberId: "123",
      accessToken: "token",
      to: "+911234567890",
      body: "hello",
      idempotencyKey: "test-key-1",
    });

    expect(result.mock).toBe(true);
    expect(result.metaMessageId).toBe("mock.test-key-1");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("throws if getMetaConfig() is called directly while MOCK_META=true", async () => {
    const { getMetaConfig } = await import("@/server/meta/config");
    expect(() => getMetaConfig()).toThrow(/MOCK_META=true/);
  });
});
