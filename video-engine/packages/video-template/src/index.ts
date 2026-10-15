import path from "node:path";
import { fileURLToPath } from "node:url";

export { computeTimeline, mapSecondsFor } from "./timeline";
export { COMPOSITION_IDS } from "./ids";

/** Absolute paths for @remotion/bundler (Node side only; the Remotion bundle itself uses entry.ts). */
const here = path.dirname(fileURLToPath(import.meta.url));
export const ENTRY_POINT = path.join(here, "entry.ts");
export const PUBLIC_DIR = path.join(here, "../public");
