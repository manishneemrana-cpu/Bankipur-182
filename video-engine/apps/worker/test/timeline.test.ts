import test from "node:test";
import assert from "node:assert/strict";
import { computeTimeline, musicVolume, fitClip } from "../../../packages/video-template/src/timeline.ts";

test("timeline: intro 1.5s → content → 4s outro; map ≈60% of content", () => {
  const t = computeTimeline({ voiceoverDuration: 20 });
  assert.equal(t.introFrames, 45);
  assert.equal(t.outroFrames, 120);
  assert.equal(t.contentFrames, Math.round(20.8 * 30));
  assert.equal(t.mapFrames + t.cinematicFrames, t.contentFrames);
  assert.equal(t.totalFrames, t.introFrames + t.contentFrames + t.outroFrames);
  assert.equal(t.voiceStartFrame, 45);
});

test("music ducks under the voiceover and recovers after it", () => {
  const t = computeTimeline({ voiceoverDuration: 20 });
  const mid = musicVolume(t.voiceStartFrame + 150, t);
  const outro = musicVolume(t.voiceEndFrame + 120, t);
  assert.ok(mid < 0.1, `ducked ${mid}`);
  assert.ok(outro > mid * 2, `recovered ${outro}`);
  assert.equal(musicVolume(t.totalFrames, t), 0);
});

test("fitClip clamps playback rate and reports freeze point", () => {
  const long = fitClip(30, 300); // 30s clip into 10s slot -> clamped 1.6x
  assert.equal(long.rate, 1.6);
  assert.equal(long.playFrames, 300);
  const short = fitClip(4, 300); // 4s clip into 10s slot -> 0.5x, plays 8s, freezes for the rest
  assert.equal(short.rate, 0.5);
  assert.ok(short.playFrames < 300);
});
