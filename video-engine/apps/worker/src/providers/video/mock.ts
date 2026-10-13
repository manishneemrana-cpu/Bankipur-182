import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { ffmpegPath } from "../../lib/ffmpeg.js";
import type { I2VDeps, I2VOptions, ImageToVideoProvider } from "./types.js";

const run = (args: string[]) =>
  new Promise<void>((resolve, reject) => {
    const p = spawn(ffmpegPath(), args);
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", (c) => (c === 0 ? resolve() : reject(new Error(`ffmpeg ${c}: ${err.slice(-400)}`))));
  });

/**
 * Free local stand-in: a slow push-in + drift on the REAL uploaded image (ffmpeg scale+crop), so output
 * quality of the surrounding composition can be judged without paying a video API.
 */
export class MockImageToVideoProvider implements ImageToVideoProvider {
  readonly id = "mock";
  constructor(private deps: I2VDeps) {}
  async generate(imageUrl: string, opts: I2VOptions): Promise<string> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ave-i2v-"));
    try {
      const bytes = await this.deps.fetchBytes(imageUrl);
      // ffmpeg's image demuxer picks the decoder from the extension, so sniff the real type
      const ext = bytes.subarray(0, 4).toString("hex") === "89504e47" ? "png" : bytes.subarray(8, 12).toString() === "WEBP" ? "webp" : "jpg";
      const src = path.join(dir, `in.${ext}`), out = path.join(dir, "out.mp4");
      await fs.writeFile(src, bytes);
      const d = opts.durationSec;
      // The Remotion-bundled ffmpeg has no `zoompan`, so animate with a per-frame scale + crop (push-in with a slight drift).
      const vf = [
        "scale=1800:1800:force_original_aspect_ratio=increase", "crop=1800:1800",
        `scale=w='1800*(1+0.2*t/${d})':h='1800*(1+0.2*t/${d})':eval=frame:flags=bilinear`,
        `crop=1440:1440:'(iw-1440)/2+(t/${d}-0.5)*50':'(ih-1440)/2'`,
        "format=yuv420p",
      ].join(",");
      await run(["-y", "-loglevel", "error", "-loop", "1", "-framerate", "30", "-i", src, "-vf", vf, "-t", String(d), "-c:v", "libx264", "-crf", "18", "-movflags", "+faststart", "-an", out]);
      return await this.deps.saveVideo(await fs.readFile(out));
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  }
}
