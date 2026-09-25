import type { AspectRatio } from "@/types/project";
import { resolveEnv, type EnvOverrides } from "@/lib/settings/resolveEnv";

export interface ShotstackScene {
  videoUrl: string;
  durationSeconds: number;
}

export interface ShotstackRenderConfig {
  scenes: ShotstackScene[];
  voiceoverAudioUrl: string;
  backgroundMusicUrl?: string;
  captionsSrtUrl?: string;
  targetAspectRatio: AspectRatio;
  overrides?: EnvOverrides;
}

const OUTPUT_SIZE: Record<AspectRatio, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
  "1:1": { width: 1080, height: 1080 },
};

const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 240_000;

/**
 * Cloud video assembly via Shotstack (https://shotstack.io) — an alternative
 * to FFmpegRenderEngine for deployments where the ffmpeg binary isn't
 * available (any Vercel serverless function). Shotstack fetches every asset
 * by URL itself and renders remotely, so this needs no local disk or binary
 * at all — only the scene/voice/music/caption URLs already produced earlier
 * in the pipeline, which must be publicly fetchable (real storage, not
 * MockStorageAdapter's fake `mock-storage.local` URLs).
 */
export class ShotstackRenderEngine {
  private static baseUrl(overrides: EnvOverrides): string {
    const env = resolveEnv(overrides, "SHOTSTACK_ENV") || "stage"; // "stage" = free sandbox (watermarked); "v1" = production
    return `https://api.shotstack.io/${env}`;
  }

  private static apiKey(overrides: EnvOverrides): string {
    const key = resolveEnv(overrides, "SHOTSTACK_API_KEY");
    if (!key) throw new Error("SHOTSTACK_API_KEY is not set.");
    return key;
  }

  public static async executeRender(config: ShotstackRenderConfig): Promise<string> {
    const overrides = config.overrides ?? {};
    const totalDuration = config.scenes.reduce((sum, s) => sum + s.durationSeconds, 0);
    const size = OUTPUT_SIZE[config.targetAspectRatio];

    let cursor = 0;
    const videoClips = config.scenes.map((scene) => {
      const clip = {
        asset: { type: "video", src: scene.videoUrl },
        start: cursor,
        length: scene.durationSeconds,
        fit: "crop",
      };
      cursor += scene.durationSeconds;
      return clip;
    });

    const tracks: unknown[] = [];
    if (config.captionsSrtUrl) {
      tracks.push({
        clips: [
          {
            asset: { type: "caption", src: config.captionsSrtUrl, font: { color: "#ffffff", size: 32 } },
            start: 0,
            length: totalDuration,
          },
        ],
      });
    }
    tracks.push({ clips: videoClips });
    tracks.push({
      clips: [{ asset: { type: "audio", src: config.voiceoverAudioUrl }, start: 0, length: totalDuration }],
    });

    const edit = {
      timeline: {
        ...(config.backgroundMusicUrl
          ? { soundtrack: { src: config.backgroundMusicUrl, effect: "fadeInFadeOut", volume: 0.15 } }
          : {}),
        background: "#000000",
        tracks,
      },
      output: { format: "mp4", size },
    };

    const submitRes = await fetch(`${this.baseUrl(overrides)}/render`, {
      method: "POST",
      headers: { "x-api-key": this.apiKey(overrides), "Content-Type": "application/json" },
      body: JSON.stringify(edit),
    });
    if (!submitRes.ok) {
      throw new Error(`Shotstack render submission failed (${submitRes.status}): ${await submitRes.text()}`);
    }
    const submitBody = await submitRes.json();
    const renderId = submitBody?.response?.id;
    if (!renderId) throw new Error(`Shotstack did not return a render id: ${JSON.stringify(submitBody)}`);

    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);
      const statusRes = await fetch(`${this.baseUrl(overrides)}/render/${renderId}`, {
        headers: { "x-api-key": this.apiKey(overrides) },
      });
      if (!statusRes.ok) continue;
      const statusBody = await statusRes.json();
      const status = statusBody?.response?.status;
      if (status === "done") return statusBody.response.url as string;
      if (status === "failed") {
        throw new Error(`Shotstack render failed: ${statusBody?.response?.error ?? "unknown error"}`);
      }
      // queued | fetching | rendering | saving — keep polling
    }
    throw new Error(`Shotstack render ${renderId} did not finish within ${POLL_TIMEOUT_MS / 1000}s.`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
