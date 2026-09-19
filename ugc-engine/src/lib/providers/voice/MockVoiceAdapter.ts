import type { IVoiceProviderAdapter, VoiceSynthesisParams, VoiceSynthesisResult, WordTimestamp } from "./VoiceProviderInterface";

/** Local-dev stand-in: estimates timing from average speaking rate, no audio bytes produced. */
export class MockVoiceAdapter implements IVoiceProviderAdapter {
  public providerName = "mock-voice";
  private wordsPerSecond = 2.3;

  public async synthesize(params: VoiceSynthesisParams): Promise<VoiceSynthesisResult> {
    const words = params.text.trim().split(/\s+/).filter(Boolean);
    const perWordSeconds = 1 / (this.wordsPerSecond * (params.speed ?? 1));

    const wordTimestamps: WordTimestamp[] = words.map((word, i) => ({
      word,
      start: Number((i * perWordSeconds).toFixed(2)),
      end: Number(((i + 1) * perWordSeconds).toFixed(2)),
    }));

    return {
      audioUrl: `https://mock-storage.local/voice/${Date.now()}.mp3`,
      durationSeconds: Number((words.length * perWordSeconds).toFixed(2)),
      wordTimestamps,
      costUsd: 0,
    };
  }
}
