import type { ConnectionOptions } from "bullmq";

/**
 * Accepts either a single REDIS_URL (as issued by managed providers like
 * Upstash — redis:// or rediss://) or discrete REDIS_HOST/PORT/PASSWORD,
 * so a testing deploy can point at a marketplace Redis add-on without any
 * code changes.
 */
/** True only when a real Redis target is configured — never assume localhost is reachable in a serverless deployment. */
export function isRedisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL || process.env.REDIS_HOST);
}

export class RedisNotConfiguredError extends Error {
  constructor() {
    super(
      "Redis is not configured (REDIS_URL / REDIS_HOST unset), so the generation queue can't accept jobs yet. " +
        "Add a Redis instance (e.g. Upstash via the Vercel Storage tab) and set REDIS_URL, then redeploy."
    );
  }
}

/** Call before touching the queue from an API route — fails in milliseconds instead of a 300s platform timeout. */
export function assertRedisConfigured(): void {
  if (!isRedisConfigured()) throw new RedisNotConfiguredError();
}

/**
 * `forWorker: true` must be used for BullMQ `Worker` connections — BullMQ
 * requires `maxRetriesPerRequest: null` there for its blocking commands.
 * Everywhere else (the `Queue` used from API routes) fails fast instead of
 * retrying for minutes, since a serverless request has a hard execution
 * limit and a hung Redis connection should never eat the whole budget.
 */
export function getRedisConnection(opts: { forWorker?: boolean } = {}): ConnectionOptions {
  const base = opts.forWorker
    ? { maxRetriesPerRequest: null }
    : { connectTimeout: 5000, maxRetriesPerRequest: 1 };

  if (process.env.REDIS_URL) {
    const url = new URL(process.env.REDIS_URL);
    return {
      ...base,
      host: url.hostname,
      port: Number(url.port || 6379),
      password: url.password || undefined,
      tls: url.protocol === "rediss:" ? {} : undefined,
    };
  }

  return {
    ...base,
    host: process.env.REDIS_HOST || "localhost",
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
  };
}
