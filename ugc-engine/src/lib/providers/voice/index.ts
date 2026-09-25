import type { IVoiceProviderAdapter } from "./VoiceProviderInterface";
import { ElevenLabsAdapter } from "./ElevenLabsAdapter";
import { HuggingFaceTTSAdapter } from "./HuggingFaceTTSAdapter";
import { resolveEnv, type EnvOverrides } from "@/lib/settings/resolveEnv";

export type VoiceProviderKey = "elevenlabs" | "huggingface";

export function getVoiceProvider(overrides: EnvOverrides = {}): IVoiceProviderAdapter {
  const env = (key: string) => resolveEnv(overrides, key);
  const requested = env("DEFAULT_VOICE_PROVIDER") as VoiceProviderKey | undefined;

  if ((requested === "huggingface" || (!requested && !env("ELEVENLABS_API_KEY"))) && env("HUGGINGFACE_API_KEY")) {
    return new HuggingFaceTTSAdapter(env("HUGGINGFACE_API_KEY") as string, env("HUGGINGFACE_TTS_MODEL"));
  }

  // Falls back to MockVoiceAdapter internally when ELEVENLABS_API_KEY is unset.
  return new ElevenLabsAdapter(env("ELEVENLABS_API_KEY"));
}

export type { IVoiceProviderAdapter, VoiceSynthesisParams, VoiceSynthesisResult, WordTimestamp } from "./VoiceProviderInterface";
