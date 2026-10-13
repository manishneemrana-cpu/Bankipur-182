import type { Language } from "@ave/shared-types";
import { config } from "../../config.js";
import { paidGate } from "../../lib/paid.js";
import { log } from "../../lib/logger.js";
import { MockVoiceoverProvider } from "./mock.js";
import type { SaveAudio, VoiceoverProvider } from "./types.js";

const MODEL_ID = "eleven_multilingual_v2"; // best Hindi quality; also handles English and Hinglish (Roman script)
const MAX_CHARS = 5000; // per-request limit for this model
/** Premade ElevenLabs voice ("Rachel"), used only when neither Settings nor ELEVENLABS_VOICE_ID names one. */
const FALLBACK_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

/** ElevenLabs — primary provider (eleven_multilingual_v2). Falls back to mock while PAID_APIS_ENABLED=false or no key. */
export class ElevenLabsProvider implements VoiceoverProvider {
  readonly id = "elevenlabs";
  private mock: MockVoiceoverProvider;
  constructor(private save: SaveAudio) { this.mock = new MockVoiceoverProvider(save, "elevenlabs-mock"); }

  async generate(text: string, lang: Language, voiceId: string): Promise<string> {
    if (paidGate("elevenlabs", config.ELEVENLABS_API_KEY) === "mock") return this.mock.generate(text, lang, voiceId);
    if (text.length > MAX_CHARS) throw new Error(`ElevenLabs: script is ${text.length} chars; limit is ${MAX_CHARS}. Shorten the custom script.`);

    const voice = voiceId || config.ELEVENLABS_VOICE_ID || FALLBACK_VOICE_ID;
    if (voice === FALLBACK_VOICE_ID) log.warn("ElevenLabs: no voice configured (Settings or ELEVENLABS_VOICE_ID); using the default premade voice");

    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": config.ELEVENLABS_API_KEY, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        // stable, natural narration; style 0 keeps pace steady for caption sync
        voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0, use_speaker_boost: true },
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      const body = (await res.text().catch(() => "")).slice(0, 300);
      // never include request headers (the API key) in errors
      throw new Error(`ElevenLabs ${res.status}: ${body || res.statusText}${res.status === 401 ? " (check ELEVENLABS_API_KEY)" : res.status === 404 ? ` (voice "${voice}" not found on this account)` : ""}`);
    }
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length < 1000) throw new Error(`ElevenLabs returned an implausibly small audio payload (${bytes.length} bytes)`);
    return this.save(bytes, "mp3", "audio/mpeg");
  }
}
