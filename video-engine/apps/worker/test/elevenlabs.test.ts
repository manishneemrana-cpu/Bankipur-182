import test from "node:test";
import assert from "node:assert/strict";

process.env.PAID_APIS_ENABLED = "true";
process.env.ELEVENLABS_API_KEY = "test-key-123";
process.env.ELEVENLABS_VOICE_ID = "voice-abc";
const { ElevenLabsProvider } = await import("../src/providers/voiceover/elevenlabs.ts");

const text0 = "नमस्ते दुनिया";
const realFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = realFetch; });

test("posts to the TTS endpoint with key, model and voice; stores returned mp3", async () => {
  let seen: { url: string; init: RequestInit } | undefined;
  globalThis.fetch = (async (url: string, init: RequestInit) => { seen = { url, init }; return new Response(JSON.stringify({ audio_base64: Buffer.alloc(5000).toString("base64"), alignment: { characters: [...text0], character_start_times_seconds: [...text0].map((_, i) => i * 0.1), character_end_times_seconds: [...text0].map((_, i) => i * 0.1 + 0.1) } }), { status: 200 }); }) as typeof fetch;
  let saved: { len: number; ext: string; mime: string } | undefined;
  const p = new ElevenLabsProvider(async (b, ext, mime) => { saved = { len: b.length, ext, mime }; return "http://x/a.mp3"; });
  assert.equal(await p.generate("नमस्ते दुनिया", "hi", ""), "http://x/a.mp3");
  assert.match(seen!.url, /^https:\/\/api\.elevenlabs\.io\/v1\/text-to-speech\/voice-abc\/with-timestamps\?/);
  assert.equal((seen!.init.headers as Record<string, string>)["xi-api-key"], "test-key-123");
  const body = JSON.parse(seen!.init.body as string);
  assert.equal(body.model_id, "eleven_multilingual_v2");
  assert.equal(body.text, "नमस्ते दुनिया");
  assert.deepEqual(saved, { len: 5000, ext: "mp3", mime: "audio/mpeg" });
});

test("a Settings voiceId overrides the env default", async () => {
  let url = "";
  globalThis.fetch = (async (u: string) => { url = u; return new Response(JSON.stringify({ audio_base64: Buffer.alloc(5000).toString("base64") })); }) as typeof fetch;
  await new ElevenLabsProvider(async () => "u").generate("hi", "en", "custom-voice");
  assert.match(url, /text-to-speech\/custom-voice\/with-timestamps\?/);
});

test("API errors surface status + detail and never leak the key", async () => {
  globalThis.fetch = (async () => new Response('{"detail":{"status":"invalid_api_key"}}', { status: 401 })) as typeof fetch;
  await assert.rejects(new ElevenLabsProvider(async () => "u").generate("hi", "en", ""), (e: Error) => /401/.test(e.message) && /ELEVENLABS_API_KEY/.test(e.message) && !e.message.includes("test-key-123"));
});

test("rejects over-long scripts before spending credits", async () => {
  let called = false;
  globalThis.fetch = (async () => { called = true; return new Response(JSON.stringify({ audio_base64: Buffer.alloc(5000).toString("base64") })); }) as typeof fetch;
  await assert.rejects(new ElevenLabsProvider(async () => "u").generate("a".repeat(5001), "en", ""), /limit is 5000/);
  assert.equal(called, false);
});

test("generateWithAlignment returns per-character timings", async () => {
  globalThis.fetch = (async () => new Response(JSON.stringify({ audio_base64: Buffer.alloc(5000).toString("base64"), alignment: { characters: ["a", "b"], character_start_times_seconds: [0, 0.5], character_end_times_seconds: [0.5, 1] } }))) as typeof fetch;
  const r = await new ElevenLabsProvider(async () => "u").generateWithAlignment("ab", "en", "");
  assert.deepEqual(r.alignment, { characters: ["a", "b"], starts: [0, 0.5], ends: [0.5, 1] });
});
