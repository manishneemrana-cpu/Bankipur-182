import type { ISpeechToTextProvider } from "./SpeechToTextInterface";
import { WhisperCompatibleAdapter } from "./WhisperCompatibleAdapter";
import { resolveEnv, type EnvOverrides } from "@/lib/settings/resolveEnv";

/** Returns null (not a throw) when unconfigured — STT is an optional enhancement, never required for the core pipeline. */
export function getSpeechToTextProvider(overrides: EnvOverrides = {}): ISpeechToTextProvider | null {
  const env = (key: string) => resolveEnv(overrides, key);

  if (env("GROQ_API_KEY")) {
    return new WhisperCompatibleAdapter("groq-whisper", "https://api.groq.com/openai/v1", env("GROQ_API_KEY") as string, "whisper-large-v3");
  }

  if (env("OPENAI_API_KEY")) {
    return new WhisperCompatibleAdapter("openai-whisper", "https://api.openai.com/v1", env("OPENAI_API_KEY") as string, "whisper-1");
  }

  return null;
}

export type { ISpeechToTextProvider, TranscriptionParams, TranscriptionResult, TranscriptionWord } from "./SpeechToTextInterface";
