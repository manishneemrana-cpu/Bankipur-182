import type { MapProviderId } from "@ave/shared-types";
import { CesiumMapProvider } from "./cesium.js";
import { GoogleMapsProvider } from "./google.js";
import { MapboxMapProvider } from "./mapbox.js";
import { MockMapProvider } from "./mock.js";
import type { MapProvider } from "./types.js";

export type { MapProvider, MapScene } from "./types.js";

export function createMapProvider(id: MapProviderId): MapProvider {
  switch (id) {
    case "mapbox": return new MapboxMapProvider();
    case "google": return new GoogleMapsProvider();
    case "cesium": return new CesiumMapProvider();
    case "mock":
    default: return new MockMapProvider();
  }
}
