import type { ILLMProvider } from "./LLMProvider";
import { GeminiLLMProvider } from "./GeminiLLMProvider";
import { MockLLMProvider } from "./MockLLMProvider";

let cached: ILLMProvider | null = null;

export function getLLMProvider(): ILLMProvider {
  if (cached) return cached;

  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    cached = new GeminiLLMProvider(apiKey);
    return cached;
  }

  if (process.env.NODE_ENV === "production" && process.env.ALLOW_MOCK_PROVIDERS !== "true") {
    throw new Error(
      "GEMINI_API_KEY is not configured. Refusing to fall back to MockLLMProvider in production " +
        "(see spec section 61/52: never fake a successful generation in production). Set " +
        "ALLOW_MOCK_PROVIDERS=true to explicitly opt into mock mode for a testing deploy."
    );
  }

  cached = new MockLLMProvider();
  return cached;
}

export type { ILLMProvider } from "./LLMProvider";
