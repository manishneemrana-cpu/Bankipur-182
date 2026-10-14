import assert from "node:assert/strict";
import { test } from "node:test";

process.env.PAID_APIS_ENABLED = "true";
process.env.GOOGLE_TTS_API_KEY = "test-key";
const { GoogleTtsProvider, splitText } = await import("../src/providers/voiceover/google.js");

test("splitText keeps chunks under the byte limit and loses nothing", () => {
  const text = Array.from({ length: 400 }, (_, i) => `Sentence number ${i} is here.`).join(" ");
  const chunks = splitText(text);
  assert.ok(chunks.length > 1);
  for (const c of chunks) assert.ok(Buffer.byteLength(c) <= 4500);
  assert.equal(chunks.join(" "), text);
});

test("live call posts to Google, picks a hi-IN voice for hinglish, ignores a non-Google voice id", async () => {
  let body: any, headers: any, url = "";
  const real = globalThis.fetch;
  globalThis.fetch = (async (u: any, init: any) => {
    url = String(u); body = JSON.parse(init.body); headers = init.headers;
    return new Response(JSON.stringify({ audioContent: Buffer.alloc(2000, 1).toString("base64") }), { status: 200 });
  }) as typeof fetch;
  try {
    let saved = 0;
    const p = new GoogleTtsProvider(async (b) => { saved = b.length; return "http://x/a.mp3"; });
    const out = await p.generate("Namaste. Welcome.", "hinglish", "czQ9pLzjRaF61EAYjcPC");
    assert.equal(out, "http://x/a.mp3");
    assert.equal(saved, 2000);
    assert.match(url, /texttospeech\.googleapis\.com\/v1\/text:synthesize$/);
    assert.equal(headers["x-goog-api-key"], "test-key");
    assert.equal(body.voice.name, "hi-IN-Neural2-A");
    assert.equal(body.voice.languageCode, "hi-IN");
  } finally { globalThis.fetch = real; }
});
