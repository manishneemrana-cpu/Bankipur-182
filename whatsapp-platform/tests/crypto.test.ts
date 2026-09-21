import "dotenv/config";
import { describe, expect, it } from "vitest";
import { encryptToken, decryptToken } from "@/server/crypto";

describe("token encryption", () => {
  it("round-trips a plaintext token", () => {
    const payload = encryptToken("super-secret-access-token");
    expect(payload.ciphertext).not.toContain("super-secret-access-token");
    expect(decryptToken(payload)).toBe("super-secret-access-token");
  });

  it("produces different ciphertext for the same plaintext each time (random IV)", () => {
    const a = encryptToken("same-token");
    const b = encryptToken("same-token");
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(decryptToken(a)).toBe("same-token");
    expect(decryptToken(b)).toBe("same-token");
  });

  it("refuses to decrypt a payload tagged with a different key version", () => {
    const payload = encryptToken("token");
    expect(() => decryptToken({ ...payload, keyVersion: payload.keyVersion + 1 })).toThrow(/key version/);
  });

  it("fails decryption if the ciphertext is tampered with (GCM auth tag check)", () => {
    const payload = encryptToken("token");
    const tampered = { ...payload, ciphertext: payload.ciphertext.slice(0, -4) + "abcd" };
    expect(() => decryptToken(tampered)).toThrow();
  });
});
