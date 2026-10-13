import { config } from "../../config.js";
import { PaidApiNotImplemented, paidGate } from "../../lib/paid.js";
import { MOCK_BACKEND_JS } from "./mock.js";
import type { MapProvider, MapScene } from "./types.js";

/** Mapbox GL JS basemap (satellite-streets, 3D pitch). Billed per map load / tile request. */
export class MapboxMapProvider implements MapProvider {
  readonly id = "mapbox";
  private live = () => paidGate("mapbox", config.MAPBOX_ACCESS_TOKEN) === "live";
  headHtml() {
    // TODO(paid-api): Mapbox — once the owner confirms the token is ready, return:
    //   <link href="https://api.mapbox.com/mapbox-gl-js/v3.9.0/mapbox-gl.css" rel="stylesheet">
    //   <script src="https://api.mapbox.com/mapbox-gl-js/v3.9.0/mapbox-gl.js"></script>
    return "";
  }
  backendJs(_scene: MapScene) {
    if (!this.live()) return MOCK_BACKEND_JS;
    // TODO(paid-api): Mapbox — return a backend script implementing window.__backend (see MapProvider docs):
    //   mapboxgl.accessToken = "<MAPBOX_ACCESS_TOKEN>";   // inject from config, never hardcode
    //   const map = new mapboxgl.Map({ container: "base", style: "mapbox://styles/mapbox/satellite-streets-v12",
    //     center: [lng, lat], zoom: 5, interactive: false, fadeDuration: 0, antialias: true, preserveDrawingBuffer: true });
    //   supportsPitch: true
    //   init:      await new Promise(r => map.once("load", r))
    //   setCamera: map.jumpTo({ center: [c.lng, c.lat], zoom: c.zoom, pitch: c.pitch, bearing: c.bearing })
    //   project:   const p = map.project([lng, lat]); return [p.x, p.y]
    //   waitIdle:  map.triggerRepaint(); await new Promise(r => map.once("idle", r))
    //   Note: Mapbox ToS requires the Mapbox logo/attribution to stay visible in captured output.
    throw new PaidApiNotImplemented("Mapbox GL");
  }
  assertReady() { if (this.live()) throw new PaidApiNotImplemented("Mapbox GL"); }
}
