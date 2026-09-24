import { NextRequest, NextResponse } from "next/server";
import { getVideoProductionQueue } from "@/lib/queue/videoProductionQueue";
import { assertRedisConfigured } from "@/lib/queue/connection";
import { processVideoProductionJob } from "@/lib/jobs/processVideoProductionJob";
import { errorResponse } from "@/app/api/projects/route";

// Vercel Hobby caps Node functions at 60s unless the project has Fluid
// Compute enabled, which raises this to up to 300s; either way this is the
// most we can ask for from a single request.
export const maxDuration = 300;
const TIME_BUDGET_MS = 280_000;

/**
 * POST /api/worker/tick — on-demand queue drain for deployments with no
 * persistent worker process (e.g. Vercel serverless, where a `Worker` from
 * `src/workers/videoProductionWorker.ts` can never stay running). Pulls and
 * fully processes jobs one at a time until the queue is empty or the
 * function's own time budget runs out, whichever comes first.
 *
 * Protected by WORKER_TICK_SECRET since it executes real (billable)
 * provider calls — never expose it without that header.
 */
export async function POST(req: NextRequest) {
  try {
    const expected = process.env.WORKER_TICK_SECRET;
    if (!expected || req.headers.get("x-worker-secret") !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    assertRedisConfigured();
    const queue = getVideoProductionQueue();
    const deadline = Date.now() + TIME_BUDGET_MS;

    const results: Array<{ jobId: string; status: "completed" | "failed"; error?: string }> = [];

    while (Date.now() < deadline) {
      const [job] = await queue.getJobs(["waiting", "delayed"], 0, 0);
      if (!job) break;

      await job.remove().catch(() => undefined);

      try {
        await processVideoProductionJob(job.data);
        results.push({ jobId: String(job.id), status: "completed" });
      } catch (error) {
        results.push({ jobId: String(job.id), status: "failed", error: error instanceof Error ? error.message : String(error) });
      }
    }

    const remaining = await queue.getWaitingCount();
    return NextResponse.json({ processed: results.length, results, remainingInQueue: remaining });
  } catch (error) {
    return errorResponse(error);
  }
}
