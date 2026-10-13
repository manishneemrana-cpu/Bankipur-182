import type { ScriptSegment } from "@ave/shared-types";
import type { CharAlignment } from "../providers/voiceover/types.js";

/**
 * Assign each sentence a [start,end] window inside the voiceover.
 * Without word-level alignment we distribute the known total duration by character weight,
 * with a short breath pause between sentences. Providers that return alignment data
 * (e.g. ElevenLabs /with-timestamps) should replace this estimate.
 */
export function estimateSegments(sentences: string[], totalSeconds: number, pause = 0.25): ScriptSegment[] {
  if (!sentences.length) return [];
  const usable = Math.max(0.1, totalSeconds - pause * (sentences.length - 1));
  const weights = sentences.map((s) => Math.max(8, s.length));
  const sum = weights.reduce((a, b) => a + b, 0);
  let t = 0;
  return sentences.map((text, i) => {
    const dur = (weights[i]! / sum) * usable;
    const seg = { text, start: round(t), end: round(t + dur) };
    t += dur + pause;
    return seg;
  });
}
const round = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Exact sentence windows from per-character alignment. `text` must be the exact string sent to TTS
 * (sentences joined by single spaces). Returns null when the alignment doesn't match the text
 * (vendor normalised it) so the caller can fall back to estimateSegments().
 */
export function segmentsFromAlignment(sentences: string[], text: string, al: CharAlignment, totalSeconds: number): ScriptSegment[] | null {
  const n = al.characters.length;
  if (!n || al.starts.length !== n || al.ends.length !== n || al.characters.join("") !== text) return null;
  const out: ScriptSegment[] = [];
  let cursor = 0;
  for (const sentence of sentences) {
    const fromUnit = text.indexOf(sentence, cursor);
    if (fromUnit < 0) return null;
    cursor = fromUnit + sentence.length;
    // alignment arrays are per code point, JS string offsets are UTF-16 units (differ for emoji etc.)
    const from = Array.from(text.slice(0, fromUnit)).length;
    const to = from + Array.from(sentence).length - 1;
    const start = al.starts[from]!, end = Math.min(al.ends[to]!, totalSeconds);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
    out.push({ text: sentence, start: round(start), end: round(end) });
  }
  return out;
}
