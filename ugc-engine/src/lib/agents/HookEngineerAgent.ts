import type { ILLMProvider } from "@/lib/llm";
import type { ProductInput } from "@/types/project";
import type { AudiencePsychology, CreativeConcept, HookCandidate } from "@/types/agents";
import type { IndustryFramework } from "@/types/industry";

/**
 * Agent 4 — Hook Engineer: generates multiple hook candidates across
 * frameworks, scores each, and selects the strongest (spec section 5).
 */
export class HookEngineerAgent {
  constructor(private llm: ILLMProvider) {}

  public async generateAndSelect(
    input: ProductInput,
    audience: AudiencePsychology,
    concept: CreativeConcept,
    industry: IndustryFramework
  ): Promise<{ hooks: HookCandidate[]; selectedHook: HookCandidate }> {
    const prompt = `Product: ${input.productName}. Benefits: ${input.keyBenefits.join(", ")}.
Pain point: ${audience.corePainPoint}. Desire: ${audience.primaryDesire}. Creative angle: ${concept.angle}.
Industry-preferred hook frameworks: ${industry.hookFrameworks.join(", ")}.

Generate at least 8 distinct hook candidates spanning: Pattern Interrupt, Curiosity, Problem-Solution, Contrarian, Direct Benefit, Question, Story, Social Proof.
Score each 0-10 on: relevance, clarity, curiosity, audienceFit, productFit, platformFit, naturalness (avoid clickbait).
Return JSON: { "hooks": [{ "id": string, "type": string, "script": string, "visualDirection": string, "scores": {"relevance": n, "clarity": n, "curiosity": n, "audienceFit": n, "productFit": n, "platformFit": n, "naturalness": n} }] }`;

    const { hooks: rawHooks } = await this.llm.generateJSON<{ hooks: Omit<HookCandidate, "viralityScore">[] }>({
      prompt,
      temperature: 0.9,
    });

    const hooks: HookCandidate[] = rawHooks.map((h) => ({
      ...h,
      viralityScore: average(Object.values(h.scores)),
    }));

    let selectedHook = [...hooks].sort((a, b) => b.viralityScore - a.viralityScore)[0];

    if (input.advancedCreative?.hookOverride) {
      selectedHook = {
        id: "manual-override",
        type: "Direct Benefit",
        script: input.advancedCreative.hookOverride,
        visualDirection: selectedHook?.visualDirection ?? "Direct to camera",
        scores: { relevance: 10, clarity: 10, curiosity: 10, audienceFit: 10, productFit: 10, platformFit: 10, naturalness: 10 },
        viralityScore: 10,
      };
    }

    return { hooks, selectedHook };
  }
}

function average(values: number[]): number {
  return Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2));
}
