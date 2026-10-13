// Generates 3 original, royalty-free ambient pad loops (no third-party audio is bundled).
// Every partial is an integer multiple of 1/LOOP_S Hz and LFOs are periodic over LOOP_S, so the
// loop point is seamless. Run: `npm run assets`.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SR = 22050, LOOP_S = 32;
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "../public/music");
fs.mkdirSync(out, { recursive: true });

const snap = (f) => Math.round(f * LOOP_S) / LOOP_S; // snap to a whole number of cycles per loop
const midi = (m) => 440 * 2 ** ((m - 69) / 12);

const TRACKS = {
  // slow, warm, major-9 pad
  serene: { chords: [[48, 55, 59, 62, 66], [45, 52, 59, 64, 67], [43, 50, 57, 62, 66], [47, 54, 59, 63, 66]], lfo: 2, bright: 0.25 },
  // deeper, minor-leaning, "luxury trailer" feel
  regal: { chords: [[45, 52, 57, 60, 64], [41, 48, 53, 57, 60], [48, 55, 60, 64, 67], [43, 50, 55, 59, 62]], lfo: 4, bright: 0.4 },
  // brighter, lifted sus chords with gentle pulse
  uplift: { chords: [[50, 57, 62, 66, 69], [47, 54, 59, 62, 66], [43, 50, 55, 59, 62], [45, 52, 57, 61, 64]], lfo: 8, bright: 0.6 },
};

for (const [name, t] of Object.entries(TRACKS)) {
  const n = SR * LOOP_S, s = new Float32Array(n), seg = LOOP_S / t.chords.length;
  for (let i = 0; i < n; i++) {
    const time = i / SR, ci = Math.floor(time / seg), local = time - ci * seg;
    const chord = t.chords[ci], next = t.chords[(ci + 1) % t.chords.length];
    // equal-power crossfade into the next chord over the last 25% of each segment
    const x = Math.max(0, (local - seg * 0.75) / (seg * 0.25));
    const gA = Math.cos(x * Math.PI / 2), gB = Math.sin(x * Math.PI / 2);
    const voice = (notes) => notes.reduce((acc, m, k) => {
      const f = snap(midi(m));
      const p = Math.sin(2 * Math.PI * f * time) + t.bright * 0.35 * Math.sin(2 * Math.PI * snap(f * 2) * time);
      return acc + p / (1 + k * 0.25);
    }, 0);
    const swell = 0.75 + 0.25 * Math.sin(2 * Math.PI * (t.lfo / LOOP_S) * time);
    s[i] = (voice(chord) * gA + voice(next) * gB) * swell * 0.12;
  }
  const pcm = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) pcm.writeInt16LE(Math.max(-1, Math.min(1, s[i])) * 32767 | 0, i * 2);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVEfmt ", 8); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28);
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(path.join(out, `${name}.wav`), Buffer.concat([h, pcm]));
  console.log("wrote", name + ".wav");
}
