import { z } from "zod";

/* ---------- enums ---------- */
export const PROJECT_TYPES = ["plot", "tower", "villa", "2bhk", "3bhk", "commercial"] as const;
export const LANGUAGES = ["hi", "en", "hinglish"] as const;
export const ASPECTS = ["9:16", "16:9"] as const;
/** Stage 1 (script + voiceover) is a single job; stages 2 and 3 run in parallel with it; render joins them. */
export const STAGES = ["voiceover", "map", "cinematic", "render"] as const;
export const STAGE_STATUSES = ["queued", "processing", "done", "failed", "skipped"] as const;
export const PROJECT_STATUSES = ["draft", "queued", "processing", "done", "failed"] as const;
export const IMAGE_ROLES = ["site_layout", "elevation", "amenity"] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];
export type Language = (typeof LANGUAGES)[number];
export type Aspect = (typeof ASPECTS)[number];
export type Stage = (typeof STAGES)[number];
export type StageStatus = (typeof STAGE_STATUSES)[number];
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type ImageRole = (typeof IMAGE_ROLES)[number];

/** Provider ids selectable per stage (env var default, overridable in Settings). */
export const PROVIDER_OPTIONS = {
  tts: ["elevenlabs", "google", "azure", "mock"],
  map: ["mapbox", "google", "cesium", "mock"],
  video: ["luma", "runway", "kling", "mock"],
} as const;
export type TtsProviderId = (typeof PROVIDER_OPTIONS.tts)[number];
export type MapProviderId = (typeof PROVIDER_OPTIONS.map)[number];
export type VideoProviderId = (typeof PROVIDER_OPTIONS.video)[number];

/* ---------- brand kit / settings ---------- */
export const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex color");

export const BrandKitSchema = z.object({
  builderName: z.string().min(1).max(120),
  logoUrl: z.string().nullable().default(null),
  primaryColor: hexColor.default("#0B1F3A"),
  accentColor: hexColor.default("#C9A24B"),
  contactNumber: z.string().max(32).default(""),
});
export type BrandKit = z.infer<typeof BrandKitSchema>;

export const ProviderSettingsSchema = z.object({
  tts: z.enum(PROVIDER_OPTIONS.tts),
  map: z.enum(PROVIDER_OPTIONS.map),
  video: z.enum(PROVIDER_OPTIONS.video),
  voiceId: z.string().max(80).default(""),
});
export type ProviderSettings = z.infer<typeof ProviderSettingsSchema>;

export const AccountSettingsSchema = z.object({
  brandKit: BrandKitSchema,
  providers: ProviderSettingsSchema,
  notifyWebhookUrl: z.string().url().nullable().default(null),
  notifyEmail: z.string().email().nullable().default(null),
});
export type AccountSettings = z.infer<typeof AccountSettingsSchema>;

/* ---------- project input ---------- */
export const ProjectImageSchema = z.object({
  role: z.enum(IMAGE_ROLES),
  url: z.string(),
});
export type ProjectImage = z.infer<typeof ProjectImageSchema>;

export const ProjectInputSchema = z.object({
  name: z.string().min(1).max(120),
  builderName: z.string().min(1).max(120),
  tagline: z.string().max(200).default(""),
  projectType: z.enum(PROJECT_TYPES),
  addressText: z.string().min(1).max(300),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  images: z.array(ProjectImageSchema).max(5).default([]),
  customScript: z.string().max(4000).nullable().default(null),
  language: z.enum(LANGUAGES).default("en"),
  /** Optional Digital Twin viewer link: shown on the project page and as a QR code on the video's end card. */
  twinUrl: z.string().max(500).refine((v) => v === "" || /^https?:\/\//i.test(v), "Must start with http:// or https://").default(""),
  /** Optional per-project overrides; otherwise account brand kit / provider settings apply. */
  brandKitOverride: BrandKitSchema.partial().optional(),
});
export type ProjectInput = z.infer<typeof ProjectInputSchema>;

/* ---------- script ---------- */
export const ScriptSegmentSchema = z.object({
  text: z.string(),
  /** seconds relative to voiceover start */
  start: z.number().nonnegative(),
  end: z.number().nonnegative(),
});
export type ScriptSegment = z.infer<typeof ScriptSegmentSchema>;

/* ---------- stage outputs / project assets ---------- */
export const ProjectAssetsSchema = z.object({
  script: z.string().optional(),
  scriptTemplateId: z.string().optional(),
  scriptSentences: z.array(z.string()).optional(),
  voiceoverUrl: z.string().optional(),
  voiceoverDuration: z.number().optional(),
  segments: z.array(ScriptSegmentSchema).optional(),
  mapClipUrl: z.string().optional(),
  mapClipDuration: z.number().optional(),
  cinematicClipUrl: z.string().nullable().optional(),
  cinematicClipDuration: z.number().optional(),
  /** Set when stage 3 is skipped: render falls back to a local Ken Burns pan/zoom on this image. */
  kenBurnsImageUrl: z.string().nullable().optional(),
  videoUrls: z.partialRecord(z.enum(["9:16", "16:9"]), z.string()).optional(),
  thumbnailUrl: z.string().optional(),
});
export type ProjectAssets = z.infer<typeof ProjectAssetsSchema>;

/* ---------- DB row shapes (API responses) ---------- */
export interface ProjectRow {
  id: string;
  accountId: string;
  input: ProjectInput;
  status: ProjectStatus;
  assets: ProjectAssets;
  /** Snapshot of resolved brand kit + providers at submission time. */
  settingsSnapshot: AccountSettings | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobRow {
  id: string;
  projectId: string;
  stage: Stage;
  status: StageStatus;
  progress: number; // 0..100
  provider: string | null;
  error: string | null;
  attempts: number;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export interface NotificationRow {
  id: string;
  accountId: string;
  projectId: string | null;
  kind: "project_done" | "project_failed";
  message: string;
  read: boolean;
  createdAt: string;
}

export interface ProjectWithJobs extends ProjectRow {
  jobs: JobRow[];
}

/* ---------- Remotion composition props ---------- */
export const VideoPropsSchema = z.object({
  projectName: z.string(),
  tagline: z.string(),
  builderName: z.string(),
  mapClipUrl: z.string().nullable(),
  mapClipDuration: z.number().default(0),
  cinematicClipUrl: z.string().nullable(),
  cinematicClipDuration: z.number().default(0),
  kenBurnsImageUrl: z.string().nullable().default(null),
  /** Every uploaded photo, best first (elevation, site layout, amenities); shown one after another after the map flyby. */
  slideUrls: z.array(z.string()).default([]),
  voiceoverUrl: z.string().nullable(),
  /** seconds */
  voiceoverDuration: z.number(),
  logoUrl: z.string().nullable(),
  brandColor: hexColor,
  accentColor: hexColor,
  contactNumber: z.string(),
  segments: z.array(ScriptSegmentSchema),
  musicTrack: z.enum(["serene", "regal", "uplift"]).default("regal"),
  musicUrl: z.string().nullable().default(null),
  ctaText: z.string().default("Book a site visit"),
  language: z.enum(LANGUAGES).default("en"),
  /** When set, the end card shows a QR code + this link. */
  twinUrl: z.string().default(""),
});
export type VideoProps = z.infer<typeof VideoPropsSchema>;

/* ---------- queue payloads ---------- */
export interface StageJobData {
  projectId: string;
  stage: Stage;
  jobRowId: string;
}

/* ---------- misc ---------- */
export const FPS = 30;
export const INTRO_SECONDS = 1.5;
export const OUTRO_SECONDS = 4;

export function stageLabel(stage: Stage): string {
  return {
    voiceover: "Script & voiceover",
    map: "Map flyby",
    cinematic: "Cinematic shot",
    render: "Render & deliver",
  }[stage];
}
