import type { IVoiceProviderAdapter } from "./VoiceProviderInterface";
import { ElevenLabsAdapter } from "./ElevenLabsAdapter";

let cached: IVoiceProviderAdapter | null = null;

export function getVoiceProvider(): IVoiceProviderAdapter {
  if (!cached) cached = new ElevenLabsAdapter(process.env.ELEVENLABS_API_KEY);
  return cached;
}

export type { IVoiceProviderAdapter, VoiceSynthesisParams, VoiceSynthesisResult, WordTimestamp } from "./VoiceProviderInterface";
