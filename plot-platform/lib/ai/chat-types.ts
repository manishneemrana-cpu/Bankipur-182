/** Shapes shared between the server route and the client chat UI — no
 * "server-only" here so the widget can import them directly. */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ExecutedToolCall {
  name: string;
  input: Record<string, unknown>;
  output: unknown;
}

export interface ChatTurnResult {
  text: string;
  toolCalls: ExecutedToolCall[];
}
