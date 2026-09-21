import { z } from "zod";

const envSchema = z
  .object({
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
    // Meta/WhatsApp — all optional here. Required only when MOCK_META=false (see below),
    // since most environments (local dev, CI, this build) run in mock mode and should
    // never be forced to have real Meta credentials just to boot. Never hard-code a
    // Graph API version in application code — see docs/meta-current-state.md for why.
    META_APP_ID: z.string().optional(),
    META_APP_SECRET: z.string().optional(),
    META_BUSINESS_ID: z.string().optional(),
    META_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
    META_WEBHOOK_APP_SECRET: z.string().optional(),
    META_GRAPH_API_VERSION: z.string().optional(),
    META_EMBEDDED_SIGNUP_CONFIG_ID: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.MOCK_META) return;
    const required = [
      "META_APP_ID",
      "META_APP_SECRET",
      "META_WEBHOOK_VERIFY_TOKEN",
      "META_WEBHOOK_APP_SECRET",
      "META_GRAPH_API_VERSION",
    ] as const;
    for (const key of required) {
      if (!env[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} is required when MOCK_META=false`,
        });
      }
    }
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
