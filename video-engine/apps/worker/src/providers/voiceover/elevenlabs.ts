import type { Language } from "@ave/shared-types";
import { config } from "../../config.js";
import { PaidApiNotImplemented, paidGate } from "../../lib/paid.js";
import { MockVoiceoverProvider } from "./mock.js";
import type { SaveAudio, VoiceoverProvider } from "./types.js";

/** ElevenLabs — primary provider (best Hindi quality, model eleven_multilingual_v2). */
export class ElevenLabsProvider implements VoiceoverProvider {
  readonly id = "elevenlabs";
  private mock: MockVoiceoverProvider;
  constructor(private save: SaveAudio) { this.mock = new MockVoiceoverProvider(save, "elevenlabs-mock"); }

  async generate(text: string, lang: Language, voiceId: string): Promise<string> {
    if (paidGate("elevenlabs", config.ELEVENLABS_API_KEY) === "mock") return this.mock.generate(text, lang, voiceId);

    // TODO(paid-api): ElevenLabs — implement once the owner confirms the key is ready to test.
    //   POST https://api.elevenlabs.io/v1/text-to-speech/{voiceId || ELEVENLABS_VOICE_ID}?output_format=mp3_44100_128
    //   headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json" }
    //   body:    { text, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.5, similarity_boost: 0.75 } }
    //   response: audio/mpeg bytes -> `return this.save(Buffer.from(await res.arrayBuffer()), "mp3", "audio/mpeg")`
    //   For exact sentence timings use the /with-timestamps variant (character alignment) instead of the
    //   proportional estimate in stages/timing.ts.
    throw new PaidApiNotImplemented("ElevenLabs");
  }
}
