import type { ScriptSegment } from "@ave/shared-types";

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
