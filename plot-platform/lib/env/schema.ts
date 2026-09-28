import { z } from "zod";

// Empty strings in .env files mean "not set".
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === "" ? undefined : v), schema.optional());

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: optional(z.url()),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optional(z.string().min(1)),
});

export const serverEnvSchema = clientEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: optional(z.string().min(1)),
  DATABASE_URL: optional(z.string().min(1)),
  AI_PROVIDER: optional(z.enum(["anthropic", "openai", "gemini"])),
  AI_API_KEY: optional(z.string().min(1)),
  AI_MODEL: optional(z.string().min(1)),
  EMBEDDING_MODEL: optional(z.string().min(1)),
  MAP_TILE_PROVIDER: optional(z.enum(["google", "mapbox", "esri"])),
  MAP_API_KEY: optional(z.string().min(1)),
  STORAGE_BUCKET: optional(z.string().min(1)).default("project-files"),
  PUBLIC_BASE_URL: optional(z.url()).default("http://localhost:3000"),
  RAZORPAY_KEY_ID: optional(z.string().min(1)),
  RAZORPAY_KEY_SECRET: optional(z.string().min(1)),
  WHATSAPP_API_ADAPTER: optional(z.enum(["none"])).default("none"),
  WEBHOOK_SIGNING_SECRET: optional(z.string().min(1)),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Throws a readable error listing every invalid variable. */
export function parseEnv<T extends z.ZodType>(
  schema: T,
  source: Record<string, string | undefined>,
): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return result.data;
}

/**
 * Returns the value or throws, naming the variable. Features that need a
 * variable call this at use time, so the app still boots without it
 * (e.g. `npm run dev` before Supabase is configured).
 */
export function required<K extends string>(
  env: Partial<Record<K, string | undefined>>,
  key: K,
): string {
  const value = env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}
