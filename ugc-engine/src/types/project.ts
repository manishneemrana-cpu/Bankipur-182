export type ProjectMode = "simple" | "pro_studio" | "autopilot";
export type AspectRatio = "9:16" | "16:9" | "1:1";
export type ProjectStatus = "draft" | "queued" | "processing" | "completed" | "failed";

export type PlatformPreset =
  | "instagram_reels"
  | "facebook"
  | "youtube_shorts"
  | "youtube"
  | "linkedin"
  | "tiktok"
  | "website"
  | "ad_platform";

export const PLATFORM_ASPECT_RATIO: Record<PlatformPreset, AspectRatio> = {
  instagram_reels: "9:16",
  facebook: "1:1",
  youtube_shorts: "9:16",
  youtube: "16:9",
  linkedin: "1:1",
  tiktok: "9:16",
  website: "16:9",
  ad_platform: "9:16",
};

export interface ReferenceAsset {
  type: "front" | "back" | "side" | "packaging" | "logo" | "lifestyle";
  url: string;
}

export interface ProductInput {
  organizationId: string;
  brandKitId: string;
  brandName: string;
  productName: string;
  description: string;
  industry: string; // key into IndustryFramework registry; "general" if unknown
  category?: string;
  keyBenefits: string[];
  targetAudience: string;
  priceOffer?: string;
  ctaText: string;
  language: string;
  voiceLanguage?: string;
  subtitleLanguage?: string;
  durationSeconds: number;
  aspectRatio: AspectRatio;
  platformPreset?: PlatformPreset;
  referenceAssets?: ReferenceAsset[];
  websiteUrl?: string;
  mode: ProjectMode;
  creatorProfileId?: string;
  advancedCreative?: AdvancedCreativeControls;
}

/** Pro Studio Mode manual overrides — any field left unset falls back to AI selection. */
export interface AdvancedCreativeControls {
  creativeConcept?: string;
  hookOverride?: string;
  toneOfVoice?: string;
  emotionalDirection?: string;
  advertisingObjective?: string;
  creator?: {
    gender?: string;
    approximateAge?: string;
    appearance?: string;
    personality?: string;
    clothing?: string;
    ethnicity?: string;
    role?: "influencer" | "expert" | "customer" | "founder";
  };
  cinematography?: {
    cameraType?: string;
    shotType?: string;
    lens?: string;
    movement?: string;
    depthOfField?: string;
    lighting?: string;
    timeOfDay?: string;
    location?: string;
    composition?: string;
  };
  audio?: {
    voiceGender?: string;
    accent?: string;
    speed?: string;
    emotion?: string;
    musicGenre?: string;
    sfxEnabled?: boolean;
  };
}
