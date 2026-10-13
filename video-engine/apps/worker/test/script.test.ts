import test from "node:test";
import assert from "node:assert/strict";
import { LANGUAGES, PROJECT_TYPES, type ProjectInput } from "@ave/shared-types";
import { generateScript, splitSentences, templateFor } from "../src/script/index.ts";
import { TEMPLATES } from "../src/script/templates.ts";
import { estimateSegments } from "../src/stages/timing.ts";

const base = (o: Partial<ProjectInput> = {}) => ({
  name: "Skyline Heights", builderName: "Bankipur Group", tagline: "Rise above", projectType: "tower" as const,
  addressText: "Sector 150, Noida", language: "en" as const, images: [], customScript: null, ...o,
});

test("every project type resolves to a template; there are 4 distinct templates", () => {
  assert.equal(TEMPLATES.length, 4);
  for (const t of PROJECT_TYPES) assert.ok(templateFor(t));
  assert.equal(new Set(PROJECT_TYPES.map((t) => templateFor(t).id)).size, 4);
});

test("all type × language combinations fill every placeholder", () => {
  for (const projectType of PROJECT_TYPES) for (const language of LANGUAGES) {
    const s = generateScript(base({ projectType, language }));
    assert.ok(s.sentences.length >= 6, `${projectType}/${language}`);
    assert.ok(!/[{}]/.test(s.text), `unfilled placeholder in ${projectType}/${language}: ${s.text}`);
    assert.ok(s.text.includes("Skyline Heights") && s.text.includes("Bankipur Group"));
  }
});

test("deterministic per project, varies across projects", () => {
  assert.equal(generateScript(base()).text, generateScript(base()).text);
  const texts = new Set(Array.from({ length: 12 }, (_, i) => generateScript(base({ name: `Project ${i}` })).text.replace(/Project \d+/g, "X")));
  assert.ok(texts.size > 1, "expected phrasing variation across projects");
});

test("tagline and amenity slots are conditional", () => {
  assert.ok(generateScript(base({ tagline: "" })).sentences.length < generateScript(base()).sentences.length);
  const amen = generateScript(base({ images: [{ role: "amenity", url: "x" }] }));
  assert.ok(amen.sentences.length > generateScript(base()).sentences.length);
});

test("custom script wins and is split into sentences (incl. Devanagari danda)", () => {
  const s = generateScript(base({ customScript: "Pehla vaakya. Doosra vaakya! तीसरा वाक्य। चौथा?" }));
  assert.equal(s.templateId, "custom");
  assert.deepEqual(s.sentences, ["Pehla vaakya.", "Doosra vaakya!", "तीसरा वाक्य।", "चौथा?"]);
  assert.deepEqual(splitSentences("a. b"), ["a.", "b"]);
});

test("estimateSegments covers the audio without overlap or overrun", () => {
  const segs = estimateSegments(["One two three.", "Four five six seven eight nine.", "Ten."], 20);
  assert.equal(segs.length, 3);
  for (let i = 0; i < segs.length; i++) {
    assert.ok(segs[i]!.end > segs[i]!.start);
    if (i) assert.ok(segs[i]!.start >= segs[i - 1]!.end);
  }
  assert.ok(Math.abs(segs.at(-1)!.end - 20) < 0.05);
});
