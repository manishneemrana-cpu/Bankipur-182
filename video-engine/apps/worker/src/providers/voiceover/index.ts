import type { TtsProviderId } from "@ave/shared-types";
import { AzureSpeechProvider } from "./azure.js";
import { ElevenLabsProvider } from "./elevenlabs.js";
import { GoogleTtsProvider } from "./google.js";
import { MockVoiceoverProvider } from "./mock.js";
import type { SaveAudio, VoiceoverProvider } from "./types.js";

export type { VoiceoverProvider, SaveAudio } from "./types.js";

export function createVoiceoverProvider(id: TtsProviderId, save: SaveAudio): VoiceoverProvider {
  switch (id) {
    case "elevenlabs": return new ElevenLabsProvider(save);
    case "google": return new GoogleTtsProvider(save);
    case "azure": return new AzureSpeechProvider(save);
    case "mock":
    default: return new MockVoiceoverProvider(save);
  }
}
