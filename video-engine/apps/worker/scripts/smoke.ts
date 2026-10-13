/**
 * End-to-end smoke test against a running API + worker (+ Redis):  npm run smoke
 * Uploads sample images, submits a project, polls until the pipeline finishes, prints the outputs.
 */
const API = process.env.API_URL ?? "http://localhost:4100/api";
import fs from "node:fs/promises";
const headers: Record<string, string> = process.env.TOKEN ? { authorization: `Bearer ${process.env.TOKEN}` } : {};

async function upload(file: string, kind: "logo" | "image") {
  const bytes = await fs.readFile(file);
  const fd = new FormData();
  fd.set("kind", kind);
  fd.set("file", new Blob([new Uint8Array(bytes)], { type: file.endsWith(".png") ? "image/png" : "image/jpeg" }), file.split("/").pop());
  const r = await fetch(`${API}/uploads`, { method: "POST", body: fd, headers });
  if (!r.ok) throw new Error(`upload ${r.status}: ${await r.text()}`);
  return ((await r.json()) as { url: string }).url;
}

const sample = process.argv[2] ?? "../../.local-data/demo/thumb.jpg";
const elevation = process.env.NO_ELEVATION ? [] : [{ role: "elevation" as const, url: await upload(sample, "image") }];
const layout = { role: "site_layout" as const, url: await upload(sample, "image") };
const res = await fetch(`${API}/projects`, {
  method: "POST", headers: { ...headers, "content-type": "application/json" },
  body: JSON.stringify({
    name: "Skyline Heights", builderName: "Bankipur Group", tagline: "Rise above the ordinary", projectType: "tower",
    addressText: "Sector 150, Noida", lat: 28.4306, lng: 77.5045, language: (process.env.LANG_ID as string) ?? "en", images: [...elevation, layout],
  }),
});
if (!res.ok) throw new Error(`create ${res.status}: ${await res.text()}`);
const { id } = (await res.json()) as { id: string };
console.log("project", id);
const t0 = Date.now();
for (;;) {
  await new Promise((r) => setTimeout(r, 3000));
  const p = (await (await fetch(`${API}/projects/${id}`, { headers })).json()) as any;
  console.log(`${((Date.now() - t0) / 1000).toFixed(0)}s`, p.status, p.jobs.map((j: any) => `${j.stage}:${j.status}:${j.progress}%`).join("  "));
  if (p.status === "done" || p.status === "failed") { console.log(JSON.stringify({ error: p.error, assets: p.assets }, null, 2)); process.exit(p.status === "done" ? 0 : 1); }
}
