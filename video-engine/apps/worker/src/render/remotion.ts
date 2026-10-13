import fs from "node:fs/promises";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { COMPOSITION_IDS, ENTRY_POINT, PUBLIC_DIR } from "@ave/video-template";
import type { Aspect, VideoProps } from "@ave/shared-types";
import { config } from "../config.js";
import { findHeadlessShell } from "../lib/chrome.js";
import { log } from "../lib/logger.js";

let serveUrlP: Promise<string> | undefined;

/** Bundle the Remotion project once per process (≈20-40s cold); reused by every render. */
export function getServeUrl(): Promise<string> {
  serveUrlP ??= (async () => {
    const t = Date.now();
    const outDir = path.join(config.LOCAL_DATA_DIR, "remotion-bundle");
    await fs.mkdir(outDir, { recursive: true });
    const url = await bundle({ entryPoint: ENTRY_POINT, publicDir: PUBLIC_DIR, outDir });
    log.info({ ms: Date.now() - t }, "remotion bundle ready");
    return url;
  })();
  serveUrlP.catch(() => { serveUrlP = undefined; });
  return serveUrlP;
}

const browser = () => ({
  browserExecutable: findHeadlessShell() ?? null,
  chromiumOptions: { disableWebSecurity: false, ignoreCertificateErrors: false },
});

export async function renderReel(opts: { props: VideoProps; aspect: Aspect; outPath: string; onProgress?: (pct: number) => void }) {
  const serveUrl = await getServeUrl();
  const id = opts.aspect === "9:16" ? COMPOSITION_IDS.portrait : COMPOSITION_IDS.landscape;
  const inputProps = opts.props as unknown as Record<string, unknown>;
  const composition = await selectComposition({ serveUrl, id, inputProps, ...browser() });
  await renderMedia({
    composition, serveUrl, inputProps,
    codec: "h264", crf: 20, pixelFormat: "yuv420p",
    outputLocation: opts.outPath,
    concurrency: config.RENDER_CONCURRENCY,
    timeoutInMilliseconds: 120_000,
    onProgress: ({ progress }) => opts.onProgress?.(progress * 100),
    ...browser(),
  });
  return { frames: composition.durationInFrames, fps: composition.fps };
}

export async function renderThumbnail(props: VideoProps, outPath: string, frame: number) {
  const serveUrl = await getServeUrl();
  const inputProps = props as unknown as Record<string, unknown>;
  const composition = await selectComposition({ serveUrl, id: COMPOSITION_IDS.landscape, inputProps, ...browser() });
  await renderStill({ composition, serveUrl, inputProps, output: outPath, frame: Math.min(frame, composition.durationInFrames - 1), imageFormat: "jpeg", jpegQuality: 85, ...browser() });
}

/** Render one of the built-in placeholder compositions (also the mock cinematic provider's output). */
export async function renderPlaceholder(kind: "map" | "building", outPath: string) {
  const serveUrl = await getServeUrl();
  const id = kind === "map" ? "Placeholder-map" : "Placeholder-building";
  const composition = await selectComposition({ serveUrl, id, inputProps: { kind }, ...browser() });
  await renderMedia({ composition, serveUrl, inputProps: { kind }, codec: "h264", outputLocation: outPath, concurrency: config.RENDER_CONCURRENCY, ...browser() });
  return composition.durationInFrames / composition.fps;
}
