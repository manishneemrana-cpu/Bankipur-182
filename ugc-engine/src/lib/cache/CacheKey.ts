import { createHash } from "crypto";

/**
 * Deterministic cache key for a scene or strategy generation request.
 * Spec section 12: MD5(ProductName + Script + VoiceID + ...). If an
 * identical request repeats with identical continuity settings, the caller
 * can look up this key in generation_jobs/scenes.cache_key and serve the
 * stored asset instead of re-calling a paid generation API.
 */
export function buildCacheKey(parts: Record<string, unknown>): string {
  const normalized = Object.keys(parts)
    .sort()
    .map((k) => `${k}:${JSON.stringify(parts[k])}`)
    .join("|");
  return createHash("md5").update(normalized).digest("hex");
}
