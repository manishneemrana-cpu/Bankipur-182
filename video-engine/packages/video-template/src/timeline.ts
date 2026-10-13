import { FPS, INTRO_SECONDS, OUTRO_SECONDS, type VideoProps } from "@ave/shared-types";

export interface Timeline {
  fps: number;
  introFrames: number;
  /** voiceover + overlays + (map | cinematic) all live inside this window */
  contentFrames: number;
  mapFrames: number;
  cinematicFrames: number;
  outroFrames: number;
  totalFrames: number;
  /** frame at which the voiceover starts (end of intro) */
  voiceStartFrame: number;
  voiceEndFrame: number;
}

const f = (s: number) => Math.round(s * FPS);

/**
 * intro (1.5s) -> content (voiceover length + tail) split into [map flyby | cinematic shot] -> outro.
 * The map takes ~60% of the content window; the building shot the rest.
 */
export function computeTimeline(p: Pick<VideoProps, "voiceoverDuration">): Timeline {
  const content = Math.max(6, p.voiceoverDuration + 0.8);
  const contentFrames = f(content);
  const mapFrames = Math.round(contentFrames * 0.6);
  const introFrames = f(INTRO_SECONDS);
  return {
    fps: FPS,
    introFrames,
    contentFrames,
    mapFrames,
    cinematicFrames: contentFrames - mapFrames,
    outroFrames: f(OUTRO_SECONDS),
    totalFrames: introFrames + contentFrames + f(OUTRO_SECONDS),
    voiceStartFrame: introFrames,
    voiceEndFrame: introFrames + f(p.voiceoverDuration),
  };
}

/** Music gain at a frame: low under the voiceover (with ramps), fuller in intro/outro, faded at the very end. */
export function musicVolume(frame: number, t: Timeline): number {
  const HIGH = 0.38, LOW = 0.085, RAMP = Math.round(0.5 * FPS);
  const intoVoice = clamp01((frame - (t.voiceStartFrame - RAMP)) / RAMP);
  const outOfVoice = clamp01((frame - t.voiceEndFrame) / RAMP);
  const duck = intoVoice * (1 - outOfVoice);
  const fadeIn = clamp01(frame / FPS);
  const fadeOut = clamp01((t.totalFrames - frame) / (1.5 * FPS));
  return (HIGH + (LOW - HIGH) * duck) * fadeIn * fadeOut;
}
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Playback rate + freeze point so a clip of arbitrary length fills a slot of `slotFrames`. */
export function fitClip(clipSeconds: number, slotFrames: number, minRate = 0.5, maxRate = 1.6) {
  if (!clipSeconds || clipSeconds <= 0) return { rate: 1, playFrames: slotFrames };
  const slotSeconds = slotFrames / FPS;
  const rate = Math.max(minRate, Math.min(maxRate, clipSeconds / slotSeconds));
  const playFrames = Math.min(slotFrames, Math.floor((clipSeconds / rate) * FPS));
  return { rate, playFrames };
}
