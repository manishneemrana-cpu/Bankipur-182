import type { ILLMProvider } from "@/lib/llm";
import type { ProductInput } from "@/types/project";
import type { CreativeConcept, HookCandidate, ScriptScene } from "@/types/agents";
import { getIndustryFramework } from "@/lib/industry/IndustryFrameworks";

/** Agent 5 — Script Writer: natural, human-sounding UGC dialogue split into scenes (spec section 7/8). */
export class ScriptWriterAgent {
  constructor(private llm: ILLMProvider) {}

  public async write(input: ProductInput, concept: CreativeConcept, selectedHook: HookCandidate): Promise<ScriptScene[]> {
    const industry = getIndustryFramework(input.industry);

    const prompt = `Write a high-converting, natural-sounding UGC script for a ${input.durationSeconds}-second video.
Framework: ${concept.framework}. Selected Hook: ${selectedHook.script}.
Language: ${input.language}. CTA: ${input.ctaText}.
Tone: ${input.advancedCreative?.toneOfVoice ?? industry.defaultTone}.

Rules: NO corporate jargon, NO overly enthusiastic fake inflection, NO fabricated statistics, testimonials, or claims not in the product description. Sounds like a real person recording on an iPhone.
Structure: Hook -> Problem/context -> Discovery -> Demonstration -> Proof (only if proof was provided) -> CTA.
Split into chronological scenes whose durations sum to exactly ${input.durationSeconds} seconds.
${industry.requiredDisclaimers.length ? `Include this disclaimer naturally if relevant: ${industry.requiredDisclaimers.join("; ")}` : ""}

Return JSON: { "scenes": [{ "sceneNumber": n, "purpose": "Hook"|"Problem"|"Discovery"|"Solution"|"Demonstration"|"Proof"|"CTA", "duration": n, "spokenDialogue": string, "visualAction": string, "textOverlay": string }] }`;

    const { scenes } = await this.llm.generateJSON<{ scenes: ScriptScene[] }>({ prompt, temperature: 0.75 });
    return normalizeDurations(scenes, input.durationSeconds);
  }
}

/** The LLM's scene durations rarely sum exactly to the target; rescale proportionally rather than truncating content. */
function normalizeDurations(scenes: ScriptScene[], targetSeconds: number): ScriptScene[] {
  const total = scenes.reduce((sum, s) => sum + s.duration, 0);
  if (total === 0 || total === targetSeconds) return scenes;

  const scale = targetSeconds / total;
  let allocated = 0;

  return scenes.map((scene, i) => {
    const isLast = i === scenes.length - 1;
    const duration = isLast ? targetSeconds - allocated : Math.max(1, Math.round(scene.duration * scale));
    allocated += duration;
    return { ...scene, duration };
  });
}
