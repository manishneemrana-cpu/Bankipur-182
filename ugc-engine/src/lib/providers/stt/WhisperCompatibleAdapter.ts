import type { ISpeechToTextProvider, TranscriptionParams, TranscriptionResult } from "./SpeechToTextInterface";

/**
 * Generic adapter for any OpenAI-Whisper-compatible transcription endpoint
 * (`POST {baseUrl}/audio/transcriptions`, multipart form). Groq's
 * `whisper-large-v3` is free and very fast; real OpenAI's `whisper-1` works
 * against the same code path if OPENAI_API_KEY is set instead.
 */
export class WhisperCompatibleAdapter implements ISpeechToTextProvider {
  constructor(
    public readonly providerName: string,
    private baseUrl: string,
    private apiKey: string,
    private model: string
  ) {}

  public async transcribe(params: TranscriptionParams): Promise<TranscriptionResult> {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(params.audioBuffer)]), params.filename);
    form.append("model", this.model);
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "word");
    if (params.language) form.append("language", params.language);

    const response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form,
    });

    if (!response.ok) {
      throw new Error(`${this.providerName} transcription error (${response.status}): ${await response.text()}`);
    }

    const data = await response.json();
    const words = (data.words ?? []).map((w: { word: string; start: number; end: number }) => ({
      word: w.word,
      start: w.start,
      end: w.end,
    }));

    return { text: data.text ?? "", words, language: data.language };
  }
}
