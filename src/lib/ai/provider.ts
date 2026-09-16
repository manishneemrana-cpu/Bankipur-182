import "server-only";

/**
 * Provider-agnostic AI abstraction. Nothing in the app should import an
 * OpenAI/Anthropic SDK directly - always go through AIProvider so swapping
 * providers never requires rewriting call sites.
 *
 * Phase 3 ships this as architecture only: no UI action in this build
 * invokes a live provider yet. DEMO mode always uses MockProvider (zero
 * cost, zero external calls) - a real provider only activates once
 * AI_PROVIDER + the matching API key are configured, which is a Phase 4+
 * concern tied to the approval/execution engine.
 */
export type CompletionRequest = {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
};

export type CompletionResult = {
  text: string;
  costUsd: number;
  provider: string;
  model: string;
};

export interface AIProvider {
  readonly name: string;
  complete(request: CompletionRequest): Promise<CompletionResult>;
}

/**
 * Deterministic, zero-cost provider used in DEMO mode and in any
 * environment where no real provider is configured. Never makes a
 * network call.
 */
export class MockProvider implements AIProvider {
  readonly name = "mock";

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    return {
      text: `[MOCK RESPONSE - no live AI provider configured]\n\nTask: ${request.userPrompt.slice(0, 200)}`,
      costUsd: 0,
      provider: this.name,
      model: "mock",
    };
  }
}

let cachedProvider: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (cachedProvider) return cachedProvider;

  const configured = process.env.AI_PROVIDER?.toLowerCase();

  // No provider configured, or explicitly "mock" - always safe, no egress.
  if (!configured || configured === "mock") {
    cachedProvider = new MockProvider();
    return cachedProvider;
  }

  // Real providers are intentionally not wired up here yet - Phase 3 is
  // architecture only. Wiring a real provider without a human explicitly
  // configuring both AI_PROVIDER and its API key would violate the
  // NO ASSUMPTION rule.
  throw new Error(
    `AI_PROVIDER="${configured}" is not yet implemented. Only "mock" is available until a real provider is wired up alongside the execution engine.`,
  );
}
