import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { PUBLIC_DIR } from "@ave/video-template";
import { startFrameEncoder } from "../../lib/ffmpeg.js";
import { findChrome } from "../../lib/chrome.js";
import { log } from "../../lib/logger.js";
import { buildMapPage } from "./page.js";
import type { MapProvider, MapScene } from "./types.js";

/** Tiny local server so the capture page can load the bundled fonts over HTTP. */
async function serve(html: string) {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://x");
      if (url.pathname === "/" || url.pathname === "/index.html") { res.setHeader("content-type", "text/html; charset=utf-8"); return void res.end(html); }
      if (url.pathname.startsWith("/fonts/")) {
        const file = path.join(PUBLIC_DIR, "fonts", path.basename(url.pathname));
        res.setHeader("content-type", "font/ttf");
        return void res.end(await fs.readFile(file));
      }
      res.statusCode = 404; res.end();
    } catch { res.statusCode = 404; res.end(); }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return { url: `http://127.0.0.1:${(server.address() as { port: number }).port}/`, close: () => new Promise<void>((r) => server.close(() => r())) };
}

/**
 * Render the map flyby deterministically: step the page's clock frame by frame, screenshot each
 * frame, pipe JPEGs into ffmpeg → MP4 (square, no audio).
 */
export async function captureMapClip(provider: MapProvider, scene: MapScene, outPath: string, onProgress?: (pct: number) => void) {
  provider.assertReady();
  const srv = await serve(buildMapPage(provider, scene));
  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--hide-scrollbars"],
  });
  const enc = startFrameEncoder({ fps: scene.fps, outPath });
  try {
    const page = await browser.newPage();
    page.on("pageerror", (e) => log.warn({ e: String(e) }, "map page error"));
    page.on("console", (m) => { if (m.type() === "error") log.warn({ text: m.text() }, "map page console error"); });
    await page.setViewport({ width: scene.size, height: scene.size, deviceScaleFactor: 1 });
    await page.goto(srv.url, { waitUntil: "load" });
    await page.evaluate(() => (window as any).__ave.ready);
    await page.evaluate(async (txt: string) => {
      await Promise.all(['700 20px "Playfair Display"', '500 20px Inter', '500 20px "Noto Sans Devanagari"'].map((f) => (document as any).fonts.load(f, txt)));
    }, `${scene.label} ${scene.subLabel}`);

    const frames = Math.round(scene.durationSec * scene.fps);
    for (let i = 0; i < frames; i++) {
      await page.evaluate((t: number) => (window as any).__ave.renderFrame(t), i / scene.fps);
      const shot = await page.screenshot({ type: "jpeg", quality: 92, optimizeForSpeed: true });
      await enc.write(shot);
      if (i % 10 === 0) onProgress?.((i / frames) * 100);
    }
    await enc.finish();
  } catch (e) {
    enc.abort();
    throw e;
  } finally {
    await browser.close().catch(() => undefined);
    await srv.close();
  }
}
