import type { ILLMProvider, LLMGenerateParams, MultimodalGenerateParams } from "./LLMProvider";

/**
 * Generic adapter for any provider that speaks the OpenAI chat-completions
 * wire format — OpenRouter, NVIDIA NIM (build.nvidia.com), Groq, Together AI,
 * and self-hosted OpenAI-compatible servers all qualify. One class covers
 * all of them; only baseUrl/model/apiKey differ (see LLMProviderRegistry).
 *
 * Not every one of these providers honors `response_format: json_object`
 * reliably, so responses are defensively unwrapped (strip markdown code
 * fences, extract the first {...} block) before JSON.parse.
 */
export class OpenAICompatibleLLMProvider implements ILLMProvider {
  constructor(
    public readonly providerName: string,
    private baseUrl: string,
    private apiKey: string,
    private model: string
  ) {}

  async generateJSON<T>(params: LLMGenerateParams): Promise<T> {
    const messages = [
      {
        role: "system",
        content:
          params.systemInstruction ??
          "You output only valid JSON. No markdown code fences, no prose before or after the JSON.",
      },
      { role: "user", content: params.prompt },
    ];

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: params.temperature ?? 0.8,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      throw new Error(`${this.providerName} API error (${response.status}): ${await response.text()}`);
    }

    const data = await response.json();
    const content: string = data.choices?.[0]?.message?.content ?? "";
    return parseJsonLoosely<T>(content, this.providerName);
  }

  async generateJSONFromVideo<T>(_params: MultimodalGenerateParams): Promise<T> {
    throw new Error(
      `${this.providerName} does not support video-input QC evaluation in this adapter. ` +
        "Use GeminiLLMProvider (multimodal) for the Quality Control agent, or configure a vision-capable model here."
    );
  }
}

function parseJsonLoosely<T>(content: string, providerName: string): T {
  const stripped = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "");

  try {
    return JSON.parse(stripped) as T;
  } catch {
    const match = stripped.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        // fall through to the error below
      }
    }
    throw new Error(`${providerName} did not return parseable JSON: ${content.slice(0, 200)}`);
  }
}
