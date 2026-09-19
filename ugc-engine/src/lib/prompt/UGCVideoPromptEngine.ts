import type { CameraSettings, ContinuityBible, StoryboardScene } from "@/types/agents";
import type { AspectRatio } from "@/types/project";

export interface SceneContext {
  sceneNumber: number;
  visualAction: string;
  characterAction: string;
  productInteraction: string;
}

/**
 * Structured prompt formula (spec section 4/14):
 * SUBJECT + ACTION + PRODUCT + ENVIRONMENT + CAMERA + LIGHTING + STYLE + NEGATIVE CONSTRAINTS.
 * Never send a generic prompt like "create a professional UGC video" to a
 * video model — every scene must be built from the continuity bible.
 */
export class UGCVideoPromptEngine {
  public static buildModelPrompt(
    scene: SceneContext,
    continuity: ContinuityBible,
    camera: CameraSettings,
    aspectRatio: AspectRatio = "9:16"
  ): { prompt: string; negativePrompt: string } {
    const subjectSegment = `An authentic ${continuity.character.age} ${continuity.character.ethnicity} ${continuity.character.gender}, with ${continuity.character.hairStyleColor}, wearing ${continuity.character.clothing}. ${continuity.character.distinguishingFeatures}.`;

    const actionSegment = `Character is performing action: ${scene.characterAction}. Expressing natural emotion: warm, genuine engagement. ${scene.visualAction}.`;

    const productSegment = `Holding and interacting with product: ${continuity.product.name}, a ${continuity.product.containerType} with ${continuity.product.primaryColors} packaging and a clearly visible logo on the ${continuity.product.logoPosition}. ${scene.productInteraction}. Product identity remains undistorted and consistent with reference images.`;

    const environmentSegment = `Environment: ${continuity.environment.locationType}, featuring ${continuity.environment.interiorDetails}. Color scheme: ${continuity.environment.colorPalette}. Time of day: ${continuity.environment.timeOfDay}.`;

    const cameraSegment = `Cinematography: shot with smartphone front-camera style, ${camera.shotType}, ${camera.lens}, ${camera.movement}. Shallow depth of field, soft blurred background. ${camera.lighting}. Aspect ratio ${aspectRatio}.`;

    const styleSegment = `Style: authentic User Generated Content (UGC), social-media reel aesthetic, unpolished high-definition video, natural skin textures, real room acoustics, non-commercial candid look. No professional studio sheen.`;

    const continuitySegment = `Continuity constraints: character appearance, clothing, product packaging, and environment must remain identical to previous scenes in this sequence.`;

    const prompt = [subjectSegment, actionSegment, productSegment, environmentSegment, cameraSegment, styleSegment, continuitySegment].join(" ");

    const negativePrompt =
      "morphing face, extra limbs, deformed fingers, changing clothing color, inconsistent product labeling, " +
      "unnatural skin smoothing, glossy CGI look, distorted brand logo, flickering lights, morphing background, " +
      "cinematic movie grain, overexposed highlights, text artifacts, watermarks, duplicate limbs";

    return { prompt, negativePrompt };
  }

  /** Applies QC failure reasons to a prompt for a targeted regeneration attempt (spec section 24). */
  public static applyQcFeedback(originalPrompt: string, failureReasons: string[]): string {
    if (!failureReasons.length) return originalPrompt;
    return `${originalPrompt} (Correct the following issues from the previous attempt: ${failureReasons.join("; ")}.)`;
  }

  public static buildStoryboardScenePrompt(scene: StoryboardScene, continuity: ContinuityBible, aspectRatio: AspectRatio): { prompt: string; negativePrompt: string } {
    return this.buildModelPrompt(
      {
        sceneNumber: scene.sceneNumber,
        visualAction: scene.visualDescription,
        characterAction: scene.characterAction,
        productInteraction: scene.productInteraction,
      },
      continuity,
      scene.camera,
      aspectRatio
    );
  }
}
