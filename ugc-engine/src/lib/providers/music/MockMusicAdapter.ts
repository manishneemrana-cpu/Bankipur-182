import type { IMusicProviderAdapter, MusicSelectionParams, MusicTrack } from "./MusicProviderInterface";
import { MubertAdapter } from "./MubertAdapter";
import { resolveEnv, type EnvOverrides } from "@/lib/settings/resolveEnv";

/**
 * Stand-in for a licensed music library integration (e.g. Epidemic Sound,
 * Artlist). Swap for a real adapter behind the same interface when a
 * licensing deal is in place — never ship AI-invented "royalty-free" claims.
 */
export class MockMusicAdapter implements IMusicProviderAdapter {
  public providerName = "mock-music-library";

  public async selectTrack(params: MusicSelectionParams): Promise<MusicTrack> {
    const bpmByEnergy: Record<MusicSelectionParams["energyArc"], number> = {
      build: 110,
      steady: 100,
      "drop-in-middle": 120,
    };

    return {
      trackUrl: `https://mock-storage.local/music/${params.genre}-${params.energyArc}.mp3`,
      licenseId: "mock-license",
      bpm: bpmByEnergy[params.energyArc],
      costUsd: 0,
    };
  }
}

export function getMusicProvider(overrides: EnvOverrides = {}): IMusicProviderAdapter {
  const key = resolveEnv(overrides, "MUBERT_API_KEY");
  return key ? new MubertAdapter(key) : new MockMusicAdapter();
}
