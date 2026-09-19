import type { ProductInput } from "@/types/project";
import type { ScriptScene, VoiceDirection } from "@/types/agents";

/**
 * Agent 8 — Voice Director: derives delivery instructions (spec section 19).
 * This is pure derivation logic, not an LLM call — voice params come from
 * explicit user overrides or sane defaults per language/industry, so the
 * same script always gets a consistent, auditable voice configuration.
 */
export class VoiceDirectorAgent {
  public direct(input: ProductInput): VoiceDirection {
    const audio = input.advancedCreative?.audio;

    return {
      gender: audio?.voiceGender ?? "female",
      ageProfile: "young adult",
      accent: audio?.accent ?? defaultAccentForLanguage(input.voiceLanguage ?? input.language),
      language: input.voiceLanguage ?? input.language,
      emotion: audio?.emotion ?? "warm, conversational",
      speed: parseSpeed(audio?.speed),
      pitch: 0,
      energy: "medium",
    };
  }

  /** Builds the full voiceover script text in scene order for TTS synthesis. */
  public buildVoiceoverScript(script: ScriptScene[]): string {
    return script.map((s) => s.spokenDialogue).join(" ");
  }
}

function defaultAccentForLanguage(language: string): string {
  const map: Record<string, string> = {
    English: "neutral",
    Hindi: "standard Hindi",
    Hinglish: "casual Indian-English blend",
    Bengali: "standard Bengali",
    Marathi: "standard Marathi",
    Tamil: "standard Tamil",
    Telugu: "standard Telugu",
  };
  return map[language] ?? "neutral";
}

function parseSpeed(speed?: string): number {
  if (!speed) return 1.0;
  const n = Number(speed);
  if (Number.isNaN(n)) return 1.0;
  return Math.min(1.3, Math.max(0.7, n));
}
