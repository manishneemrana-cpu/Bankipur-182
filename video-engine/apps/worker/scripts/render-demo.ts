/**
 * Build-order step 4: render the composition with PLACEHOLDER clips + mock voiceover/music, no Redis/API needed.
 *   npm run demo -w @ave/worker      -> .local-data/demo/{reel-9x16,reel-16x9}.mp4 + thumb.jpg
 */
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../src/config.js";
import { MockVoiceoverProvider } from "../src/providers/voiceover/mock.js";
import { generateScript } from "../src/script/index.js";
import { estimateSegments } from "../src/stages/timing.js";
import { renderPlaceholder, renderReel, renderThumbnail } from "../src/render/remotion.js";
import { mediaDurationFromBytes } from "../src/lib/duration.js";
import { VideoPropsSchema } from "@ave/shared-types";
import { computeTimeline } from "@ave/video-template";

const out = path.join(config.LOCAL_DATA_DIR, "demo");
await fs.mkdir(out, { recursive: true });
// Remotion fetches these over HTTP, so serve the demo dir.
const http = await import("node:http");
const server = http.createServer(async (req, res) => {
  try { const b = await fs.readFile(path.join(out, decodeURIComponent(req.url!.split("?")[0]!))); res.setHeader("access-control-allow-origin", "*"); res.end(b); } catch { res.statusCode = 404; res.end(); }
}).listen(0);
const base = `http://localhost:${(server.address() as { port: number }).port}`;

const script = generateScript({ name: "Skyline Heights", builderName: "Bankipur Group", tagline: "Rise above the ordinary", projectType: "tower", addressText: "Sector 150, Noida", language: "en", images: [], customScript: null });
const audio = await new MockVoiceoverProvider(async (b, ext) => { await fs.writeFile(path.join(out, `vo.${ext}`), b); return `${base}/vo.${ext}`; }).generate(script.text, "en", "");
const dur = await mediaDurationFromBytes(await fs.readFile(path.join(out, "vo.wav")), "wav");
const mapDur = await renderPlaceholder("map", path.join(out, "map.mp4"));
const bldDur = await renderPlaceholder("building", path.join(out, "building.mp4"));

const props = VideoPropsSchema.parse({
  projectName: "Skyline Heights", tagline: "Rise above the ordinary", builderName: "Bankipur Group",
  mapClipUrl: `${base}/map.mp4`, mapClipDuration: mapDur, cinematicClipUrl: `${base}/building.mp4`, cinematicClipDuration: bldDur,
  voiceoverUrl: audio, voiceoverDuration: dur, logoUrl: null, brandColor: "#0B1F3A", accentColor: "#C9A24B",
  contactNumber: "+91 98765 43210", segments: estimateSegments(script.sentences, dur), musicTrack: "regal", language: "en",
});
console.log("timeline", computeTimeline(props));
for (const aspect of ["9:16", "16:9"] as const) {
  const t = Date.now();
  await renderReel({ props, aspect, outPath: path.join(out, `reel-${aspect.replace(":", "x")}.mp4`), onProgress: (p) => process.stdout.write(`\r${aspect} ${p.toFixed(0)}%`) });
  console.log(`\n${aspect} done in ${((Date.now() - t) / 1000).toFixed(1)}s`);
}
await renderThumbnail(props, path.join(out, "thumb.jpg"), 90);
server.close();
console.log("output:", out);
