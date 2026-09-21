import "server-only";
import { getEnv } from "@/server/env";

export interface MetaConfig {
  graphApiVersion: string;
  appId: string;
  appSecret: string;
  webhookVerifyToken: string;
  webhookAppSecret: string;
  embeddedSignupConfigId: string | null;
  baseUrl: string;
}

/**
 * Returns live Meta configuration. Throws if MOCK_META is on — callers must
 * check `isMockModeEnabled()` (src/server/mock/meta.ts) first and only reach
 * here on the real path. This makes "accidentally read real Meta config
 * while mocked" a thrown error rather than a silent wrong value.
 */
export function getMetaConfig(): MetaConfig {
  const env = getEnv();
  if (env.MOCK_META) {
    throw new Error("getMetaConfig() called while MOCK_META=true — check isMockModeEnabled() first");
  }
  // env.ts's superRefine already guarantees these are set when MOCK_META=false.
  const graphApiVersion = env.META_GRAPH_API_VERSION!;
  return {
    graphApiVersion,
    appId: env.META_APP_ID!,
    appSecret: env.META_APP_SECRET!,
    webhookVerifyToken: env.META_WEBHOOK_VERIFY_TOKEN!,
    webhookAppSecret: env.META_WEBHOOK_APP_SECRET!,
    embeddedSignupConfigId: env.META_EMBEDDED_SIGNUP_CONFIG_ID ?? null,
    baseUrl: `https://graph.facebook.com/${graphApiVersion}`,
  };
}
