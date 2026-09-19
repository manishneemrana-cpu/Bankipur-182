import type { ILLMProvider, LLMGenerateParams, MultimodalGenerateParams } from "./LLMProvider";

/**
 * Deterministic, schema-shaped fake responses for local development when no
 * GEMINI_API_KEY is configured. Every value is clearly synthetic so it can
 * never be mistaken for a real generation result downstream (see spec
 * section 61/52: never fake a successful generation in production; this
 * provider must not be selected when NODE_ENV === "production").
 */
export class MockLLMProvider implements ILLMProvider {
  public readonly providerName = "mock-llm";

  async generateJSON<T>(params: LLMGenerateParams): Promise<T> {
    return this.fakeShapeFor(params.prompt) as T;
  }

  async generateJSONFromVideo<T>(_params: MultimodalGenerateParams): Promise<T> {
    return {
      scores: { visualRealism: 8, characterConsistency: 8, productAccuracy: 8, motionQuality: 8 },
      failureReasons: [],
      suggestedPromptAdjustment: null,
    } as T;
  }

  /** Cheap heuristic: infer which agent is calling based on prompt keywords, return a matching stub. */
  private fakeShapeFor(prompt: string): unknown {
    const p = prompt.toLowerCase();

    if (p.includes("psychological pain point")) {
      return {
        corePainPoint: "[MOCK] Struggles to get a reliably good result on the first try.",
        primaryDesire: "[MOCK] Wants a fast, dependable win without extra effort.",
        objectionsToOvercome: ["[MOCK] Price seems high", "[MOCK] Not sure it works for me", "[MOCK] Tried similar things before"],
        emotionalTrigger: "[MOCK] Relief from a recurring frustration",
      };
    }

    if (p.includes("generate 5 distinct hook variations")) {
      return {
        concept: { angle: "[MOCK] Everyday frustration to quiet confidence", framework: "Problem-Solution", visualStyle: "Natural handheld UGC", advertisingObjective: "conversion" },
        hooks: [
          { id: "h1", type: "Pattern Interrupt", script: "[MOCK] Okay wait, I need to talk about this.", visualDirection: "Sudden close-up, surprised expression" },
          { id: "h2", type: "Curiosity", script: "[MOCK] Nobody told me this was even possible.", visualDirection: "Product reveal from off-frame" },
          { id: "h3", type: "Problem-Solution", script: "[MOCK] I was so tired of dealing with this every day.", visualDirection: "Frustrated reaction shot" },
          { id: "h4", type: "Contrarian", script: "[MOCK] Everyone's doing this wrong.", visualDirection: "Direct to camera, confident tone" },
          { id: "h5", type: "Direct Benefit", script: "[MOCK] This fixed it in under a week.", visualDirection: "Before/after cut" },
        ],
        selectedHook: { id: "h1", type: "Pattern Interrupt", script: "[MOCK] Okay wait, I need to talk about this.", visualDirection: "Sudden close-up, surprised expression" },
      };
    }

    if (p.includes("write a high-converting")) {
      return {
        scenes: [
          { sceneNumber: 1, purpose: "Hook", duration: 4, spokenDialogue: "[MOCK] Okay wait, I need to talk about this.", visualAction: "Close-up reaction", textOverlay: "wait..." },
          { sceneNumber: 2, purpose: "Problem", duration: 5, spokenDialogue: "[MOCK] I was dealing with this for months.", visualAction: "Frustrated everyday moment" },
          { sceneNumber: 3, purpose: "Discovery", duration: 5, spokenDialogue: "[MOCK] Then a friend told me about this.", visualAction: "Product introduced casually" },
          { sceneNumber: 4, purpose: "Demonstration", duration: 6, spokenDialogue: "[MOCK] Here's exactly how I use it.", visualAction: "Hands-on demonstration" },
          { sceneNumber: 5, purpose: "Proof", duration: 5, spokenDialogue: "[MOCK] Within a week I actually noticed a difference.", visualAction: "Confident, relaxed delivery" },
          { sceneNumber: 6, purpose: "CTA", duration: 5, spokenDialogue: "[MOCK] Link's below if you want to try it.", visualAction: "Direct to camera, holding product", textOverlay: "Shop Now" },
        ],
      };
    }

    if (p.includes("continuity bible")) {
      return {
        character: {
          age: "mid-20s", gender: "female", ethnicity: "unspecified / neutral casting",
          hairStyleColor: "shoulder-length brown hair, natural texture",
          clothing: "plain oversized cream sweater", distinguishingFeatures: "warm smile, minimal makeup",
          personality: "friendly, candid, slightly self-deprecating humor", speakingStyle: "casual, conversational, unscripted-sounding",
        },
        environment: { locationType: "bright home bedroom", interiorDetails: "unmade bed, plants, soft clutter", colorPalette: "warm neutrals, cream and beige", lighting: "natural window daylight", timeOfDay: "late morning" },
        product: { name: "[MOCK product]", containerType: "matte cardboard box", primaryColors: "brand primary + white", logoPosition: "front center", packagingAppearance: "clean, minimal, undistorted", dimensions: "handheld size", materials: "recyclable cardboard" },
      };
    }

    if (p.includes("cinematic video model prompts")) {
      return {
        scenes: [1, 2, 3, 4, 5, 6].map((n) => ({
          sceneNumber: n,
          camera: { shotType: n % 2 === 0 ? "Medium Shot" : "Close-Up", movement: "Handheld subtle shake", lens: "35mm lens", lighting: "Natural window daylight" },
          characterAction: "[MOCK] natural gesture matching dialogue",
          productInteraction: "[MOCK] holds product at chest height, label facing camera",
          audioCue: "room tone, subtle ambient hum",
          captionText: "[MOCK caption]",
          transition: n === 6 ? "cut" : "match-cut",
        })),
      };
    }

    return { mock: true, note: "No MockLLMProvider stub matched this prompt; returning empty object." };
  }
}
