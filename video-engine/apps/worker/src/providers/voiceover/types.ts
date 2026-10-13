import type { Language } from "@ave/shared-types";

/**
 * Adapter every TTS vendor implements. Providers are selectable via TTS_PROVIDER (or the
 * per-account Settings dropdown) and the pipeline never imports a vendor directly.
 */
export interface VoiceoverProvider {
  readonly id: string;
  /** Synthesize `text` and return a URL to the stored audio file. */
  generate(text: string, lang: Language, voiceId: string): Promise<string>;
}

/** Persists audio bytes and returns a public URL. Injected so providers stay storage-agnostic. */
export type SaveAudio = (bytes: Buffer, ext: "mp3" | "wav", mime: string) => Promise<string>;
