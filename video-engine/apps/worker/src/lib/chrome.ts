import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";

/**
 * chrome-headless-shell (old headless mode) — what Remotion requires. Falls back to undefined so
 * Remotion downloads its own via ensureBrowser() (production Docker image does this at build time).
 */
export function findHeadlessShell(): string | undefined {
  if (config.CHROME_EXECUTABLE) return config.CHROME_EXECUTABLE;
  const pw = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (pw && fs.existsSync(pw)) {
    for (const d of fs.readdirSync(pw)) {
      for (const rel of ["chrome-linux/headless_shell", "chrome-headless-shell-linux64/chrome-headless-shell"]) {
        const p = path.join(pw, d, rel);
        if (d.startsWith("chromium_headless_shell") && fs.existsSync(p)) return p;
      }
    }
  }
  return undefined;
}

/** Find a full Chromium binary for Puppeteer without downloading one. */
export function findChrome(): string | undefined {
  if (config.CHROME_EXECUTABLE) return config.CHROME_EXECUTABLE;
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  const pw = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (pw && fs.existsSync(pw)) {
    for (const d of fs.readdirSync(pw)) {
      for (const rel of ["chrome-linux/chrome", "chrome-linux64/chrome"]) {
        const p = path.join(pw, d, rel);
        if (d.startsWith("chromium-") && fs.existsSync(p)) return p;
      }
    }
  }
  for (const p of ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]) {
    if (fs.existsSync(p)) return p;
  }
  return undefined; // Remotion will download its own headless shell on first render
}
