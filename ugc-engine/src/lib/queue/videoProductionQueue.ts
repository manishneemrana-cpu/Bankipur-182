import { Queue } from "bullmq";
import { getRedisConnection } from "./connection";
import type { VideoProductionJobData } from "@/types/jobs";

export const VIDEO_PRODUCTION_QUEUE_NAME = "video-production-queue";

let queue: Queue<VideoProductionJobData> | null = null;

/**
 * Lazily-created singleton so importing this module in a Next.js API route
 * (short-lived serverless request) never blocks on a Redis connection that
 * isn't needed for read-only paths (spec section 34: async job dispatch,
 * never block a request on a long-running generation operation).
 */
export function getVideoProductionQueue(): Queue<VideoProductionJobData> {
  if (!queue) {
    queue = new Queue<VideoProductionJobData>(VIDEO_PRODUCTION_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 1, // retries are handled per-scene inside the worker, not at the job level
        removeOnComplete: { age: 60 * 60 * 24 * 7 },
        removeOnFail: { age: 60 * 60 * 24 * 30 },
      },
    });
  }
  return queue;
}
