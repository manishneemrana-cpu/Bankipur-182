import type { IMusicProviderAdapter, MusicSelectionParams, MusicTrack } from "./MusicProviderInterface";

/**
 * Mubert render API — generates a short AI music track matching a mood/
 * genre tag instead of picking from a fixed library. Free tier available;
 * see https://mubert.com/render for API access.
 */
export class MubertAdapter implements IMusicProviderAdapter {
  public providerName = "mubert";

  constructor(private apiKey: string) {}

  public async selectTrack(params: MusicSelectionParams): Promise<MusicTrack> {
    const response = await fetch("https://music-api.mubert.com/api/v3/public/tracks", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        duration: params.durationSeconds,
        tags: [params.genre, params.industry].filter(Boolean),
        intensity: params.energyArc === "build" ? "high" : params.energyArc === "steady" ? "medium" : "low",
      }),
    });

    if (!response.ok) throw new Error(`Mubert API error (${response.status}): ${await response.text()}`);

    const data = await response.json();
    return {
      trackUrl: data.data?.tracks?.[0]?.url ?? data.url,
      licenseId: data.data?.tracks?.[0]?.id ?? "mubert-generated",
      bpm: data.data?.tracks?.[0]?.bpm ?? 100,
      costUsd: 0,
    };
  }
}
