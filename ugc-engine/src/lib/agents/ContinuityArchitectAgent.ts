import type { ILLMProvider } from "@/lib/llm";
import type { ProductInput } from "@/types/project";
import type { ContinuityBible, ScriptScene } from "@/types/agents";

/**
 * Continuity Bible generator (spec section 10): locks character, environment
 * and product identity so every scene generation request references the
 * same facts, minimizing face/clothing/product drift across separate
 * generation calls.
 */
export class ContinuityArchitectAgent {
  constructor(private llm: ILLMProvider) {}

  public async build(input: ProductInput, script: ScriptScene[]): Promise<ContinuityBible> {
    const creator = input.advancedCreative?.creator;

    const prompt = `Based on the script: ${JSON.stringify(script)}, generate a Continuity Bible for a UGC video.
${creator ? `The user specified a creator profile: ${JSON.stringify(creator)}. Use these details exactly.` : "No creator profile was specified; choose one appropriate for the target audience."}
Product: ${input.productName} - ${input.description}.
Explicitly define: physical characteristics of the UGC creator, exact clothing, environmental background, lighting style, and strict rules for how the product packaging must appear identically across all scenes.

Return JSON matching:
{ "character": {"age":string,"gender":string,"ethnicity":string,"hairStyleColor":string,"clothing":string,"distinguishingFeatures":string,"personality":string,"speakingStyle":string},
  "environment": {"locationType":string,"interiorDetails":string,"colorPalette":string,"lighting":string,"timeOfDay":string},
  "product": {"name":string,"containerType":string,"primaryColors":string,"logoPosition":string,"packagingAppearance":string,"dimensions":string,"materials":string} }`;

    return this.llm.generateJSON<ContinuityBible>({ prompt, temperature: 0.5 });
  }
}
