import "dotenv/config";
import { Worker, type Job } from "bullmq";
import { getRedisConnection } from "@/lib/queue/connection";
import { VIDEO_PRODUCTION_QUEUE_NAME } from "@/lib/queue/videoProductionQueue";
import { processVideoProductionJob } from "@/lib/jobs/processVideoProductionJob";
import type { VideoProductionJobData, VideoProductionJobResult } from "@/types/jobs";

/**
 * Long-lived background worker (never inside a Vercel serverless function) so
 * a multi-minute multi-scene generation never hits a request timeout. See
 * src/app/api/worker/tick/route.ts for the on-demand alternative used where
 * no persistent process can run.
 */
async function run(job: Job<VideoProductionJobData>): Promise<VideoProductionJobResult> {
  return processVideoProductionJob(job.data, async (step, progress) => {
    await job.updateProgress({ step, progress });
  });
}

export const videoProductionWorker = new Worker<VideoProductionJobData, VideoProductionJobResult>(
  VIDEO_PRODUCTION_QUEUE_NAME,
  run,
  { connection: getRedisConnection({ forWorker: true }), concurrency: 2 }
);

videoProductionWorker.on("failed", (job, err) => {
  console.error(`[video-production-worker] job ${job?.id} failed:`, err.message);
});
