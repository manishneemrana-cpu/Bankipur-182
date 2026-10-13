import type { Language } from "@ave/shared-types";

/**
 * Adapter every TTS vendor implements. Providers are selectable via TTS_PROVIDER (or the
 * per-account Settings dropdown) and the pipeline never imports a vendor directly.
 */
/** Per-character timing as returned by providers that support it (e.g. ElevenLabs /with-timestamps). */
export interface CharAlignment {
  characters: string[];
  starts: number[]; // seconds
  ends: number[];
}

export interface VoiceoverProvider {
  readonly id: string;
  /** Synthesize `text` and return a URL to the stored audio file. */
  generate(text: string, lang: Language, voiceId: string): Promise<string>;
  /** Optional: same as generate() but also returns exact character timings when the vendor offers them. */
  generateWithAlignment?(text: string, lang: Language, voiceId: string): Promise<{ audioUrl: string; alignment?: CharAlignment }>;
}

/** Persists audio bytes and returns a public URL. Injected so providers stay storage-agnostic. */
export type SaveAudio = (bytes: Buffer, ext: "mp3" | "wav", mime: string) => Promise<string>;
