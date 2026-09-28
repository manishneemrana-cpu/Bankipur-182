import "server-only";

import type { ChatMessage, ChatTurnResult } from "./chat-types";

export type {
  ChatMessage,
  ExecutedToolCall,
  ChatTurnResult,
} from "./chat-types";

/**
 * Provider-agnostic chat interface (§12.1). Inventory questions are answered
 * via tool calls against live data passed in by the caller, never RAG —
 * `executeTool` is the only way a provider touches project data, so no
 * provider ever sees more than the tool layer chooses to return.
 */
export interface ToolSpec {
  name: string;
  description: string;
  /** JSON Schema for the tool's input object. */
  inputSchema: Record<string, unknown>;
}

export interface ChatProvider {
  chat(args: {
    system: string;
    messages: ChatMessage[];
    tools: ToolSpec[];
    executeTool: (
      name: string,
      input: Record<string, unknown>,
    ) => Promise<unknown>;
  }): Promise<ChatTurnResult>;
}

export class ChatProviderError extends Error {}
