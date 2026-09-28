import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import type {
  ChatProvider,
  ChatTurnResult,
  ExecutedToolCall,
} from "./provider";

const MAX_TOOL_ROUNDS = 6;

/** Anthropic adapter (§12.1). Runs the tool-use loop server-side and returns
 * only the final text plus the executed tool calls — no raw provider
 * messages leak past this module. */
export function createAnthropicProvider(
  apiKey: string,
  model: string,
): ChatProvider {
  const client = new Anthropic({ apiKey });

  return {
    async chat({
      system,
      messages,
      tools,
      executeTool,
    }): Promise<ChatTurnResult> {
      const anthropicTools = tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
      }));

      const history: Anthropic.MessageParam[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const executed: ExecutedToolCall[] = [];

      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const response = await client.messages.create({
          model,
          max_tokens: 1024,
          system,
          messages: history,
          tools: anthropicTools,
        });

        const toolUses = response.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
        );

        if (toolUses.length === 0) {
          const text = response.content
            .filter((b): b is Anthropic.TextBlock => b.type === "text")
            .map((b) => b.text)
            .join("\n")
            .trim();
          return { text, toolCalls: executed };
        }

        history.push({ role: "assistant", content: response.content });

        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const use of toolUses) {
          const input = (use.input ?? {}) as Record<string, unknown>;
          const output = await executeTool(use.name, input);
          executed.push({ name: use.name, input, output });
          toolResults.push({
            type: "tool_result",
            tool_use_id: use.id,
            content: JSON.stringify(output),
          });
        }
        history.push({ role: "user", content: toolResults });
      }

      return {
        text: "I'm having trouble finishing that — please try rephrasing, or contact the sales team.",
        toolCalls: executed,
      };
    },
  };
}
