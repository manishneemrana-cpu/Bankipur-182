import type { Language } from "@ave/shared-types";
import { config } from "../../config.js";
import { PaidApiNotImplemented, paidGate } from "../../lib/paid.js";
import { MockVoiceoverProvider } from "./mock.js";
import type { SaveAudio, VoiceoverProvider } from "./types.js";

/** Azure Speech Services — second fallback. */
export class AzureSpeechProvider implements VoiceoverProvider {
  readonly id = "azure";
  private mock: MockVoiceoverProvider;
  constructor(private save: SaveAudio) { this.mock = new MockVoiceoverProvider(save, "azure-mock"); }

  async generate(text: string, lang: Language, voiceId: string): Promise<string> {
    if (paidGate("azure-speech", config.AZURE_SPEECH_KEY) === "mock") return this.mock.generate(text, lang, voiceId);

    // TODO(paid-api): Azure Speech — implement once the owner confirms the key is ready to test.
    //   POST https://{AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1
    //   headers: { "Ocp-Apim-Subscription-Key": AZURE_SPEECH_KEY, "Content-Type": "application/ssml+xml",
    //              "X-Microsoft-OutputFormat": "audio-24khz-96kbitrate-mono-mp3" }
    //   body (SSML, XML-escape `text`): <speak version="1.0" xml:lang="hi-IN"><voice name="hi-IN-SwaraNeural">…</voice></speak>
    //   response: mp3 bytes -> `this.save(bytes, "mp3", "audio/mpeg")`
    throw new PaidApiNotImplemented("Azure Speech");
  }
}
