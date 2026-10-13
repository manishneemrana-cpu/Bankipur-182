import { config } from "../../config.js";
import { PaidApiNotImplemented, paidGate } from "../../lib/paid.js";
import { MOCK_BACKEND_JS } from "./mock.js";
import type { MapProvider, MapScene } from "./types.js";

/** Cesium ion (Bing/Sentinel imagery + World Terrain, true 3D globe). Billed by ion plan usage. */
export class CesiumMapProvider implements MapProvider {
  readonly id = "cesium";
  private live = () => paidGate("cesium", config.CESIUM_ION_TOKEN) === "live";
  headHtml() {
    // TODO(paid-api): Cesium ion — once the token is ready, return the CesiumJS script + widgets.css from
    //   https://cesium.com/downloads/cesiumjs/releases/<version>/Build/Cesium/
    return "";
  }
  backendJs(_scene: MapScene) {
    if (!this.live()) return MOCK_BACKEND_JS;
    // TODO(paid-api): Cesium ion — backend sketch:
    //   Cesium.Ion.defaultAccessToken = "<CESIUM_ION_TOKEN>";
    //   const viewer = new Cesium.Viewer("base", { terrain: Cesium.Terrain.fromWorldTerrain(), baseLayerPicker: false,
    //     animation: false, timeline: false, requestRenderMode: false });
    //   supportsPitch: true
    //   setCamera: viewer.camera.setView({ destination: Cesium.Cartesian3.fromDegrees(lng, lat, heightFromZoom(c.zoom)),
    //     orientation: { heading: Cesium.Math.toRadians(c.bearing), pitch: Cesium.Math.toRadians(-90 + c.pitch) } })
    //   project:   Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, Cesium.Cartesian3.fromDegrees(lng, lat))
    //   waitIdle:  poll viewer.scene.globe.tilesLoaded === true after viewer.render()
    throw new PaidApiNotImplemented("Cesium ion");
  }
  assertReady() { if (this.live()) throw new PaidApiNotImplemented("Cesium ion"); }
}
