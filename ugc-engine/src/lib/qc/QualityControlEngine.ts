import type { ILLMProvider } from "@/lib/llm";
import type { ContinuityBible, QCResult, StoryboardScene } from "@/types/agents";

/**
 * Multi-stage AI quality control (spec section 8/24/25). Every generated
 * scene must clear these thresholds before it is locked; otherwise the
 * failure reasons are folded back into the next generation attempt via
 * UGCVideoPromptEngine.applyQcFeedback.
 */
export const QC_THRESHOLDS = {
  visualRealism: 7,
  characterConsistency: 7,
  productAccuracy: 8,
  motionQuality: 6,
  averageMinimum: 8.0,
};

export class QualityControlEngine {
  constructor(private llm: ILLMProvider) {}

  public async evaluateScene(
    sceneVideoBuffer: Buffer,
    expectedStoryboard: StoryboardScene,
    continuityBible: ContinuityBible
  ): Promise<QCResult> {
    const prompt = `You are a strict Quality Control Engineer for video ads. Compare the generated video against requirements:
Expected Visual: ${expectedStoryboard.visualDescription}
Character Bible: ${JSON.stringify(continuityBible.character)}
Product Rules: ${JSON.stringify(continuityBible.product)}

Evaluate on a scale 1-10:
1. Visual Realism (detect warping, extra limbs, morphing faces)
2. Character Consistency (matches the character bible across scenes)
3. Product Accuracy (product is not deformed, blurry, or mislabeled)
4. Motion Quality (natural, non-jittery movement)

Respond with JSON: { "scores": {"visualRealism": n, "characterConsistency": n, "productAccuracy": n, "motionQuality": n}, "failureReasons": string[], "suggestedPromptAdjustment": string | null }`;

    const evaluation = await this.llm.generateJSONFromVideo<{
      scores: QCResult["scores"];
      failureReasons: string[];
      suggestedPromptAdjustment: string | null;
    }>({
      prompt,
      mimeType: "video/mp4",
      base64Data: sceneVideoBuffer.toString("base64"),
    });

    const { scores } = evaluation;
    const average = (scores.visualRealism + scores.characterConsistency + scores.productAccuracy + scores.motionQuality) / 4;

    const passed =
      scores.visualRealism >= QC_THRESHOLDS.visualRealism &&
      scores.characterConsistency >= QC_THRESHOLDS.characterConsistency &&
      scores.productAccuracy >= QC_THRESHOLDS.productAccuracy &&
      scores.motionQuality >= QC_THRESHOLDS.motionQuality &&
      average >= QC_THRESHOLDS.averageMinimum;

    return {
      passed,
      scores,
      failureReasons: evaluation.failureReasons ?? [],
      suggestedPromptAdjustment: evaluation.suggestedPromptAdjustment ?? undefined,
    };
  }
}
