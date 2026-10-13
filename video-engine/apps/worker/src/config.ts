import "dotenv/config";
import path from "node:path";
import { z } from "zod";
import { PROVIDER_OPTIONS } from "@ave/shared-types";

const bool = z
  .enum(["true", "false", "1", "0", ""])
  .default("false")
  .transform((v) => v === "true" || v === "1");

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(4100),
  /** Public base URL of the API (used to build file URLs in local-storage mode). */
  PUBLIC_API_URL: z.string().default("http://localhost:4100"),
  WEB_ORIGIN: z.string().default("http://localhost:3100"),
  REDIS_URL: z.string().default("redis://localhost:6379"),

  SUPABASE_URL: z.string().default(""),
  SUPABASE_SERVICE_KEY: z.string().default(""),
  SUPABASE_BUCKET: z.string().default("video-engine"),
  /** Where data/files live when Supabase isn't configured (local dev only). */
  LOCAL_DATA_DIR: z.string().default(path.resolve(process.cwd(), "../../.local-data")),

  TTS_PROVIDER: z.enum(PROVIDER_OPTIONS.tts).default("mock"),
  MAP_PROVIDER: z.enum(PROVIDER_OPTIONS.map).default("mock"),
  VIDEO_PROVIDER: z.enum(PROVIDER_OPTIONS.video).default("mock"),

  /**
   * Master switch for REAL paid API calls. Stays false until the owner confirms keys are
   * ready for testing. While false (or while an adapter's real call is still a TODO),
   * every provider returns a mock result.
   */
  PAID_APIS_ENABLED: bool,

  ELEVENLABS_API_KEY: z.string().default(""),
  ELEVENLABS_VOICE_ID: z.string().default(""),
  GOOGLE_TTS_API_KEY: z.string().default(""),
  AZURE_SPEECH_KEY: z.string().default(""),
  AZURE_SPEECH_REGION: z.string().default("centralindia"),
  MAPBOX_ACCESS_TOKEN: z.string().default(""),
  GOOGLE_MAPS_API_KEY: z.string().default(""),
  CESIUM_ION_TOKEN: z.string().default(""),
  LUMA_API_KEY: z.string().default(""),
  RUNWAY_API_KEY: z.string().default(""),
  KLING_API_KEY: z.string().default(""),

  /** Full Chromium for Puppeteer map capture (auto-detected when empty). */
  PUPPETEER_EXECUTABLE_PATH: z.string().default(""),
  /** chrome-headless-shell for Remotion renders; when empty Remotion downloads its own on first use. */
  REMOTION_BROWSER_EXECUTABLE: z.string().default(""),
  RENDER_CONCURRENCY: z.coerce.number().default(2),
  WORKER_CONCURRENCY: z.coerce.number().default(2),

  /** Static bearer token accepted by the API when Supabase auth isn't configured. */
  DEV_ACCOUNT_ID: z.string().default("00000000-0000-4000-8000-000000000001"),
  /** Optional SMTP-less email hook: POST {to,subject,text} to this URL (e.g. Resend/n8n relay). */
  EMAIL_WEBHOOK_URL: z.string().default(""),
});

export const config = schema.parse(process.env);
export const useSupabase = Boolean(config.SUPABASE_URL && config.SUPABASE_SERVICE_KEY);
export type Config = z.infer<typeof schema>;
