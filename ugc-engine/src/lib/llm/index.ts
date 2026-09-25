import type { ILLMProvider } from "./LLMProvider";
import { GeminiLLMProvider } from "./GeminiLLMProvider";
import { MockLLMProvider } from "./MockLLMProvider";
import { OpenAICompatibleLLMProvider } from "./OpenAICompatibleLLMProvider";
import { resolveEnv, type EnvOverrides } from "@/lib/settings/resolveEnv";

export type LLMProviderKey = "gemini" | "openrouter" | "nvidia" | "groq" | "together";

/**
 * Every LLM-backed provider this registry knows how to build, keyed by the
 * env var that supplies its credential and the OpenAI-compatible base URL
 * it speaks (Gemini is the one exception — it uses @google/genai directly
 * because it's also the only provider wired for multimodal QC evaluation).
 */
const OPENAI_COMPATIBLE_CONFIG: Record<Exclude<LLMProviderKey, "gemini">, { baseUrl: string; envKey: string; defaultModel: string; modelEnvKey: string }> = {
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    envKey: "OPENROUTER_API_KEY",
    modelEnvKey: "OPENROUTER_MODEL",
    // Free-tier model on OpenRouter as of writing; check https://openrouter.ai/models?max_price=0 for current free models.
    defaultModel: "meta-llama/llama-3.1-8b-instruct:free",
  },
  nvidia: {
    baseUrl: "https://integrate.api.nvidia.com/v1",
    envKey: "NVIDIA_API_KEY",
    modelEnvKey: "NVIDIA_MODEL",
    // Most models listed in /v1/models 404 as "Function not found for account" on
    // this API key (nemotron-70b, mistral-7b-instruct-v0.3, gemma-3-12b-it,
    // granite-3.0-8b-instruct, mistral-nemo-12b-instruct all do) — this key only
    // has entitlement for a subset. meta/llama-3.2-11b-vision-instruct is
    // confirmed live via a real chat completion call. Override via NVIDIA_MODEL
    // if this account's entitlements change.
    defaultModel: "meta/llama-3.2-11b-vision-instruct",
  },
  groq: {
    baseUrl: "https://api.groq.com/openai/v1",
    envKey: "GROQ_API_KEY",
    modelEnvKey: "GROQ_MODEL",
    defaultModel: "llama-3.3-70b-versatile",
  },
  together: {
    baseUrl: "https://api.together.xyz/v1",
    envKey: "TOGETHER_API_KEY",
    modelEnvKey: "TOGETHER_MODEL",
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
  },
};

/**
 * Selection order: explicit DEFAULT_LLM_PROVIDER wins; otherwise the first
 * provider with a configured API key is used; otherwise Gemini if its key
 * is set; otherwise MockLLMProvider (dev only, or ALLOW_MOCK_PROVIDERS=true).
 * `overrides` are per-organization keys from the Settings dashboard, which
 * win over the equivalent Vercel/`.env` value.
 */
export function getLLMProvider(overrides: EnvOverrides = {}): ILLMProvider {
  const env = (key: string) => resolveEnv(overrides, key);
  const requested = env("DEFAULT_LLM_PROVIDER") as LLMProviderKey | undefined;

  if (requested === "gemini" || (!requested && env("GEMINI_API_KEY"))) {
    const apiKey = env("GEMINI_API_KEY");
    if (apiKey) return new GeminiLLMProvider(apiKey);
  }

  const candidates: LLMProviderKey[] = requested
    ? [requested]
    : (["openrouter", "nvidia", "groq", "together"] as LLMProviderKey[]);

  for (const key of candidates) {
    if (key === "gemini") continue;
    const config = OPENAI_COMPATIBLE_CONFIG[key];
    const apiKey = env(config.envKey);
    if (apiKey) {
      return new OpenAICompatibleLLMProvider(key, config.baseUrl, apiKey, env(config.modelEnvKey) || config.defaultModel);
    }
  }

  if (process.env.NODE_ENV === "production" && env("ALLOW_MOCK_PROVIDERS") !== "true") {
    throw new Error(
      "No LLM provider is configured (checked GEMINI_API_KEY, OPENROUTER_API_KEY, NVIDIA_API_KEY, " +
        "GROQ_API_KEY, TOGETHER_API_KEY). Refusing to fall back to MockLLMProvider in production " +
        "(see spec section 61/52). Set ALLOW_MOCK_PROVIDERS=true to explicitly opt into mock mode."
    );
  }

  return new MockLLMProvider();
}

export type { ILLMProvider } from "./LLMProvider";
