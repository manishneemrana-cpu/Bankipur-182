export interface VoiceSynthesisParams {
  text: string;
  language: string;
  gender: string;
  accent?: string;
  emotion?: string;
  speed?: number; // 0.7 - 1.3
  pitch?: number; // -1 to 1
  voiceId?: string;
}

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

export interface VoiceSynthesisResult {
  audioUrl: string;
  durationSeconds: number;
  wordTimestamps: WordTimestamp[];
  costUsd: number;
}

export interface IVoiceProviderAdapter {
  providerName: string;
  synthesize(params: VoiceSynthesisParams): Promise<VoiceSynthesisResult>;
}
