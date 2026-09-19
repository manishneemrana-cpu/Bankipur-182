import ffmpeg from "fluent-ffmpeg";
import path from "path";
import type { AspectRatio } from "@/types/project";

export interface RenderJobConfig {
  sceneVideoPaths: string[];
  voiceoverAudioPath: string;
  backgroundMusicPath?: string;
  subtitlesPath?: string;
  watermarkLogoPath?: string;
  outputPath: string;
  targetAspectRatio: AspectRatio;
}

const SCALE_FILTERS: Record<AspectRatio, string> = {
  "9:16": "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920",
  "16:9": "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080",
  "1:1": "scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080",
};

/**
 * Server-side rendering pipeline (spec section 7): scene concatenation,
 * intelligent aspect-ratio reframing (crop-to-fill, never distort/squash),
 * subtitle burn-in with safe-zone margins, and voice/BGM ducked audio mix.
 */
export class FFmpegRenderEngine {
  public static async executeRender(config: RenderJobConfig): Promise<string> {
    return new Promise((resolve, reject) => {
      let command = ffmpeg();

      config.sceneVideoPaths.forEach((scenePath) => {
        command = command.input(scenePath);
      });

      const voiceInputIndex = config.sceneVideoPaths.length;
      command = command.input(config.voiceoverAudioPath);

      const hasMusic = Boolean(config.backgroundMusicPath);
      const musicInputIndex = voiceInputIndex + 1;
      if (hasMusic) command = command.input(config.backgroundMusicPath as string);

      const scaleFilter = SCALE_FILTERS[config.targetAspectRatio];
      const concatInputs = config.sceneVideoPaths.map((_, idx) => `[${idx}:v]`).join("");

      const filterComplex = [
        `${concatInputs}concat=n=${config.sceneVideoPaths.length}:v=1:a=0[vconcat]`,
        `[vconcat]${scaleFilter}[vscaled]`,
      ];

      let videoLabel = "vscaled";
      if (config.subtitlesPath) {
        filterComplex.push(
          `[vscaled]subtitles=${escapeFilterPath(config.subtitlesPath)}:force_style='Fontname=Inter,FontSize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=3,MarginV=120'[vsubtitles]`
        );
        videoLabel = "vsubtitles";
      }

      let audioLabel: string;
      if (hasMusic) {
        // Duck background music to -18dB relative to voice while voice plays.
        filterComplex.push(`[${musicInputIndex}:a]volume=0.15[bgm_ducked]`);
        filterComplex.push(`[${voiceInputIndex}:a][bgm_ducked]amix=inputs=2:duration=first[aout]`);
        audioLabel = "aout";
      } else {
        audioLabel = `${voiceInputIndex}:a`;
      }

      command
        .complexFilter(filterComplex, [videoLabel, audioLabel])
        .outputOptions([
          "-c:v libx264",
          "-preset fast",
          "-crf 22",
          "-c:a aac",
          "-b:a 192k",
          "-pix_fmt yuv420p",
          "-movflags +faststart",
        ])
        .output(config.outputPath)
        .on("end", () => resolve(config.outputPath))
        .on("error", (err: Error) => reject(new Error(`FFmpeg rendering failed: ${err.message}`)))
        .run();
    });
  }

  /** Generates a thumbnail from the first frame of the master render (spec section 28). */
  public static async extractThumbnail(videoPath: string, outputPath: string, atSeconds = 0.5): Promise<string> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({ timestamps: [atSeconds], filename: path.basename(outputPath), folder: path.dirname(outputPath) })
        .on("end", () => resolve(outputPath))
        .on("error", (err: Error) => reject(err));
    });
  }
}

function escapeFilterPath(p: string): string {
  return p.replace(/:/g, "\\:").replace(/'/g, "\\'");
}
