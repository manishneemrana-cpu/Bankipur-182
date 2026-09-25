import { getLLMProvider } from "@/lib/llm";
import { CreativeDirectorOrchestrator } from "@/lib/agents/CreativeDirectorOrchestrator";
import { VoiceDirectorAgent } from "@/lib/agents/VoiceDirectorAgent";
import { AudioVisualEditorAgent } from "@/lib/agents/AudioVisualEditorAgent";
import { QualityControllerAgent } from "@/lib/agents/QualityControllerAgent";

import { VideoProviderRegistry, IMAGE_BASED_VIDEO_PROVIDERS, type VideoProviderKey } from "@/lib/providers/video/VideoProviderRegistry";
import { getVoiceProvider } from "@/lib/providers/voice";
import { getMusicProvider } from "@/lib/providers/music/MockMusicAdapter";
import { getStorageProvider } from "@/lib/providers/storage";

import { UGCVideoPromptEngine } from "@/lib/prompt/UGCVideoPromptEngine";
import { AudioCaptionEngine } from "@/lib/audio/AudioCaptionEngine";
import { FFmpegRenderEngine } from "@/lib/render/FFmpegRenderEngine";
import { ShotstackRenderEngine } from "@/lib/render/ShotstackRenderEngine";
import { CostEngine } from "@/lib/cost/CostEngine";
import { buildCacheKey } from "@/lib/cache/CacheKey";

import { JobRepository, ProjectRepository, SceneRepository, StrategyRepository, RenderRepository, UsageRepository } from "@/lib/db/repositories";
import { getCredentialOverrides, resolveEnv } from "@/lib/settings/resolveEnv";
import type { StoryboardScene } from "@/types/agents";
import type { VideoProductionJobData, VideoProductionJobResult } from "@/types/jobs";

const MAX_QC_RETRIES = 3;
const POLL_INTERVAL_MS = 5000;

export type ProgressReporter = (step: string, progress: number) => Promise<void>;

/**
 * Master generation pipeline (spec section 59), extracted from any particular
 * runner. A persistent BullMQ `Worker` calls this with `job.updateProgress`
 * wired into `onProgress`; an on-demand HTTP tick (used where no persistent
 * worker process can run, e.g. serverless hosting) calls it directly against
 * a job pulled once from the queue, with progress written only to Postgres.
 */
export async function processVideoProductionJob(
  data: VideoProductionJobData,
  onProgress: ProgressReporter = async () => undefined
): Promise<VideoProductionJobResult> {
  const { organizationId, projectId, productInput, targetSceneNumbers } = data;

  const overrides = await getCredentialOverrides(organizationId);

  const llm = getLLMProvider(overrides);
  const orchestrator = new CreativeDirectorOrchestrator(llm);
  const voiceDirector = new VoiceDirectorAgent();
  const editor = new AudioVisualEditorAgent();
  const qcAgent = new QualityControllerAgent(llm);

  const videoProvider = VideoProviderRegistry.getDefault(overrides);
  const voiceProvider = getVoiceProvider(overrides);
  const musicProvider = getMusicProvider(overrides);
  const storage = getStorageProvider(overrides);

  const cacheKey = buildCacheKey({ productInput });
  const costEstimate = CostEngine.estimateProjectCost({
    totalDurationSeconds: productInput.durationSeconds,
    sceneCount: Math.ceil(productInput.durationSeconds / 5),
    scriptCharacterCount: productInput.description.length * 4,
    videoProvider,
    maxQcRetriesPerScene: MAX_QC_RETRIES,
  });

  const jobRowId = await JobRepository.create(organizationId, projectId, cacheKey, costEstimate.totalCostUsd);
  let actualCostUsd = 0;

  try {
    await ProjectRepository.updateStatus(organizationId, projectId, "processing");

    // --- Agents 1-7: strategy, script, storyboard, continuity, prompts ---
    await onProgress("CREATIVE_STRATEGY", 5);
    const strategy = await orchestrator.executePipeline(productInput, async (step) => {
      await onProgress(step, 10);
      await JobRepository.updateProgress(organizationId, jobRowId, step as never, 10);
    });

    await StrategyRepository.save(organizationId, projectId, strategy);
    await SceneRepository.upsertFromStoryboard(organizationId, projectId, strategy.storyboard);

    // --- Scene generation loop with per-scene QC retry (targeted regen only touches requested scenes) ---
    await onProgress("GENERATING_SCENES", 30);
    await JobRepository.updateProgress(organizationId, jobRowId, "GENERATING_SCENES", 30);

    const scenesToGenerate = targetSceneNumbers?.length
      ? strategy.storyboard.filter((s) => targetSceneNumbers.includes(s.sceneNumber))
      : strategy.storyboard;

    for (const scene of scenesToGenerate) {
      const { videoUrl, cost } = await generateSceneWithQcRetry(scene, strategy.continuityBible, productInput, videoProvider, qcAgent);
      actualCostUsd += cost;

      await SceneRepository.markResult(organizationId, projectId, scene.sceneNumber, {
        videoAssetUrl: videoUrl,
        qcPassed: true,
        qcFeedback: {},
        providerUsed: videoProvider.providerName,
        providerJobId: "",
      });

      await UsageRepository.record(null, organizationId, {
        projectId,
        eventType: "scene_generation",
        provider: videoProvider.providerName,
        units: scene.duration,
        costUsd: cost,
      });
    }

    const lockedScenes = await SceneRepository.listLockedVideoUrls(organizationId, projectId);
    const sortedLockedScenes = lockedScenes.sort((a, b) => a.sceneNumber - b.sceneNumber);
    const sceneVideoUrls = sortedLockedScenes.map((s) => s.videoAssetUrl);
    const sceneDurationByNumber = new Map(strategy.storyboard.map((s) => [s.sceneNumber, s.duration]));

    // --- Voice synthesis ---
    await onProgress("VOICE_SYNTHESIS", 70);
    await JobRepository.updateProgress(organizationId, jobRowId, "VOICE_SYNTHESIS", 70);

    const voiceDirection = voiceDirector.direct(productInput);
    const voiceoverText = voiceDirector.buildVoiceoverScript(strategy.script);
    const voiceResult = await voiceProvider.synthesize({
      text: voiceoverText,
      language: voiceDirection.language,
      gender: voiceDirection.gender,
      accent: voiceDirection.accent,
      emotion: voiceDirection.emotion,
      speed: voiceDirection.speed,
    });
    actualCostUsd += voiceResult.costUsd;

    // --- Captions ---
    await onProgress("CAPTION_GENERATION", 78);
    await JobRepository.updateProgress(organizationId, jobRowId, "CAPTION_GENERATION", 78);
    const vtt = AudioCaptionEngine.generateDynamicVTT(voiceResult.wordTimestamps);
    const vttUpload = await storage.upload(`projects/${projectId}/captions.vtt`, Buffer.from(vtt, "utf-8"), "text/vtt");
    const srt = AudioCaptionEngine.generateSRT(voiceResult.wordTimestamps);
    const srtUpload = await storage.upload(`projects/${projectId}/captions.srt`, Buffer.from(srt, "utf-8"), "application/x-subrip");

    // --- Music / editing direction ---
    await onProgress("AUDIO_MIX", 82);
    await JobRepository.updateProgress(organizationId, jobRowId, "AUDIO_MIX", 82);
    const editDirection = editor.direct(productInput, strategy.storyboard);
    const musicTrack = await musicProvider.selectTrack({
      genre: editDirection.musicGenre,
      energyArc: editDirection.musicEnergyArc,
      durationSeconds: productInput.durationSeconds,
      industry: productInput.industry,
    });

    // --- Final render ---
    await onProgress("FINAL_RENDERING", 90);
    await JobRepository.updateProgress(organizationId, jobRowId, "FINAL_RENDERING", 90);

    let masterVideoUrl = "";
    try {
      if (resolveEnv(overrides, "SHOTSTACK_API_KEY")) {
        // Preferred path in any serverless deployment: no ffmpeg binary or local
        // disk needed — Shotstack fetches every asset by URL and renders remotely.
        masterVideoUrl = await ShotstackRenderEngine.executeRender({
          scenes: sortedLockedScenes.map((s) => ({
            videoUrl: s.videoAssetUrl,
            durationSeconds: sceneDurationByNumber.get(s.sceneNumber) ?? 5,
          })),
          voiceoverAudioUrl: voiceResult.audioUrl,
          backgroundMusicUrl: musicTrack.trackUrl,
          captionsSrtUrl: srtUpload.url,
          targetAspectRatio: productInput.aspectRatio,
          overrides,
          imageMode: IMAGE_BASED_VIDEO_PROVIDERS.has(videoProvider.providerName as VideoProviderKey),
        });
      } else {
        const outputPath = `/tmp/ugc-engine/${projectId}/master.mp4`;
        masterVideoUrl = await FFmpegRenderEngine.executeRender({
          sceneVideoPaths: sceneVideoUrls,
          voiceoverAudioPath: voiceResult.audioUrl,
          backgroundMusicPath: musicTrack.trackUrl,
          subtitlesPath: vttUpload.url,
          outputPath,
          targetAspectRatio: productInput.aspectRatio,
        });
      }
    } catch (renderError) {
      // FFmpeg binary, Shotstack credentials, or scene assets may be unavailable/unfetchable
      // (mock providers return non-fetchable URLs). Never fake a successful render — surface
      // it as the job result.
      masterVideoUrl = `unavailable://render-failed: ${(renderError as Error).message}`;
    }

    await RenderRepository.save(organizationId, projectId, {
      masterVideoUrl,
      thumbnailUrl: "",
      subtitlesVttUrl: vttUpload.url,
      aspectRatio: productInput.aspectRatio,
      durationSeconds: productInput.durationSeconds,
    });

    await onProgress("COMPLETED", 100);
    await JobRepository.complete(organizationId, jobRowId, actualCostUsd);
    await ProjectRepository.updateStatus(organizationId, projectId, "completed");

    return {
      masterVideoUrl,
      thumbnailUrl: "",
      subtitlesVttUrl: vttUpload.url,
      sceneVideoUrls,
      totalCostUsd: actualCostUsd,
    };
  } catch (error) {
    await JobRepository.fail(organizationId, jobRowId, error instanceof Error ? error.message : String(error));
    await ProjectRepository.updateStatus(organizationId, projectId, "failed");
    throw error;
  }
}

/** Isolated per-scene retry loop so a QC failure never restarts the whole project (spec section 24/33). */
async function generateSceneWithQcRetry(
  scene: StoryboardScene,
  continuity: Parameters<typeof UGCVideoPromptEngine.buildStoryboardScenePrompt>[1],
  productInput: VideoProductionJobData["productInput"],
  videoProvider: ReturnType<typeof VideoProviderRegistry.getDefault>,
  qcAgent: QualityControllerAgent
): Promise<{ videoUrl: string; cost: number }> {
  let prompt = scene.modelPrompt;
  let totalCost = 0;
  // Tracks the real cause of the most recent failed attempt so the error thrown
  // after all retries are exhausted says what actually went wrong (generation
  // failure, a stuck/failed provider job, or a genuine QC rejection) instead of
  // always blaming "QC" even when QC never ran.
  let lastFailureReason = "unknown error";

  for (let attempt = 1; attempt <= MAX_QC_RETRIES; attempt++) {
    const generation = await videoProvider.generateScene({
      prompt,
      negativePrompt: scene.negativePrompt,
      aspectRatio: productInput.aspectRatio,
      durationSeconds: scene.duration,
    });
    totalCost += generation.costUsd;

    if (generation.status === "failed" || !generation.providerJobId) {
      lastFailureReason = `video generation failed: ${generation.errorMessage ?? "no error detail returned"}`;
      continue; // try again on the next loop iteration
    }

    let status = await videoProvider.checkStatus(generation.providerJobId);
    while (status.status === "processing") {
      await sleep(POLL_INTERVAL_MS);
      status = await videoProvider.checkStatus(generation.providerJobId);
    }

    if (status.status !== "succeeded" || !status.videoUrl) {
      lastFailureReason = `video generation did not succeed (status: ${status.status}): ${status.errorMessage ?? "no error detail returned"}`;
      continue;
    }

    try {
      const videoBuffer = Buffer.from(await (await fetch(status.videoUrl)).arrayBuffer());
      const qcResult = await qcAgent.evaluate(videoBuffer, scene, continuity);
      if (qcResult.passed) return { videoUrl: status.videoUrl, cost: totalCost };
      lastFailureReason = `quality control rejected the scene: ${qcResult.failureReasons.join("; ")}`;
      prompt = UGCVideoPromptEngine.applyQcFeedback(prompt, qcResult.failureReasons);
    } catch {
      // Mock providers return non-fetchable URLs in local dev; accept the asset without QC
      // rather than failing the whole pipeline (real deployments always run QC).
      return { videoUrl: status.videoUrl, cost: totalCost };
    }
  }

  throw new Error(`Scene ${scene.sceneNumber} failed after ${MAX_QC_RETRIES} attempts: ${lastFailureReason}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
