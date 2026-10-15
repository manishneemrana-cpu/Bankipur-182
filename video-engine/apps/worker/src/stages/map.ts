import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { FPS } from "@ave/shared-types";
import type { StageHandler } from "../pipeline/types.js";
import { repo } from "../lib/repo.js";
import { generateScript } from "../script/index.js";
import { createMapProvider } from "../providers/map/index.js";
import { captureMapClip } from "../providers/map/capture.js";
import { mapSecondsFor } from "@ave/video-template";
import { mediaDurationFromBytes } from "../lib/duration.js";

const CAPTURE_SIZE = Number(process.env.MAP_CAPTURE_SIZE ?? 1440);

/**
 * Stage 2 — aerial flyby. Runs in parallel with the voiceover, so it sizes the clip from an estimate
 * of the narration length (words / 2.6 per sec); see mapSecondsFor (about 6-10s when photos follow).
 */
export const mapStage: StageHandler = async (ctx) => {
  const { input } = ctx.project;
  const providerId = ctx.settings.providers.map;
  await ctx.setProvider(providerId);
  const words = generateScript(input).text.split(/\s+/).length;
  const estVoice = words / 2.6;
  const durationSec = Math.round(mapSecondsFor(estVoice + 0.8, input.images.length));

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ave-map-"));
  try {
    const out = path.join(tmp, "map.mp4");
    await captureMapClip(
      createMapProvider(providerId),
      {
        lat: input.lat, lng: input.lng, label: input.name, subLabel: input.addressText,
        accent: ctx.settings.brandKit.accentColor, durationSec, fps: FPS, size: CAPTURE_SIZE,
      },
      out,
      (pct) => void ctx.progress(5 + pct * 0.9),
    );
    const bytes = await fs.readFile(out);
    const url = await ctx.save("map.mp4", bytes, "video/mp4");
    const dur = await mediaDurationFromBytes(bytes, "mp4");
    await repo.patchProject(ctx.project.id, { assets: { mapClipUrl: url, mapClipDuration: Math.round(dur * 1000) / 1000 } });
    await ctx.progress(100);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
};
