import type { ILLMProvider } from "@/lib/llm";
import type { ProductInput } from "@/types/project";
import type { AudiencePsychology, CreativeConcept } from "@/types/agents";
import type { IndustryFramework } from "@/types/industry";

/** Agent 3 — Creative Director: chooses the creative concept/framework for this product. */
export class CreativeDirectorAgent {
  constructor(private llm: ILLMProvider) {}

  public async chooseConcept(
    input: ProductInput,
    audience: AudiencePsychology,
    industry: IndustryFramework
  ): Promise<CreativeConcept> {
    const prompt = `Act as an elite Direct Response Creative Director.
Product: ${input.productName}. Industry: ${industry.industry}.
Pain point: ${audience.corePainPoint}. Desire: ${audience.primaryDesire}.
Preferred frameworks for this industry: ${industry.preferredCreativeFrameworks.join(", ")}.
Advertising objective (if specified by user): ${input.advancedCreative?.advertisingObjective ?? "maximize conversion"}.
Choose ONE creative concept most appropriate for this specific product and objective — do not default to the same template for every product.
Return JSON: { "angle": string, "framework": string, "visualStyle": string, "advertisingObjective": string }`;

    const concept = await this.llm.generateJSON<CreativeConcept>({ prompt, temperature: 0.7 });

    // Pro Studio manual override always wins over AI selection.
    if (input.advancedCreative?.creativeConcept) {
      concept.angle = input.advancedCreative.creativeConcept;
    }

    return concept;
  }
}
