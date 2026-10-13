import path from "node:path";
import { createMapProvider } from "../src/providers/map/index.js";
import { captureMapClip } from "../src/providers/map/capture.js";
import { config } from "../src/config.js";
const out = path.join(config.LOCAL_DATA_DIR, "demo", "map-test.mp4");
const t = Date.now();
await captureMapClip(createMapProvider("mock"), { lat: 22.2476, lng: 72.1847, label: "Skyline Heights", subLabel: "Dholera, Gujarat", accent: "#C9A24B", durationSec: Number(process.env.SEC ?? 6), fps: 30, size: Number(process.env.SIZE ?? 1080) }, out, (p) => process.stdout.write(`\r${p.toFixed(0)}%`));
console.log("\n", out, ((Date.now() - t) / 1000).toFixed(1) + "s");
