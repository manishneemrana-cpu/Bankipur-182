export interface I2VOptions {
  /** 4-8 seconds */
  durationSec: number;
  prompt: string;
  /** Square so both 9:16 and 16:9 reels can center-crop the clip. */
  aspect: "1:1";
}

/**
 * Adapter every image-to-video vendor implements. Selectable via VIDEO_PROVIDER or the Settings
 * dropdown; the pipeline never imports a vendor directly.
 */
export interface ImageToVideoProvider {
  readonly id: string;
  /** Animate `imageUrl` into a short cinematic clip; resolves to a URL of the finished MP4. */
  generate(imageUrl: string, opts: I2VOptions): Promise<string>;
}

export interface I2VDeps {
  /** Persist MP4 bytes, return a URL. */
  saveVideo(bytes: Buffer): Promise<string>;
  fetchBytes(url: string): Promise<Buffer>;
}

export const CINEMATIC_PROMPT =
  "Slow cinematic drone orbit around the building at golden hour, smooth steady camera, photorealistic, " +
  "preserve the exact architecture, materials and proportions, no people, no text, no distortion.";
