import { FlowProducer, Queue, QueueEvents, Worker, type Job } from "bullmq";
import type { Stage, StageJobData } from "@ave/shared-types";
import { STAGES } from "@ave/shared-types";
import { config } from "../config.js";
import { connection } from "../lib/redis.js";
import { log } from "../lib/logger.js";
import { repo } from "../lib/repo.js";
import { storage } from "../lib/storage.js";
import type { StageContext, StageHandler } from "./types.js";
import { notifyProjectResult } from "../lib/notify.js";

export const queueName = (s: Stage) => `ave-${s}`;
const ATTEMPTS: Record<Stage, number> = { voiceover: 3, map: 2, cinematic: 2, render: 2 };

let flow: FlowProducer | undefined;
const queues = new Map<Stage, Queue>();
export const getQueue = (s: Stage) => {
  let q = queues.get(s);
  if (!q) queues.set(s, (q = new Queue(queueName(s), { connection: connection() })));
  return q;
};

/**
 * Enqueue the whole pipeline as a BullMQ flow:
 *
 *   render  ← waits for →  voiceover (script + TTS)
 *                          map       (Puppeteer capture)
 *                          cinematic (image-to-video | skipped -> Ken Burns at render)
 *
 * Stages 1-3 are independent so they run in parallel; render starts only when all succeed.
 */
export async function enqueuePipeline(projectId: string): Promise<void> {
  const project = await repo.getProject(projectId);
  if (!project) throw new Error("project not found");
  const settings = project.settingsSnapshot!;

  const rows = {} as Record<Stage, string>;
  for (const stage of STAGES) {
    const provider = stage === "voiceover" ? settings.providers.tts : stage === "map" ? settings.providers.map : stage === "cinematic" ? settings.providers.video : null;
    rows[stage] = (await repo.createJob(projectId, stage, provider)).id;
  }
  const node = (stage: Stage, children?: any[]) => ({
    name: stage,
    queueName: queueName(stage),
    data: { projectId, stage, jobRowId: rows[stage] } satisfies StageJobData,
    opts: {
      attempts: ATTEMPTS[stage],
      backoff: { type: "exponential" as const, delay: 5000 },
      removeOnComplete: { age: 86400 },
      removeOnFail: { age: 7 * 86400 },
      failParentOnFailure: stage !== "render",
    },
    children,
  });
  flow ??= new FlowProducer({ connection: connection() });
  await repo.patchProject(projectId, { status: "queued", error: null });
  await flow.add(node("render", [node("voiceover"), node("map"), node("cinematic")]));
}

export function startWorkers(handlers: Record<Stage, StageHandler>) {
  const workers: Worker[] = [];
  for (const stage of STAGES) {
    const concurrency = stage === "render" ? 1 : config.WORKER_CONCURRENCY;
    const w = new Worker<StageJobData>(
      queueName(stage),
      (job) => runStage(job, handlers[stage]),
      // Render + map capture can run for minutes; keep the lock alive.
      { connection: connection(), concurrency, lockDuration: 10 * 60_000 },
    );
    w.on("failed", (job, err) => void onFailed(job, err));
    w.on("error", (err) => log.error({ err, stage }, "worker error"));
    workers.push(w);
  }
  return workers;
}

async function runStage(job: Job<StageJobData>, handler: StageHandler) {
  const { projectId, stage, jobRowId } = job.data;
  const project = await repo.getProject(projectId);
  if (!project || !project.settingsSnapshot) throw new Error(`project ${projectId} missing`);
  let skipped = false;
  await repo.patchJob(jobRowId, {
    status: "processing", progress: 1, error: null, attempts: job.attemptsMade + 1,
    startedAt: new Date().toISOString(), finishedAt: null, bullJobId: job.id ?? null,
  });
  await repo.patchProject(projectId, { status: "processing" });

  const prefix = `${project.accountId}/${projectId}`;
  const ctx: StageContext = {
    project, settings: project.settingsSnapshot, stage,
    progress: (pct) => repo.patchJob(jobRowId, { progress: Math.max(0, Math.min(100, Math.round(pct))) }),
    save: (name, data, ct) => storage.put(`${prefix}/${Date.now()}-${name}`, data, ct),
    setProvider: (id) => repo.patchJob(jobRowId, { provider: id }),
    skip: async (reason) => {
      skipped = true;
      await repo.patchJob(jobRowId, { status: "skipped", progress: 100, error: reason, finishedAt: new Date().toISOString() });
    },
  };
  log.info({ projectId, stage, attempt: job.attemptsMade + 1 }, "stage start");
  await handler(ctx);
  if (!skipped) await repo.patchJob(jobRowId, { status: "done", progress: 100, finishedAt: new Date().toISOString() });
  log.info({ projectId, stage, skipped }, "stage end");

  if (stage === "render") {
    const p = await repo.getProject(projectId);
    await repo.patchProject(projectId, { status: "done", error: null });
    if (p) await notifyProjectResult(p, "project_done");
  }
}

async function onFailed(job: Job<StageJobData> | undefined, err: Error) {
  if (!job) return;
  const { projectId, stage, jobRowId } = job.data;
  const final = job.attemptsMade >= (job.opts.attempts ?? 1);
  log.error({ projectId, stage, err: err.message, final }, "stage failed");
  // Parent-failure cascades (failParentOnFailure) surface as render failing with a dependency error.
  if (!final) {
    await repo.patchJob(jobRowId, { status: "queued", error: `Attempt ${job.attemptsMade} failed: ${err.message}. Retrying…` });
    return;
  }
  await repo.patchJob(jobRowId, { status: "failed", error: err.message, finishedAt: new Date().toISOString() });
  const p = await repo.getProject(projectId);
  if (p && p.status !== "failed") {
    await repo.patchProject(projectId, { status: "failed", error: `${stage}: ${err.message}` });
    await notifyProjectResult({ ...p, error: `${stage}: ${err.message}` }, "project_failed");
  }
}

export async function closeQueues() {
  await Promise.all([...queues.values()].map((q) => q.close()));
  await flow?.close();
}
export { QueueEvents };
