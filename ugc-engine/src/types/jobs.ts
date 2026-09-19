export type PipelineStep =
  | "INITIALIZING"
  | "BRAND_INTELLIGENCE"
  | "AUDIENCE_INTELLIGENCE"
  | "CREATIVE_STRATEGY"
  | "HOOK_GENERATION"
  | "SCRIPT_WRITING"
  | "STORYBOARD"
  | "CONTINUITY_BIBLE"
  | "GENERATING_SCENES"
  | "VOICE_SYNTHESIS"
  | "CAPTION_GENERATION"
  | "AUDIO_MIX"
  | "FINAL_RENDERING"
  | "FORMAT_ADAPTATION"
  | "COMPLETED"
  | "FAILED";

export interface JobProgress {
  step: PipelineStep;
  progress: number; // 0-100
  message?: string;
}

export interface VideoProductionJobData {
  organizationId: string;
  projectId: string;
  productInput: import("./project").ProductInput;
  /** Scene numbers to regenerate; omit/empty for a full run. Locked scenes are always skipped. */
  targetSceneNumbers?: number[];
}

export interface VideoProductionJobResult {
  masterVideoUrl: string;
  thumbnailUrl: string;
  subtitlesVttUrl: string;
  sceneVideoUrls: string[];
  totalCostUsd: number;
}
