import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";

const require = createRequire(import.meta.url);

/** ffmpeg binary: FFMPEG_PATH → Remotion's bundled compositor ffmpeg → system ffmpeg. */
export function ffmpegPath(): string {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  const plat = `${process.platform}-${process.arch}`;
  const pkgs: Record<string, string[]> = {
    "linux-x64": ["@remotion/compositor-linux-x64-gnu", "@remotion/compositor-linux-x64-musl"],
    "linux-arm64": ["@remotion/compositor-linux-arm64-gnu", "@remotion/compositor-linux-arm64-musl"],
    "darwin-arm64": ["@remotion/compositor-darwin-arm64"],
    "darwin-x64": ["@remotion/compositor-darwin-x64"],
    "win32-x64": ["@remotion/compositor-win32-x64-msvc"],
  };
  for (const pkg of pkgs[plat] ?? []) {
    try {
      const dir = path.dirname(require.resolve(`${pkg}/package.json`));
      const bin = path.join(dir, process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
      if (fs.existsSync(bin)) return bin;
    } catch { /* not installed */ }
  }
  return "ffmpeg";
}

/** Spawn ffmpeg that reads JPEG frames from stdin and writes an H.264 MP4. */
export function startFrameEncoder(opts: { fps: number; outPath: string }) {
  const proc = spawn(ffmpegPath(), [
    "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(opts.fps), "-c:v", "mjpeg", "-i", "-",
    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", opts.outPath,
  ]);
  let stderr = "";
  proc.stderr.on("data", (d) => (stderr += d));
  const done = new Promise<void>((resolve, reject) => {
    proc.on("error", reject);
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`))));
  });
  return {
    async write(frame: Uint8Array) {
      if (!proc.stdin.write(frame)) await new Promise<void>((r) => proc.stdin.once("drain", r));
    },
    async finish() { proc.stdin.end(); await done; },
    abort() { proc.kill("SIGKILL"); },
  };
}
