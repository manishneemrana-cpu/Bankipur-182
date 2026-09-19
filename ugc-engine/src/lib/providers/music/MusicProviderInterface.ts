export interface MusicSelectionParams {
  genre: string;
  energyArc: "build" | "steady" | "drop-in-middle";
  durationSeconds: number;
  industry: string;
}

export interface MusicTrack {
  trackUrl: string;
  licenseId: string;
  bpm: number;
  costUsd: number;
}

export interface IMusicProviderAdapter {
  providerName: string;
  selectTrack(params: MusicSelectionParams): Promise<MusicTrack>;
}
