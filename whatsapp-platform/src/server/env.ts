import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  ENCRYPTION_KEY: z.string().min(1, "ENCRYPTION_KEY is required"),
  ENCRYPTION_KEY_VERSION: z.coerce.number().int().default(1),
  MOCK_META: z
    .string()
    .default("true")
    .transform((v) => v === "true"),
  PLATFORM_BRAND_NAME: z.string().default("Magadh Property"),
  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/** Server-only. Never import this from a client component. */
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment configuration: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`
    );
  }
  cached = parsed.data;
  return cached;
}
