import type { IVoiceProviderAdapter, VoiceSynthesisParams, VoiceSynthesisResult } from "./VoiceProviderInterface";
import { MockVoiceAdapter } from "./MockVoiceAdapter";

/** ElevenLabs TTS adapter. Falls back to MockVoiceAdapter when no API key is set (dev only). */
export class ElevenLabsAdapter implements IVoiceProviderAdapter {
  public providerName = "elevenlabs";
  private apiKey?: string;
  private fallback = new MockVoiceAdapter();
  private costPerCharacterUsd = 0.00003;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  public async synthesize(params: VoiceSynthesisParams): Promise<VoiceSynthesisResult> {
    if (!this.apiKey) return this.fallback.synthesize(params);

    const voiceId = params.voiceId || "21m00Tcm4TlvDq8ikWAM"; // default ElevenLabs voice
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`, {
      method: "POST",
      headers: {
        "xi-api-key": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: params.text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.4, similarity_boost: 0.8, speed: params.speed ?? 1.0 },
      }),
    });

    if (!response.ok) throw new Error(`ElevenLabs API error: ${response.statusText}`);
    const data = await response.json();

    const chars: string[] = data.alignment?.characters ?? [];
    const starts: number[] = data.alignment?.character_start_times_seconds ?? [];
    const ends: number[] = data.alignment?.character_end_times_seconds ?? [];
    const wordTimestamps = collapseCharsToWords(chars, starts, ends);

    return {
      audioUrl: `data:audio/mpeg;base64,${data.audio_base64}`,
      durationSeconds: ends.length ? ends[ends.length - 1] : 0,
      wordTimestamps,
      costUsd: params.text.length * this.costPerCharacterUsd,
    };
  }
}

function collapseCharsToWords(chars: string[], starts: number[], ends: number[]) {
  const words: { word: string; start: number; end: number }[] = [];
  let current = "";
  let start = 0;

  chars.forEach((c, i) => {
    if (c === " " || i === chars.length - 1) {
      if (c !== " ") current += c;
      if (current) words.push({ word: current, start, end: ends[i] });
      current = "";
      start = starts[i + 1] ?? ends[i];
    } else {
      if (!current) start = starts[i];
      current += c;
    }
  });

  return words;
}
