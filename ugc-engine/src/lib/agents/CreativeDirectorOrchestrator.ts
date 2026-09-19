import type { ILLMProvider } from "@/lib/llm";
import type { ProductInput } from "@/types/project";
import type { CreativeStrategyOutput } from "@/types/agents";
import { getIndustryFramework } from "@/lib/industry/IndustryFrameworks";

import { BrandStrategistAgent } from "./BrandStrategistAgent";
import { AudienceStrategistAgent } from "./AudienceStrategistAgent";
import { CreativeDirectorAgent } from "./CreativeDirectorAgent";
import { HookEngineerAgent } from "./HookEngineerAgent";
import { ScriptWriterAgent } from "./ScriptWriterAgent";
import { ContinuityArchitectAgent } from "./ContinuityArchitectAgent";
import { StoryboardDirectorAgent } from "./StoryboardDirectorAgent";

/**
 * Runs Agents 1-7 in the deterministic sequence from spec section 3/59:
 * Brand -> Audience -> Creative Director -> Hook Engineer -> Script Writer
 * -> Continuity Architect -> Storyboard/Prompt Engineer.
 *
 * Agents 8-10 (Voice Director, Audio-Visual Editor, Quality Controller) run
 * later in the pipeline, inside the worker, because they depend on
 * generated media rather than pure text planning.
 */
export class CreativeDirectorOrchestrator {
  private brandStrategist: BrandStrategistAgent;
  private audienceStrategist: AudienceStrategistAgent;
  private creativeDirector: CreativeDirectorAgent;
  private hookEngineer: HookEngineerAgent;
  private scriptWriter: ScriptWriterAgent;
  private continuityArchitect: ContinuityArchitectAgent;
  private storyboardDirector: StoryboardDirectorAgent;

  constructor(llm: ILLMProvider) {
    this.brandStrategist = new BrandStrategistAgent(llm);
    this.audienceStrategist = new AudienceStrategistAgent(llm);
    this.creativeDirector = new CreativeDirectorAgent(llm);
    this.hookEngineer = new HookEngineerAgent(llm);
    this.scriptWriter = new ScriptWriterAgent(llm);
    this.continuityArchitect = new ContinuityArchitectAgent(llm);
    this.storyboardDirector = new StoryboardDirectorAgent(llm);
  }

  public async executePipeline(
    input: ProductInput,
    onStep?: (step: string) => void
  ): Promise<CreativeStrategyOutput> {
    const industry = getIndustryFramework(input.industry);

    onStep?.("BRAND_INTELLIGENCE");
    const brandIdentity = await this.brandStrategist.analyze(input);

    onStep?.("AUDIENCE_INTELLIGENCE");
    const audiencePsychology = await this.audienceStrategist.analyze(input);

    onStep?.("CREATIVE_STRATEGY");
    const creativeConcept = await this.creativeDirector.chooseConcept(input, audiencePsychology, industry);

    onStep?.("HOOK_GENERATION");
    const { hooks, selectedHook } = await this.hookEngineer.generateAndSelect(input, audiencePsychology, creativeConcept, industry);

    onStep?.("SCRIPT_WRITING");
    const script = await this.scriptWriter.write(input, creativeConcept, selectedHook);

    onStep?.("CONTINUITY_BIBLE");
    const continuityBible = await this.continuityArchitect.build(input, script);

    onStep?.("STORYBOARD");
    const storyboard = await this.storyboardDirector.buildStoryboard(input, script, continuityBible);

    return {
      brandIdentity,
      audiencePsychology,
      creativeConcept,
      hooks,
      selectedHook,
      script,
      continuityBible,
      storyboard,
    };
  }
}
