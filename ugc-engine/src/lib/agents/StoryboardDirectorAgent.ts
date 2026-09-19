import type { ILLMProvider } from "@/lib/llm";
import type { ProductInput } from "@/types/project";
import type { CameraSettings, ContinuityBible, ScriptScene, StoryboardScene } from "@/types/agents";
import { UGCVideoPromptEngine } from "@/lib/prompt/UGCVideoPromptEngine";
import { getIndustryFramework } from "@/lib/industry/IndustryFrameworks";

/**
 * Agent 6 (Storyboard Director) + Agent 7 (Prompt Engineer) combined
 * pipeline step: converts the script into camera-ready scenes, then
 * compiles each into a structured generative-video prompt via
 * UGCVideoPromptEngine (spec sections 9 & 14).
 */
export class StoryboardDirectorAgent {
  constructor(private llm: ILLMProvider) {}

  public async buildStoryboard(input: ProductInput, script: ScriptScene[], continuity: ContinuityBible): Promise<StoryboardScene[]> {
    const industry = getIndustryFramework(input.industry);
    const cinematography = input.advancedCreative?.cinematography;

    const prompt = `Convert this script into cinematic camera direction per scene.
Script: ${JSON.stringify(script)}
Industry visual emphasis: ${industry.visualEmphasis}. Pacing multiplier: ${industry.pacingMultiplier} (higher = faster cuts).
${cinematography ? `User-specified cinematography overrides: ${JSON.stringify(cinematography)}` : ""}

For each scene return camera settings, character action, product interaction, an audio cue, a short caption text, and a transition into the next scene.
Return JSON: { "scenes": [{ "sceneNumber": n, "camera": {"shotType": "Extreme Close-Up"|"Close-Up"|"Medium Shot"|"Wide Shot", "movement": "Handheld subtle shake"|"Static tripod"|"Slow pan right"|"Push in", "lens": "24mm wide angle lens"|"35mm lens"|"50mm portrait lens", "lighting": "Natural window daylight"|"Warm indoor ring light"|"Golden hour sunlight"}, "characterAction": string, "productInteraction": string, "audioCue": string, "captionText": string, "transition": "cut"|"crossfade"|"whip-pan"|"match-cut" }] }`;

    const { scenes: directions } = await this.llm.generateJSON<{
      scenes: Array<{
        sceneNumber: number;
        camera: CameraSettings;
        characterAction: string;
        productInteraction: string;
        audioCue: string;
        captionText: string;
        transition: StoryboardScene["transition"];
      }>;
    }>({ prompt, temperature: 0.6 });

    return script.map((scene) => {
      const direction = directions.find((d) => d.sceneNumber === scene.sceneNumber) ?? directions[0];

      const { prompt: modelPrompt, negativePrompt } = UGCVideoPromptEngine.buildModelPrompt(
        {
          sceneNumber: scene.sceneNumber,
          visualAction: scene.visualAction,
          characterAction: direction.characterAction,
          productInteraction: direction.productInteraction,
        },
        continuity,
        direction.camera,
        input.aspectRatio
      );

      return {
        sceneNumber: scene.sceneNumber,
        duration: scene.duration,
        purpose: scene.purpose,
        dialogue: scene.spokenDialogue,
        visualDescription: scene.visualAction,
        camera: direction.camera,
        characterAction: direction.characterAction,
        productInteraction: direction.productInteraction,
        audioCue: direction.audioCue,
        captionText: direction.captionText,
        transition: direction.transition,
        modelPrompt,
        negativePrompt,
      } satisfies StoryboardScene;
    });
  }
}
