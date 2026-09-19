import type { WordTimestamp } from "@/lib/providers/voice/VoiceProviderInterface";

/**
 * Word-level WebVTT generation with safe-zone-friendly chunking. Never emits
 * captions long enough to spill outside the platform's lower-third safe
 * zone (spec section 21): default to 3 words per caption line.
 */
export class AudioCaptionEngine {
  public static generateDynamicVTT(timestamps: WordTimestamp[], wordsPerCaptionLine = 3): string {
    let vtt = "WEBVTT\n\n";

    for (let i = 0; i < timestamps.length; i += wordsPerCaptionLine) {
      const chunk = timestamps.slice(i, i + wordsPerCaptionLine);
      if (!chunk.length) continue;

      const startTime = this.formatSecondsToVTTTime(chunk[0].start);
      const endTime = this.formatSecondsToVTTTime(chunk[chunk.length - 1].end);
      const payload = chunk.map((w) => `<c.highlight>${escapeVtt(w.word)}</c>`).join(" ");

      vtt += `${i / wordsPerCaptionLine + 1}\n`;
      vtt += `${startTime} --> ${endTime}\n`;
      vtt += `${payload}\n\n`;
    }

    return vtt;
  }

  /** Also emits an SRT for platforms/export packages that require it (spec section 55). */
  public static generateSRT(timestamps: WordTimestamp[], wordsPerCaptionLine = 3): string {
    let srt = "";
    let index = 1;

    for (let i = 0; i < timestamps.length; i += wordsPerCaptionLine) {
      const chunk = timestamps.slice(i, i + wordsPerCaptionLine);
      if (!chunk.length) continue;

      const startTime = this.formatSecondsToSRTTime(chunk[0].start);
      const endTime = this.formatSecondsToSRTTime(chunk[chunk.length - 1].end);
      const payload = chunk.map((w) => w.word).join(" ");

      srt += `${index}\n${startTime} --> ${endTime}\n${payload}\n\n`;
      index += 1;
    }

    return srt;
  }

  private static formatSecondsToVTTTime(seconds: number): string {
    const date = new Date(0);
    date.setUTCMilliseconds(seconds * 1000);
    return date.toISOString().substr(11, 12);
  }

  private static formatSecondsToSRTTime(seconds: number): string {
    return this.formatSecondsToVTTTime(seconds).replace(".", ",");
  }
}

function escapeVtt(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
