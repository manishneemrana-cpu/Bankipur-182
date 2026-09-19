/**
 * Every creative agent talks to the LLM only through this interface, never
 * to a specific SDK. Swap GeminiLLMProvider for another vendor without
 * touching agent logic.
 */
export interface LLMGenerateParams {
  systemInstruction?: string;
  prompt: string;
  jsonSchemaHint?: string; // human-readable shape description injected into the prompt
  temperature?: number;
}

export interface MultimodalGenerateParams extends LLMGenerateParams {
  mimeType: string;
  base64Data: string;
}

export interface ILLMProvider {
  readonly providerName: string;
  generateJSON<T>(params: LLMGenerateParams): Promise<T>;
  generateJSONFromVideo<T>(params: MultimodalGenerateParams): Promise<T>;
}
