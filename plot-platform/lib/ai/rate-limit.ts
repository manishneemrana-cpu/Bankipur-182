import "server-only";

/**
 * Best-effort per-key rate limiter (§12.3). In-memory, so it resets per
 * serverless instance/cold start rather than being a globally accurate
 * limit — good enough to blunt casual abuse, not a substitute for a shared
 * store (Redis/Upstash) if that's needed later at scale.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;

const hits = new Map<string, number[]>();

export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const timestamps = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  timestamps.push(now);
  hits.set(key, timestamps);
  return timestamps.length > MAX_PER_WINDOW;
}
