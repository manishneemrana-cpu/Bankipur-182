import type { IVoiceProviderAdapter } from "./VoiceProviderInterface";
import { ElevenLabsAdapter } from "./ElevenLabsAdapter";
import { HuggingFaceTTSAdapter } from "./HuggingFaceTTSAdapter";

export type VoiceProviderKey = "elevenlabs" | "huggingface";

let cached: IVoiceProviderAdapter | null = null;

export function getVoiceProvider(): IVoiceProviderAdapter {
  if (cached) return cached;

  const requested = process.env.DEFAULT_VOICE_PROVIDER as VoiceProviderKey | undefined;

  if ((requested === "huggingface" || (!requested && !process.env.ELEVENLABS_API_KEY)) && process.env.HUGGINGFACE_API_KEY) {
    cached = new HuggingFaceTTSAdapter(process.env.HUGGINGFACE_API_KEY, process.env.HUGGINGFACE_TTS_MODEL);
    return cached;
  }

  // Falls back to MockVoiceAdapter internally when ELEVENLABS_API_KEY is unset.
  cached = new ElevenLabsAdapter(process.env.ELEVENLABS_API_KEY);
  return cached;
}

export type { IVoiceProviderAdapter, VoiceSynthesisParams, VoiceSynthesisResult, WordTimestamp } from "./VoiceProviderInterface";
