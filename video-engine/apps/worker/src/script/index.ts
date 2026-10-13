import type { Language, ProjectInput, ProjectType } from "@ave/shared-types";
import { TEMPLATES, type ScriptTemplate } from "./templates.js";

/** Small deterministic PRNG (mulberry32) seeded from a string. */
function seeded(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = (h ^= h >>> 16) >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function templateFor(type: ProjectType): ScriptTemplate {
  return TEMPLATES.find((t) => t.types.includes(type)) ?? TEMPLATES[1]!;
}

const TYPE_LABEL: Record<ProjectType, string> = { plot: "plot", tower: "tower", villa: "villa", "2bhk": "2 BHK", "3bhk": "3 BHK", commercial: "commercial" };

function fill(s: string, vars: Record<string, string>) {
  return s.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "");
}

/** Split script text into spoken sentences (supports Latin and Devanagari danda). */
export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?।])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface GeneratedScript {
  templateId: string;
  sentences: string[];
  text: string;
}

export function generateScript(input: Pick<ProjectInput, "name" | "builderName" | "tagline" | "projectType" | "addressText" | "language" | "images" | "customScript">): GeneratedScript {
  const custom = input.customScript?.trim();
  if (custom) {
    const sentences = splitSentences(custom);
    return { templateId: "custom", sentences, text: sentences.join(" ") };
  }
  const tpl = templateFor(input.projectType);
  const rnd = seeded(`${input.name}|${input.builderName}|${input.projectType}`);
  const lang: Language = input.language;
  const hasAmenities = input.images.some((i) => i.role === "amenity");
  const vars = {
    name: input.name, builder: input.builderName, tagline: input.tagline.trim(),
    location: input.addressText, type: TYPE_LABEL[input.projectType],
  };
  const sentences: string[] = [];
  for (const slot of tpl.slots) {
    if (slot.optionalIf === "noTagline" && !vars.tagline) continue;
    if (slot.optionalIf === "noAmenities" && !hasAmenities) continue;
    const variants = slot.variants[lang];
    const pick = variants[Math.floor(rnd() * variants.length)]!;
    let line = fill(pick, vars).trim();
    if (slot.id === "tagline" && !/[.!?।]$/.test(line)) line += ".";
    sentences.push(line);
  }
  return { templateId: tpl.id, sentences, text: sentences.join(" ") };
}
