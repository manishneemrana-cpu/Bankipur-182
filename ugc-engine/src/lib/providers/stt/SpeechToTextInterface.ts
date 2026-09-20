export interface TranscriptionParams {
  audioBuffer: Buffer;
  filename: string; // needed for multipart form + format detection, e.g. "voiceover.mp3"
  language?: string;
}

export interface TranscriptionWord {
  word: string;
  start: number;
  end: number;
}

export interface TranscriptionResult {
  text: string;
  words: TranscriptionWord[];
  language?: string;
}

/**
 * Speech-to-Text is used as an alternative/fallback path to build
 * word-level caption timestamps when a voice provider doesn't return
 * alignment data itself (spec section 6's "Whisper Alignment Worker"), and
 * for transcribing user-uploaded reference audio.
 */
export interface ISpeechToTextProvider {
  providerName: string;
  transcribe(params: TranscriptionParams): Promise<TranscriptionResult>;
}
