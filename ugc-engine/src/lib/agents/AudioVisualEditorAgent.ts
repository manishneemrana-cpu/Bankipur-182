import type { ProductInput } from "@/types/project";
import type { EditDirection, StoryboardScene } from "@/types/agents";
import { getIndustryFramework } from "@/lib/industry/IndustryFrameworks";

/**
 * Agent 9 — Audio-Visual Editor: determines timing, transitions, captions,
 * music and SFX direction (spec section 9's "Editing" fields, section 22).
 */
export class AudioVisualEditorAgent {
  public direct(input: ProductInput, storyboard: StoryboardScene[]): EditDirection {
    const industry = getIndustryFramework(input.industry);

    return {
      transitions: storyboard.map((s) => s.transition),
      musicGenre: input.advancedCreative?.audio?.musicGenre ?? defaultGenreForIndustry(industry.key),
      musicEnergyArc: industry.pacingMultiplier > 1.1 ? "build" : industry.pacingMultiplier < 0.9 ? "steady" : "drop-in-middle",
      sfxCues:
        input.advancedCreative?.audio?.sfxEnabled === false
          ? []
          : storyboard.map((s) => ({ sceneNumber: s.sceneNumber, cue: s.audioCue })),
      captionStyle: {
        fontFamily: "Inter",
        highlightColor: "#FFD400",
        position: "lower-third",
      },
    };
  }
}

function defaultGenreForIndustry(industryKey: string): string {
  const map: Record<string, string> = {
    beauty: "soft lo-fi",
    saas: "upbeat corporate-lite",
    food_beverage: "energetic pop",
    real_estate: "cinematic ambient",
    fashion: "trendy pop",
    fitness: "high-energy electronic",
  };
  return map[industryKey] ?? "neutral upbeat pop";
}
