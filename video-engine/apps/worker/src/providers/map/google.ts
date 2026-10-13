import { config } from "../../config.js";
import { PaidApiNotImplemented, paidGate } from "../../lib/paid.js";
import { MOCK_BACKEND_JS } from "./mock.js";
import type { MapProvider, MapScene } from "./types.js";

/** Google Maps JavaScript API (vector map w/ tilt + heading). Billed per map load. */
export class GoogleMapsProvider implements MapProvider {
  readonly id = "google";
  private live = () => paidGate("google-maps", config.GOOGLE_MAPS_API_KEY) === "live";
  headHtml() {
    // TODO(paid-api): Google Maps — once the key is ready, return:
    //   <script src="https://maps.googleapis.com/maps/api/js?key=<GOOGLE_MAPS_API_KEY>&v=weekly&map_ids=<VECTOR_MAP_ID>"></script>
    return "";
  }
  backendJs(_scene: MapScene) {
    if (!this.live()) return MOCK_BACKEND_JS;
    // TODO(paid-api): Google Maps — backend sketch:
    //   const map = new google.maps.Map(base, { mapId, mapTypeId: "hybrid", disableDefaultUI: true, gestureHandling: "none", renderingType: "VECTOR" });
    //   supportsPitch: true (tilt = c.pitch, heading = c.bearing)
    //   setCamera: map.moveCamera({ center: { lat, lng }, zoom, tilt: pitch, heading: bearing })
    //   project:   an OverlayView's getProjection().fromLatLngToContainerPixel(new google.maps.LatLng(lat, lng))
    //   waitIdle:  await new Promise(r => google.maps.event.addListenerOnce(map, "idle", r))  (+ short settle delay for tiles)
    throw new PaidApiNotImplemented("Google Maps");
  }
  assertReady() { if (this.live()) throw new PaidApiNotImplemented("Google Maps"); }
}
