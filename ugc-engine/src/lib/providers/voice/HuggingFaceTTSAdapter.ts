import type { IVoiceProviderAdapter, VoiceSynthesisParams, VoiceSynthesisResult } from "./VoiceProviderInterface";
import { MockVoiceAdapter } from "./MockVoiceAdapter";

/**
 * Free fallback TTS via Hugging Face Inference API. No word-level timing is
 * returned by the model, so timestamps are estimated the same way
 * MockVoiceAdapter does (average speaking rate) — good enough for caption
 * placement, not frame-accurate lip sync.
 */
export class HuggingFaceTTSAdapter implements IVoiceProviderAdapter {
  public providerName = "huggingface-tts";
  private model: string;
  private timingEstimator = new MockVoiceAdapter();

  constructor(private apiKey: string, model?: string) {
    this.model = model || "espnet/kan-bayashi_ljspeech_vits";
  }

  public async synthesize(params: VoiceSynthesisParams): Promise<VoiceSynthesisResult> {
    const response = await fetch(`https://api-inference.huggingface.co/models/${this.model}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: params.text }),
    });

    if (!response.ok) throw new Error(`Hugging Face TTS error (${response.status}): ${await response.text()}`);

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    const timing = await this.timingEstimator.synthesize(params);

    return {
      audioUrl: `data:audio/flac;base64,${audioBuffer.toString("base64")}`,
      durationSeconds: timing.durationSeconds,
      wordTimestamps: timing.wordTimestamps,
      costUsd: 0,
    };
  }
}
