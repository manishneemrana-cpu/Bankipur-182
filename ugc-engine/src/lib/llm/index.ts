import type { ILLMProvider } from "./LLMProvider";
import { GeminiLLMProvider } from "./GeminiLLMProvider";
import { MockLLMProvider } from "./MockLLMProvider";
import { OpenAICompatibleLLMProvider } from "./OpenAICompatibleLLMProvider";

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
    // llama-3.1-70b-instruct reached NVIDIA NIM end-of-life 2026-08-26; 3.3 is its
    // direct successor on the same catalog. Override via NVIDIA_MODEL if this ages out too.
    defaultModel: "meta/llama-3.3-70b-instruct",
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

let cached: ILLMProvider | null = null;

/**
 * Selection order: explicit DEFAULT_LLM_PROVIDER wins; otherwise the first
 * provider with a configured API key is used; otherwise Gemini if its key
 * is set; otherwise MockLLMProvider (dev only, or ALLOW_MOCK_PROVIDERS=true).
 */
export function getLLMProvider(): ILLMProvider {
  if (cached) return cached;

  const requested = process.env.DEFAULT_LLM_PROVIDER as LLMProviderKey | undefined;

  if (requested === "gemini" || (!requested && process.env.GEMINI_API_KEY)) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      cached = new GeminiLLMProvider(apiKey);
      return cached;
    }
  }

  const candidates: LLMProviderKey[] = requested
    ? [requested]
    : (["openrouter", "nvidia", "groq", "together"] as LLMProviderKey[]);

  for (const key of candidates) {
    if (key === "gemini") continue;
    const config = OPENAI_COMPATIBLE_CONFIG[key];
    const apiKey = process.env[config.envKey];
    if (apiKey) {
      cached = new OpenAICompatibleLLMProvider(key, config.baseUrl, apiKey, process.env[config.modelEnvKey] || config.defaultModel);
      return cached;
    }
  }

  if (process.env.NODE_ENV === "production" && process.env.ALLOW_MOCK_PROVIDERS !== "true") {
    throw new Error(
      "No LLM provider is configured (checked GEMINI_API_KEY, OPENROUTER_API_KEY, NVIDIA_API_KEY, " +
        "GROQ_API_KEY, TOGETHER_API_KEY). Refusing to fall back to MockLLMProvider in production " +
        "(see spec section 61/52). Set ALLOW_MOCK_PROVIDERS=true to explicitly opt into mock mode."
    );
  }

  cached = new MockLLMProvider();
  return cached;
}

export type { ILLMProvider } from "./LLMProvider";
