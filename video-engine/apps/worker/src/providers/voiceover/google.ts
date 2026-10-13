import type { Language } from "@ave/shared-types";
import { config } from "../../config.js";
import { PaidApiNotImplemented, paidGate } from "../../lib/paid.js";
import { MockVoiceoverProvider } from "./mock.js";
import type { SaveAudio, VoiceoverProvider } from "./types.js";

/** Google Cloud Text-to-Speech — cheaper fallback. */
export class GoogleTtsProvider implements VoiceoverProvider {
  readonly id = "google";
  private mock: MockVoiceoverProvider;
  constructor(private save: SaveAudio) { this.mock = new MockVoiceoverProvider(save, "google-mock"); }

  async generate(text: string, lang: Language, voiceId: string): Promise<string> {
    if (paidGate("google-tts", config.GOOGLE_TTS_API_KEY) === "mock") return this.mock.generate(text, lang, voiceId);

    // TODO(paid-api): Google Cloud TTS — implement once the owner confirms the key is ready to test.
    //   POST https://texttospeech.googleapis.com/v1/text:synthesize?key=GOOGLE_TTS_API_KEY
    //   body: { input: { text },
    //           voice: { languageCode: lang === "en" ? "en-IN" : "hi-IN", name: voiceId || "hi-IN-Neural2-A" },
    //           audioConfig: { audioEncoding: "MP3" } }
    //   response: { audioContent: <base64 mp3> } -> `this.save(Buffer.from(audioContent, "base64"), "mp3", "audio/mpeg")`
    //   Hinglish: send Roman-script text with languageCode "hi-IN" (or en-IN) and listen-test both.
    throw new PaidApiNotImplemented("Google TTS");
  }
}
