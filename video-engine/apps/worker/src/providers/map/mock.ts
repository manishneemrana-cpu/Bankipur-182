import type { MapProvider, MapScene } from "./types.js";

/**
 * Offline procedural basemap (value-noise land/water + hierarchical street grid). Needs no network,
 * no key and costs nothing, so the whole pipeline (capture → encode → compose) is testable end to end.
 * Visibly watermarked so it can never be mistaken for a real map in a delivered video.
 */
export const MOCK_BACKEND_JS = /* js */ `
window.__backend = (() => {
  const G = 176, WS = (z) => 512 * Math.pow(2, z);
  const base = document.getElementById("base");
  const cv = document.createElement("canvas"); cv.width = cv.height = SCENE.size; cv.style.cssText = "width:100%;height:100%";
  base.appendChild(cv);
  const g = cv.getContext("2d");
  const lo = document.createElement("canvas"); lo.width = lo.height = G; const lg = lo.getContext("2d");
  const img = lg.createImageData(G, G);
  let cam = { lng: 0, lat: 0, zoom: 5 };
  const mxf = (lng) => (lng + 180) / 360;
  const myf = (lat) => (1 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) / 2;
  const hs = (a, b, s) => { let n = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(s | 0, 1442695041); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967295; };
  const sm = (t) => t * t * (3 - 2 * t);
  const vn = (x, y, s) => { const xi = Math.floor(x), yi = Math.floor(y), fx = sm(x - xi), fy = sm(y - yi);
    const a = hs(xi, yi, s), b = hs(xi + 1, yi, s), c = hs(xi, yi + 1, s), d = hs(xi + 1, yi + 1, s);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; };
  // octaves fade out once their on-screen frequency would alias (cycles per pixel too high)
  const fbm = (x, y, ws) => { let v = 0, a = 0.5, f = 1, n = 0; for (let o = 0; o < 10; o++) { const w = 1 - sstep(0.015, 0.05, (60 * f) / ws); if (w > 0) { v += a * w * vn(x * f, y * f, o + 7); n += a * w; } a *= 0.5; f *= 2; } return n ? v / n : 0.5; };
  const sstep = (a, b, x) => Math.max(0, Math.min(1, (x - a) / (b - a)));

  function draw() {
    const N = SCENE.size, ws = WS(cam.zoom), cx = mxf(cam.lng), cy = myf(cam.lat), half = N / ws / 2;
    // terrain
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
      const wx = cx - half + (i / (G - 1)) * 2 * half, wy = cy - half + (j / (G - 1)) * 2 * half;
      const v = fbm(wx * 60, wy * 60, ws), land = sstep(0.46, 0.5, v), k = (j * G + i) * 4;
      const t = 0.5 + 0.5 * vn(wx * 2e5, wy * 2e5, 99) * (1 - sstep(0.015, 0.05, 2e5 / ws));
      img.data[k] = lerp(10, 20 + t * 8, land); img.data[k + 1] = lerp(36, 34 + t * 8, land); img.data[k + 2] = lerp(52, 44 + t * 8, land); img.data[k + 3] = 255;
    }
    lg.putImageData(img, 0, 0); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high"; g.drawImage(lo, 0, 0, N, N);
    // streets: hierarchical jittered grid, fading in/out by on-screen spacing
    for (let L = 2; L <= 24; L++) {
      const s = Math.pow(2, -L), px = s * ws;
      const a = sstep(26, 90, px) * (1 - sstep(520, 1000, px)); if (a <= 0.01) continue;
      const major = L <= 11, w = Math.max(1, Math.min(8, px * (major ? 0.03 : 0.022)));
      g.lineWidth = w; g.strokeStyle = major ? "rgba(201,162,75," + (0.22 * a) + ")" : "rgba(255,255,255," + (0.16 * a) + ")";
      g.beginPath();
      const i0 = Math.floor((cx - half) / s) - 1, i1 = Math.ceil((cx + half) / s) + 1;
      for (let i = i0; i <= i1; i++) { if (hs(i, L, 1) > (major ? 0.5 : 0.62)) continue; const x = ((i + (hs(i, L, 2) - 0.5) * 0.35) * s - cx) * ws + N / 2; g.moveTo(x, 0); g.lineTo(x + (hs(i, L, 3) - 0.5) * px * 0.4, N); }
      const j0 = Math.floor((cy - half) / s) - 1, j1 = Math.ceil((cy + half) / s) + 1;
      for (let j = j0; j <= j1; j++) { if (hs(j, L, 4) > (major ? 0.5 : 0.62)) continue; const y = ((j + (hs(j, L, 5) - 0.5) * 0.35) * s - cy) * ws + N / 2; g.moveTo(0, y); g.lineTo(N, y + (hs(j, L, 6) - 0.5) * px * 0.4); }
      g.stroke();
    }
    g.fillStyle = "rgba(255,255,255,.35)"; g.font = "600 " + Math.round(N * 0.014) + "px sans-serif"; g.fillText("MOCK BASEMAP", N * 0.02, N * 0.985);
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  return {
    supportsPitch: false,
    async init() {},
    setCamera(c) { cam = c; draw(); },
    project(lng, lat) { const ws = WS(cam.zoom); return [(mxf(lng) - mxf(cam.lng)) * ws + SCENE.size / 2, (myf(lat) - myf(cam.lat)) * ws + SCENE.size / 2]; },
    async waitIdle() {},
  };
})();
`;

export class MockMapProvider implements MapProvider {
  readonly id = "mock";
  headHtml() { return ""; }
  backendJs(_scene: MapScene) { return MOCK_BACKEND_JS; }
  assertReady() {}
}
