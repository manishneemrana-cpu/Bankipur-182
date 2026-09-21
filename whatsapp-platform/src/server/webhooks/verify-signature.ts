import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies Meta's X-Hub-Signature-256 header against the raw (unparsed) request
 * body, using a constant-time comparison so timing doesn't leak how many bytes
 * matched. The raw body — not a re-serialized JSON object — must be used, since
 * even whitespace differences would produce a different HMAC.
 */
export function verifyMetaSignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;

  const expectedHex = signatureHeader.slice("sha256=".length);
  const computedHex = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");

  const expected = Buffer.from(expectedHex, "hex");
  const computed = Buffer.from(computedHex, "hex");
  if (expected.length !== computed.length) return false;

  return timingSafeEqual(expected, computed);
}
