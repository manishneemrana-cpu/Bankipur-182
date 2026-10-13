import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ASPECTS, VideoPropsSchema, type ProjectAssets, type ProjectRow, type VideoProps } from "@ave/shared-types";
import type { StageHandler } from "../pipeline/types.js";
import { repo } from "../lib/repo.js";
import { renderReel, renderThumbnail } from "../render/remotion.js";
import { computeTimeline } from "@ave/video-template";

const MUSIC = ["regal", "serene", "uplift"] as const;

/** Map persisted stage outputs + brand kit onto the Remotion composition props. */
export function buildVideoProps(project: ProjectRow, assets: ProjectAssets): VideoProps {
  const s = project.settingsSnapshot!;
  const i = project.input;
  if (assets.voiceoverDuration == null) throw new Error("render: voiceover stage output missing");
  const kit = s.brandKit;
  return VideoPropsSchema.parse({
    projectName: i.name,
    tagline: i.tagline,
    builderName: kit.builderName,
    mapClipUrl: assets.mapClipUrl ?? null,
    mapClipDuration: assets.mapClipDuration ?? 0,
    cinematicClipUrl: assets.cinematicClipUrl ?? null,
    cinematicClipDuration: assets.cinematicClipDuration ?? 0,
    kenBurnsImageUrl: assets.cinematicClipUrl ? null : (assets.kenBurnsImageUrl ?? null),
    voiceoverUrl: assets.voiceoverUrl ?? null,
    voiceoverDuration: assets.voiceoverDuration,
    logoUrl: kit.logoUrl,
    brandColor: kit.primaryColor,
    accentColor: kit.accentColor,
    contactNumber: kit.contactNumber,
    segments: assets.segments ?? [],
    // stable per-project pick so re-renders keep the same track
    musicTrack: MUSIC[[...project.id].reduce((a, c) => a + c.charCodeAt(0), 0) % MUSIC.length],
    language: i.language,
  });
}

/** Stage 5 — render both aspect ratios server-side with Remotion, upload, record URLs. */
export const renderStage: StageHandler = async (ctx) => {
  // Re-read: sibling stages wrote their outputs after this job was created.
  const project = (await repo.getProject(ctx.project.id))!;
  const props = buildVideoProps(project, project.assets);
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ave-render-"));
  try {
    const videoUrls: ProjectAssets["videoUrls"] = {};
    const total = ASPECTS.length + 1;
    for (const [n, aspect] of ASPECTS.entries()) {
      const out = path.join(tmp, `reel-${aspect.replace(":", "x")}.mp4`);
      await renderReel({ props, aspect, outPath: out, onProgress: (pct) => void ctx.progress(((n + pct / 100) / total) * 100) });
      videoUrls[aspect] = await ctx.save(`reel-${aspect.replace(":", "x")}.mp4`, await fs.readFile(out), "video/mp4");
    }
    const thumb = path.join(tmp, "thumb.jpg");
    await renderThumbnail(props, thumb, Math.round(computeTimeline(props).introFrames + 60));
    const thumbnailUrl = await ctx.save("thumb.jpg", await fs.readFile(thumb), "image/jpeg");
    await repo.patchProject(project.id, { assets: { videoUrls, thumbnailUrl } });
    await ctx.progress(100);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
};
