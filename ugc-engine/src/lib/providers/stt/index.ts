import type { ISpeechToTextProvider } from "./SpeechToTextInterface";
import { WhisperCompatibleAdapter } from "./WhisperCompatibleAdapter";

let cached: ISpeechToTextProvider | null = null;

/** Returns null (not a throw) when unconfigured — STT is an optional enhancement, never required for the core pipeline. */
export function getSpeechToTextProvider(): ISpeechToTextProvider | null {
  if (cached) return cached;

  if (process.env.GROQ_API_KEY) {
    cached = new WhisperCompatibleAdapter("groq-whisper", "https://api.groq.com/openai/v1", process.env.GROQ_API_KEY, "whisper-large-v3");
    return cached;
  }

  if (process.env.OPENAI_API_KEY) {
    cached = new WhisperCompatibleAdapter("openai-whisper", "https://api.openai.com/v1", process.env.OPENAI_API_KEY, "whisper-1");
    return cached;
  }

  return null;
}

export type { ISpeechToTextProvider, TranscriptionParams, TranscriptionResult, TranscriptionWord } from "./SpeechToTextInterface";
