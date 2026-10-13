import type { Language } from "@ave/shared-types";
import type { SaveAudio, VoiceoverProvider } from "./types.js";

/** Build a mono 16-bit PCM WAV. */
export function pcmToWav(samples: Int16Array, sampleRate: number): Buffer {
  const data = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(sampleRate, 24); h.writeUInt32LE(sampleRate * 2, 28);
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

/**
 * Offline stand-in for TTS: a soft syllable-pulsed tone whose length follows the text length,
 * so downstream timing/render stages behave exactly as they will with real speech.
 */
export class MockVoiceoverProvider implements VoiceoverProvider {
  readonly id = "mock";
  constructor(private save: SaveAudio, private label = "mock") {}
  async generate(text: string, _lang: Language, _voiceId: string): Promise<string> {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const seconds = Math.max(3, words / 2.6); // ~156 wpm
    const sr = 22050;
    const n = Math.floor(seconds * sr);
    const s = new Int16Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const syll = 0.5 + 0.5 * Math.sin(2 * Math.PI * 4.2 * t); // ~4 syllables/sec
      const env = Math.min(1, t / 0.05, (seconds - t) / 0.05) * (0.25 + 0.75 * syll);
      const v = Math.sin(2 * Math.PI * 180 * t) * 0.5 + Math.sin(2 * Math.PI * 360 * t) * 0.25;
      s[i] = Math.round(v * env * 0.18 * 32767);
    }
    void this.label;
    return this.save(pcmToWav(s, sr), "wav", "audio/wav");
  }
}
