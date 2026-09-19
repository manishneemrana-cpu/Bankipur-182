import type { ILLMProvider } from "@/lib/llm";
import type { ProductInput } from "@/types/project";
import type { AudiencePsychology } from "@/types/agents";

/** Agent 2 — Audience Strategist: determines audience psychology and communication angle. */
export class AudienceStrategistAgent {
  constructor(private llm: ILLMProvider) {}

  public async analyze(input: ProductInput): Promise<AudiencePsychology> {
    const prompt = `Analyze product: ${input.productName} - ${input.description}. Target Audience: ${input.targetAudience}.
Identify the deep psychological pain point, primary desire, top 3 objections, and emotional trigger.
Base this only on the provided product/audience information; do not invent statistics or testimonials.
Return JSON: { "corePainPoint": string, "primaryDesire": string, "objectionsToOvercome": string[], "emotionalTrigger": string }`;

    return this.llm.generateJSON<AudiencePsychology>({ prompt, temperature: 0.6 });
  }
}
