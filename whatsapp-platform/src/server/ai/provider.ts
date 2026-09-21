import "server-only";

/**
 * Provider-agnostic AI interface — no vendor (OpenAI, Anthropic, etc.) is
 * wired in yet. Per the project rule: AI must never send a message
 * automatically unless the tenant has explicitly turned that on (there is
 * no such setting yet, so nothing here is ever called from an automatic
 * path today), and must always support a human handoff rather than fully
 * replacing an agent.
 */
export interface ConversationMessageSummaryInput {
  messages: Array<{ direction: "INBOUND" | "OUTBOUND"; body: string }>;
}

export interface LeadQualificationInput {
  conversationSummary: string;
  leadFields: Record<string, unknown>;
}

export interface AIProvider {
  /** A short human-readable summary of a conversation, for an agent's quick context. */
  summarizeConversation(input: ConversationMessageSummaryInput): Promise<string>;
  /** One or more suggested replies an agent can review and send — never sent automatically. */
  suggestReplies(input: ConversationMessageSummaryInput): Promise<string[]>;
  /** A 0-100 score and short rationale for how sales-ready a lead appears. */
  scoreLead(input: LeadQualificationInput): Promise<{ score: number; rationale: string }>;
}

/**
 * The default provider until a real one is configured. Every method throws
 * rather than returning a fabricated result — silently returning fake AI
 * output would be worse than clearly saying this isn't wired up yet.
 */
export class NotConfiguredAIProvider implements AIProvider {
  async summarizeConversation(): Promise<string> {
    throw new Error("No AI provider is configured yet (Phase 8 defines the interface only)");
  }
  async suggestReplies(): Promise<string[]> {
    throw new Error("No AI provider is configured yet (Phase 8 defines the interface only)");
  }
  async scoreLead(): Promise<{ score: number; rationale: string }> {
    throw new Error("No AI provider is configured yet (Phase 8 defines the interface only)");
  }
}

let activeProvider: AIProvider = new NotConfiguredAIProvider();

/** Swaps in a real provider implementation once one exists — not called anywhere yet. */
export function setAIProvider(provider: AIProvider): void {
  activeProvider = provider;
}

export function getAIProvider(): AIProvider {
  return activeProvider;
}
