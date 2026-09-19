import { GoogleGenAI } from "@google/genai";
import type { ILLMProvider, LLMGenerateParams, MultimodalGenerateParams } from "./LLMProvider";

/** Real provider adapter. Used whenever GEMINI_API_KEY is configured. */
export class GeminiLLMProvider implements ILLMProvider {
  public readonly providerName = "gemini-2.5-pro";
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generateJSON<T>(params: LLMGenerateParams): Promise<T> {
    const response = await this.ai.models.generateContent({
      model: "gemini-2.5-pro",
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
      model: "gemini-2.5-pro",
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
