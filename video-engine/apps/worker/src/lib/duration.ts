import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseMedia } from "@remotion/media-parser";
import { nodeReader } from "@remotion/media-parser/node";

/** Duration in seconds of audio/video bytes (mp3, wav, mp4, …). No ffprobe dependency. */
export async function mediaDurationFromBytes(bytes: Buffer, ext: string): Promise<number> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ave-probe-"));
  const file = path.join(dir, `in.${ext}`);
  try {
    await fs.writeFile(file, bytes);
    const r = await parseMedia({ src: file, reader: nodeReader, fields: { durationInSeconds: true }, acknowledgeRemotionLicense: true });
    if (r.durationInSeconds == null) throw new Error("no duration in media");
    return r.durationInSeconds;
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
