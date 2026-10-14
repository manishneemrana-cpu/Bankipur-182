import type { Language } from "@ave/shared-types";
import { config } from "../../config.js";
import { paidGate } from "../../lib/paid.js";
import { MockVoiceoverProvider } from "./mock.js";
import type { SaveAudio, VoiceoverProvider } from "./types.js";

const MAX_BYTES = 4500; // API limit is 5000 bytes of input per request
const GOOGLE_VOICE = /^[a-z]{2,3}-[A-Z]{2}-/; // e.g. hi-IN-Neural2-A; anything else (an ElevenLabs id) is ignored

/** Google Cloud Text-to-Speech. Falls back to mock while PAID_APIS_ENABLED=false or no key. */
export class GoogleTtsProvider implements VoiceoverProvider {
  readonly id = "google";
  private mock: MockVoiceoverProvider;
  constructor(private save: SaveAudio) { this.mock = new MockVoiceoverProvider(save, "google-mock"); }

  async generate(text: string, lang: Language, voiceId: string): Promise<string> {
    if (paidGate("google-tts", config.GOOGLE_TTS_API_KEY) === "mock") return this.mock.generate(text, lang, voiceId);

    // Hindi and Hinglish (Roman script) both read best with a hi-IN voice; English uses an Indian-English voice.
    const languageCode = lang === "en" ? "en-IN" : "hi-IN";
    const name = GOOGLE_VOICE.test(voiceId) ? voiceId : `${languageCode}-Neural2-A`;
    const code = name.split("-").slice(0, 2).join("-");

    const parts: Buffer[] = [];
    for (const chunk of splitText(text)) {
      const res = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
        method: "POST",
        headers: { "x-goog-api-key": config.GOOGLE_TTS_API_KEY, "content-type": "application/json" },
        body: JSON.stringify({
          input: { text: chunk },
          voice: { languageCode: code, name },
          audioConfig: { audioEncoding: "MP3", sampleRateHertz: 44100 },
        }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) {
        const body = (await res.text().catch(() => "")).slice(0, 300);
        throw new Error(`Google TTS ${res.status}: ${body || res.statusText}${res.status === 403 ? " (enable the Cloud Text-to-Speech API and billing, and check the key's restrictions)" : res.status === 400 ? ` (is voice "${name}" valid?)` : ""}`);
      }
      const json = (await res.json()) as { audioContent?: string };
      const bytes = Buffer.from(json.audioContent ?? "", "base64");
      if (bytes.length < 500) throw new Error(`Google TTS returned an implausibly small audio payload (${bytes.length} bytes)`);
      parts.push(bytes);
    }
    return this.save(Buffer.concat(parts), "mp3", "audio/mpeg"); // MP3 frames concatenate cleanly
  }
}

/** Split on sentence ends so each request stays under the byte limit. */
export function splitText(text: string): string[] {
  const out: string[] = [];
  let cur = "";
  for (const s of text.split(/(?<=[.!?।])\s+/)) {
    if (cur && Buffer.byteLength(`${cur} ${s}`) > MAX_BYTES) { out.push(cur); cur = s; } else cur = cur ? `${cur} ${s}` : s;
  }
  if (cur) out.push(cur);
  return out;
}
