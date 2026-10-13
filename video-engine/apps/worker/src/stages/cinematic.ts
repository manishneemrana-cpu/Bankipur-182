import type { StageHandler } from "../pipeline/types.js";
import { repo } from "../lib/repo.js";
import { storage } from "../lib/storage.js";
import { mediaDurationFromBytes } from "../lib/duration.js";
import { log } from "../lib/logger.js";
import { PaidApiNotImplemented } from "../lib/paid.js";
import { CINEMATIC_PROMPT, createImageToVideoProvider } from "../providers/video/index.js";

const CLIP_SECONDS = 6; // within the 4-8s brief

/**
 * Stage 3 — cinematic building shot.
 *  - elevation image present  -> image-to-video provider (VIDEO_PROVIDER / Settings)
 *  - no elevation image       -> skipped; the composition runs a local Ken Burns pan/zoom on the
 *                                site-layout (or first) image instead — zero API cost
 *  - provider runtime failure -> same Ken Burns fallback on the elevation image, so an optional,
 *                                paid stage never sinks the whole video. Config errors still fail loudly.
 */
export const cinematicStage: StageHandler = async (ctx) => {
  const { images } = ctx.project.input;
  const elevation = images.find((i) => i.role === "elevation");
  const kenBurnsSource = (elevation ?? images.find((i) => i.role === "site_layout") ?? images[0])?.url ?? null;

  if (!elevation) {
    await repo.patchProject(ctx.project.id, { assets: { cinematicClipUrl: null, kenBurnsImageUrl: kenBurnsSource } });
    return ctx.skip(kenBurnsSource ? "No elevation image — using Ken Burns pan/zoom on the uploaded image" : "No images uploaded — branded background used");
  }

  const providerId = ctx.settings.providers.video;
  await ctx.setProvider(providerId);
  await ctx.progress(10);
  try {
    const provider = createImageToVideoProvider(providerId, {
      saveVideo: (bytes) => ctx.save("cinematic.mp4", bytes, "video/mp4"),
      fetchBytes: (url) => storage.fetchBytes(url),
    });
    const url = await provider.generate(elevation.url, { durationSec: CLIP_SECONDS, prompt: CINEMATIC_PROMPT, aspect: "1:1" });
    await ctx.progress(85);
    const dur = await mediaDurationFromBytes(await storage.fetchBytes(url), "mp4");
    await repo.patchProject(ctx.project.id, { assets: { cinematicClipUrl: url, cinematicClipDuration: Math.round(dur * 1000) / 1000, kenBurnsImageUrl: null } });
    await ctx.progress(100);
  } catch (err) {
    if (err instanceof PaidApiNotImplemented) throw err;
    log.warn({ err, projectId: ctx.project.id }, "image-to-video failed; falling back to Ken Burns");
    await repo.patchProject(ctx.project.id, { assets: { cinematicClipUrl: null, kenBurnsImageUrl: elevation.url } });
    await ctx.skip(`${providerId} failed (${(err as Error).message}) — used Ken Burns fallback`);
  }
};
