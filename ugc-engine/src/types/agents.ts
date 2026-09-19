export interface AudiencePsychology {
  corePainPoint: string;
  primaryDesire: string;
  objectionsToOvercome: string[];
  emotionalTrigger: string;
}

export type CreativeFramework =
  | "Problem-Solution"
  | "Testimonial"
  | "Unboxing"
  | "Founder Story"
  | "Expert Explanation"
  | "Before-After"
  | "Day-in-the-Life"
  | "Review"
  | "Comparison"
  | "Educational"
  | "Emotional Story"
  | "Lifestyle"
  | "Direct Response"
  | "Social Proof"
  | "FAQ"
  | "Myth Busting"
  | "Product Discovery";

export interface CreativeConcept {
  angle: string;
  framework: CreativeFramework;
  visualStyle: string;
  advertisingObjective: string;
}

export type HookType =
  | "Pattern Interrupt"
  | "Curiosity"
  | "Problem-Solution"
  | "Contrarian"
  | "Direct Benefit"
  | "Question"
  | "Story"
  | "Social Proof";

export interface HookCandidate {
  id: string;
  type: HookType;
  script: string;
  visualDirection: string;
  scores: {
    relevance: number;
    clarity: number;
    curiosity: number;
    audienceFit: number;
    productFit: number;
    platformFit: number;
    naturalness: number;
  };
  viralityScore: number; // 0-10 aggregate
}

export interface ScriptScene {
  sceneNumber: number;
  purpose: "Hook" | "Problem" | "Discovery" | "Solution" | "Demonstration" | "Proof" | "CTA";
  duration: number;
  spokenDialogue: string;
  visualAction: string;
  textOverlay?: string;
}

export interface ContinuityBible {
  character: {
    age: string;
    gender: string;
    ethnicity: string;
    hairStyleColor: string;
    clothing: string;
    distinguishingFeatures: string;
    personality: string;
    speakingStyle: string;
  };
  environment: {
    locationType: string;
    interiorDetails: string;
    colorPalette: string;
    lighting: string;
    timeOfDay: string;
  };
  product: {
    name: string;
    containerType: string;
    primaryColors: string;
    logoPosition: string;
    packagingAppearance: string;
    dimensions?: string;
    materials?: string;
  };
}

export interface CameraSettings {
  shotType: "Extreme Close-Up" | "Close-Up" | "Medium Shot" | "Wide Shot";
  movement: "Handheld subtle shake" | "Static tripod" | "Slow pan right" | "Push in";
  lens: "24mm wide angle lens" | "35mm lens" | "50mm portrait lens";
  lighting: "Natural window daylight" | "Warm indoor ring light" | "Golden hour sunlight";
}

export interface StoryboardScene {
  sceneNumber: number;
  duration: number;
  purpose: ScriptScene["purpose"];
  dialogue: string;
  visualDescription: string;
  camera: CameraSettings;
  characterAction: string;
  productInteraction: string;
  audioCue: string;
  captionText: string;
  transition: "cut" | "crossfade" | "whip-pan" | "match-cut";
  modelPrompt: string;
  negativePrompt: string;
}

export interface CreativeStrategyOutput {
  brandIdentity: Record<string, unknown>;
  audiencePsychology: AudiencePsychology;
  creativeConcept: CreativeConcept;
  hooks: HookCandidate[];
  selectedHook: HookCandidate;
  script: ScriptScene[];
  continuityBible: ContinuityBible;
  storyboard: StoryboardScene[];
}

export interface VoiceDirection {
  gender: string;
  ageProfile: string;
  accent: string;
  language: string;
  emotion: string;
  speed: number; // 0.7 - 1.3
  pitch: number; // -1 to 1
  energy: "low" | "medium" | "high";
}

export interface EditDirection {
  transitions: StoryboardScene["transition"][];
  musicGenre: string;
  musicEnergyArc: "build" | "steady" | "drop-in-middle";
  sfxCues: Array<{ sceneNumber: number; cue: string }>;
  captionStyle: {
    fontFamily: string;
    highlightColor: string;
    position: "lower-third" | "center-safe";
  };
}

export interface QCScoreSet {
  visualRealism: number;
  characterConsistency: number;
  productAccuracy: number;
  motionQuality: number;
}

export interface QCResult {
  passed: boolean;
  scores: QCScoreSet;
  failureReasons: string[];
  suggestedPromptAdjustment?: string;
}
