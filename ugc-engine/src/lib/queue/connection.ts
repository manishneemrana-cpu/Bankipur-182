import type { ConnectionOptions } from "bullmq";

/**
 * Accepts either a single REDIS_URL (as issued by managed providers like
 * Upstash — redis:// or rediss://) or discrete REDIS_HOST/PORT/PASSWORD,
 * so a testing deploy can point at a marketplace Redis add-on without any
 * code changes.
 */
export function getRedisConnection(): ConnectionOptions {
  if (process.env.REDIS_URL) {
    const url = new URL(process.env.REDIS_URL);
    return {
      host: url.hostname,
      port: Number(url.port || 6379),
      password: url.password || undefined,
      tls: url.protocol === "rediss:" ? {} : undefined,
    };
  }

  return {
    host: process.env.REDIS_HOST || "localhost",
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
  };
}
