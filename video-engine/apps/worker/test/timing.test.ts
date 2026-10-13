import test from "node:test";
import assert from "node:assert/strict";
import { segmentsFromAlignment } from "../src/stages/timing.ts";

const mk = (text: string, per = 0.1) => ({ characters: [...text], starts: [...text].map((_, i) => i * per), ends: [...text].map((_, i) => (i + 1) * per) });

test("maps sentences to exact char times", () => {
  const sentences = ["Hello there.", "नमस्ते दोस्त।"];
  const text = sentences.join(" ");
  const segs = segmentsFromAlignment(sentences, text, mk(text), 99)!;
  assert.equal(segs[0]!.start, 0);
  assert.equal(segs[0]!.end, 1.2); // 12 chars * 0.1
  assert.equal(segs[1]!.start, 1.3); // after the joining space
  assert.equal(segs[1]!.end, Math.round([...text].length * 0.1 * 1000) / 1000);
});

test("clamps to audio length", () => {
  const text = "One.";
  assert.equal(segmentsFromAlignment([text], text, mk(text), 0.25)![0]!.end, 0.25);
});

test("returns null when alignment text differs (normalised) so caller falls back", () => {
  assert.equal(segmentsFromAlignment(["Rs. 5"], "Rs. 5", mk("Rupees 5"), 9), null);
  assert.equal(segmentsFromAlignment(["a"], "a", { characters: ["a"], starts: [], ends: [] }, 9), null);
});
