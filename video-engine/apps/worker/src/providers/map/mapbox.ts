import { config } from "../../config.js";
import { paidGate } from "../../lib/paid.js";
import { MOCK_BACKEND_JS } from "./mock.js";
import type { MapProvider, MapScene } from "./types.js";

const GL_VERSION = "v3.9.0";

/**
 * Mapbox GL JS basemap (satellite-streets, 3D pitch). Billed per map load (one load per rendered video) + tile requests.
 * Needs a PUBLIC token (`pk.…`): GL JS cannot use secret tokens, and /api/options exposes this token to the browser for the
 * location picker, so a secret one must never be configured here.
 * Mapbox ToS: the Mapbox logo + attribution stay visible in the captured output (default controls are kept).
 */
export class MapboxMapProvider implements MapProvider {
  readonly id = "mapbox";
  private live = () => paidGate("mapbox", config.MAPBOX_ACCESS_TOKEN) === "live";

  headHtml() {
    if (!this.live()) return "";
    return `<link href="https://api.mapbox.com/mapbox-gl-js/${GL_VERSION}/mapbox-gl.css" rel="stylesheet">
<script src="https://api.mapbox.com/mapbox-gl-js/${GL_VERSION}/mapbox-gl.js"></script>`;
  }

  backendJs(_scene: MapScene) {
    if (!this.live()) return MOCK_BACKEND_JS;
    const token = JSON.stringify(config.MAPBOX_ACCESS_TOKEN).replace(/</g, "\\u003c");
    return /* js */ `
window.__backend = (() => {
  let map = null, firstError = null;
  const SETTLE_TIMEOUT_MS = 20000;
  return {
    supportsPitch: true,
    async init(scene) {
      if (typeof mapboxgl === "undefined") throw new Error("Mapbox GL JS did not load (no internet access to api.mapbox.com?)");
      mapboxgl.accessToken = ${token};
      map = new mapboxgl.Map({
        container: "base", style: "mapbox://styles/mapbox/satellite-streets-v12",
        center: [scene.lng, scene.lat], zoom: 5, interactive: false, fadeDuration: 0, antialias: true, preserveDrawingBuffer: true,
      });
      map.on("error", (e) => { if (!firstError) firstError = (e && e.error && e.error.message) || "unknown Mapbox error"; });
      await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error("Mapbox style did not load within 30s" + (firstError ? ": " + firstError : ""))), 30000);
        map.once("load", () => { clearTimeout(t); resolve(); });
        map.on("error", () => { if (!map.loaded()) { clearTimeout(t); reject(new Error("Mapbox failed to load: " + firstError + " (check MAPBOX_ACCESS_TOKEN is a valid PUBLIC pk. token with no URL restriction that blocks http://127.0.0.1)")); } });
      });
    },
    setCamera(c) { map.jumpTo({ center: [c.lng, c.lat], zoom: c.zoom, pitch: c.pitch, bearing: c.bearing }); },
    project(lng, lat) { const p = map.project([lng, lat]); return [p.x, p.y]; },
    async waitIdle() {
      // "idle" fires once the frame is rendered and all visible tiles are loaded; the timeout keeps one slow tile from hanging the whole video.
      await new Promise((resolve) => {
        const t = setTimeout(resolve, SETTLE_TIMEOUT_MS);
        map.once("idle", () => { clearTimeout(t); resolve(); });
        map.triggerRepaint();
      });
    },
  };
})();
`;
  }

  assertReady() {
    if (!this.live()) return;
    if (!config.MAPBOX_ACCESS_TOKEN.startsWith("pk.")) {
      throw new Error("MAPBOX_ACCESS_TOKEN must be a PUBLIC token starting with 'pk.' (secret 'sk.' tokens do not work with Mapbox GL JS and must never be exposed to the browser).");
    }
  }
}
