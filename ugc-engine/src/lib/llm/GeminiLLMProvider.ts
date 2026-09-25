import { GoogleGenAI } from "@google/genai";
import type { ILLMProvider, LLMGenerateParams, MultimodalGenerateParams } from "./LLMProvider";

// gemini-2.5-pro was retired for new API keys — confirmed via a live 404
// ("no longer available to new users") naming gemini-3.1-pro-preview as its
// replacement.
const MODEL = "gemini-3.1-pro-preview";

/** Real provider adapter. Used whenever GEMINI_API_KEY is configured. */
export class GeminiLLMProvider implements ILLMProvider {
  public readonly providerName = MODEL;
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generateJSON<T>(params: LLMGenerateParams): Promise<T> {
    const response = await this.ai.models.generateContent({
      model: MODEL,
      contents: params.systemInstruction
        ? `${params.systemInstruction}\n\n${params.prompt}`
        : params.prompt,
      config: {
        responseMimeType: "application/json",
        temperature: params.temperature ?? 0.8,
      },
    });

    const text = response.text;
    if (!text) throw new Error("Gemini returned an empty response");
    return JSON.parse(text) as T;
  }

  async generateJSONFromVideo<T>(params: MultimodalGenerateParams): Promise<T> {
    const response = await this.ai.models.generateContent({
      model: MODEL,
      contents: [
        { inlineData: { mimeType: params.mimeType, data: params.base64Data } },
        params.prompt,
      ],
      config: { responseMimeType: "application/json" },
    });

    const text = response.text;
    if (!text) throw new Error("Gemini returned an empty response");
    return JSON.parse(text) as T;
  }
}
