import type { MapProvider, MapScene } from "./types.js";

const esc = (s: string) => s.replace(/</g, "\\u003c");

/**
 * Self-contained capture page. Deterministic: `__ave.renderFrame(t)` sets the camera for time t
 * (the same easing a flyTo() would use), waits for the basemap to settle, then draws the overlay.
 * Puppeteer calls it once per frame — no dropped frames, regardless of machine speed.
 */
export function buildMapPage(provider: MapProvider, scene: MapScene): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<style>
@font-face{font-family:"Playfair Display";src:url(/fonts/PlayfairDisplay.ttf);font-weight:400 900}
@font-face{font-family:"Inter";src:url(/fonts/Inter.ttf);font-weight:100 900}
@font-face{font-family:"Noto Sans Devanagari";src:url(/fonts/NotoSansDevanagari.ttf);font-weight:100 900}
html,body{margin:0;background:#000;overflow:hidden}
#stage{position:relative;width:${scene.size}px;height:${scene.size}px;overflow:hidden}
#base,#overlay{position:absolute;inset:0;width:100%;height:100%}
#vig{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 50%,rgba(0,0,0,0) 55%,rgba(0,0,0,.5) 100%)}
#label{position:absolute;left:0;top:0;transform:translate(-50%,-100%);opacity:0;text-align:center;font-family:"Playfair Display","Noto Sans Devanagari",serif;color:#fff;white-space:nowrap;text-shadow:0 2px 14px rgba(0,0,0,.8)}
#label b{display:block;font-size:${Math.round(scene.size * 0.034)}px;font-weight:700}
#label span{display:block;margin-top:6px;font:500 ${Math.round(scene.size * 0.017)}px "Inter","Noto Sans Devanagari",sans-serif;letter-spacing:.16em;text-transform:uppercase;color:${scene.accent}}
</style>${provider.headHtml()}</head><body>
<div id="stage"><div id="base"></div><canvas id="overlay" width="${scene.size}" height="${scene.size}"></canvas><div id="vig"></div><div id="label"><b></b><span></span></div></div>
<script>
const SCENE = ${esc(JSON.stringify(scene))};
${provider.backendJs(scene)}
${OVERLAY_JS}
</script></body></html>`;
}

const OVERLAY_JS = /* js */ `
const S = SCENE, N = S.size;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const mx = (lng) => (lng + 180) / 360;
const my = (lat) => (1 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) / 2;
const ilng = (x) => x * 360 - 180;
const ilat = (y) => (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;

// Route: a decorative arc approaching the project from ~2 km away (it is NOT a real driving route; swap in a Directions API polyline if wanted).
const hash = (S.lat * 131 + S.lng * 71) % 1;
const ang = (Math.abs(hash) * 360 + 200) * Math.PI / 180;
const ORIGIN = { lng: S.lng + Math.cos(ang) * 0.02, lat: S.lat + Math.sin(ang) * 0.014 };
const mid = { lng: (ORIGIN.lng + S.lng) / 2 - Math.sin(ang) * 0.004, lat: (ORIGIN.lat + S.lat) / 2 + Math.cos(ang) * 0.004 };
const bez = (t) => { const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
  return { lng: a * ORIGIN.lng + b * mid.lng + c * S.lng, lat: a * ORIGIN.lat + b * mid.lat + c * S.lat }; };
const routePts = [];
for (let i = 0; i <= 120; i++) routePts.push(bez(i / 120));

const FLY_END = 0.8; // fraction of duration spent flying; the rest is a slow orbit hold
function camera(t) {
  const u = clamp(t / (S.durationSec * FLY_END));
  const p = easeIO(u);
  // start at neighbourhood level (z13: tiles are sharp and the route is visible), end close on the plot (z17.2)
  const z = lerp(13, 17.2, easeOut(u) * 0.55 + p * 0.45);
  const hold = clamp((t - S.durationSec * FLY_END) / (S.durationSec * (1 - FLY_END)));
  // the camera rides along the route itself (from its midpoint to the project), so the line is always on screen
  const c = bez(lerp(0.5, 1, p));
  return {
    lng: c.lng, lat: c.lat, zoom: z,
    pitch: window.__backend.supportsPitch ? lerp(0, 58, easeIO(clamp((u - 0.35) / 0.65))) : 0,
    bearing: window.__backend.supportsPitch ? lerp(-25, 15, p) + hold * 18 : 0,
    routeProgress: easeIO(clamp(u / 0.4)),
    pinProgress: clamp((u - 0.55) / 0.15),
    labelProgress: clamp((u - 0.72) / 0.15),
  };
}

const ctx = document.getElementById("overlay").getContext("2d");
const label = document.getElementById("label");
label.querySelector("b").textContent = S.label;
label.querySelector("span").textContent = S.subLabel;

function drawOverlay(t, cam) {
  ctx.clearRect(0, 0, N, N);
  const B = window.__backend, px = (pt) => B.project(pt.lng, pt.lat);
  const lw = N * 0.0042;
  // route (drawn progressively)
  const n = Math.max(2, Math.round(routePts.length * cam.routeProgress));
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (const [w, a, col] of [[lw * 3.2, 0.25, S.accent], [lw, 1, "#ffffff"]]) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) { const [x, y] = px(routePts[i]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.strokeStyle = col; ctx.globalAlpha = a; ctx.lineWidth = w; ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // travelling highlight along the route
  if (cam.routeProgress > 0) {
    const [hx, hy] = px(routePts[Math.min(n - 1, routePts.length - 1)]);
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(hx, hy, lw * 2.2, 0, 7); ctx.fill();
  }
  const [ox, oy] = px(ORIGIN);
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(ox, oy, lw * 2, 0, 7); ctx.fill();
  // pin
  if (cam.pinProgress > 0) {
    const [x, y] = px({ lng: S.lng, lat: S.lat });
    const drop = (1 - easeOut(cam.pinProgress)) * -N * 0.08, r = N * 0.011;
    for (let k = 0; k < 3; k++) { // pulsing rings (time-driven so capture is deterministic)
      const ph = ((t * 0.8 + k / 3) % 1);
      ctx.beginPath(); ctx.arc(x, y, r * (1.2 + ph * 5), 0, 7);
      ctx.strokeStyle = S.accent; ctx.globalAlpha = (1 - ph) * 0.8 * cam.pinProgress; ctx.lineWidth = lw * 1.6; ctx.stroke();
    }
    ctx.globalAlpha = cam.pinProgress;
    const py = y + drop;
    ctx.beginPath(); ctx.arc(x, py - r * 2.6, r * 1.9, Math.PI * 0.84, Math.PI * 2.16); ctx.lineTo(x, py); ctx.closePath();
    ctx.fillStyle = S.accent; ctx.shadowColor = "rgba(0,0,0,.5)"; ctx.shadowBlur = r * 1.5; ctx.fill(); ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(x, py - r * 2.6, r * 0.8, 0, 7); ctx.fillStyle = "#fff"; ctx.fill();
    ctx.globalAlpha = 1;
    const lp = easeOut(cam.labelProgress);
    label.style.opacity = String(lp);
    label.style.left = x + "px"; label.style.top = (py - r * 5.6 - (1 - lp) * 20) + "px";
  } else label.style.opacity = "0";
}

window.__ave = {
  ready: window.__backend.init(S),
  async renderFrame(t) {
    const cam = camera(t);
    window.__backend.setCamera(cam);
    await window.__backend.waitIdle();
    drawOverlay(t, cam);
  },
};
`;
