import assert from "node:assert/strict";
import { test } from "node:test";

// config.ts reads process.env at import time, so set it before importing the provider.
process.env.PAID_APIS_ENABLED = "true";
process.env.MAPBOX_ACCESS_TOKEN = "pk.test-token";
const { MapboxMapProvider } = await import("../src/providers/map/mapbox.js");
const { MOCK_BACKEND_JS } = await import("../src/providers/map/mock.js");

const scene = { lat: 25.1, lng: 85, label: "T", subLabel: "S", accent: "#C9A24B", durationSec: 1, fps: 2, size: 256 };

test("live mode loads Mapbox GL and builds a syntactically valid backend with the token inlined", () => {
  const p = new MapboxMapProvider();
  assert.match(p.headHtml(), /mapbox-gl\.js/);
  const js = p.backendJs(scene);
  assert.notEqual(js, MOCK_BACKEND_JS);
  assert.ok(js.includes('"pk.test-token"'));
  for (const fn of ["init", "setCamera", "project", "waitIdle"]) assert.ok(js.includes(fn), `backend defines ${fn}`);
  assert.doesNotThrow(() => new Function(js));
  assert.doesNotThrow(() => p.assertReady());
});
