import path from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import multer from "multer";
import { z } from "zod";
import {
  AccountSettingsSchema, PROVIDER_OPTIONS, ProjectInputSchema, type AccountSettings, type ProjectRow, type ProjectWithJobs,
} from "@ave/shared-types";
import { config, useSupabase } from "./config.js";
import { log } from "./lib/logger.js";
import { authenticate } from "./lib/auth.js";
import { repo } from "./lib/repo.js";
import { storage } from "./lib/storage.js";
import { enqueuePipeline } from "./pipeline/queues.js";
import { generateScript } from "./script/index.js";

export const app = express();
app.use(cors({ origin: config.WEB_ORIGIN.split(",") }));
app.use(express.json({ limit: "1mb" }));

// Local-storage mode only: serve stored files (supports HTTP Range for video seeking).
if (!useSupabase) {
  app.use("/files", express.static(path.join(config.LOCAL_DATA_DIR, "files"), { fallthrough: false, setHeaders: (res) => res.setHeader("Cross-Origin-Resource-Policy", "cross-origin") }));
}

app.get("/favicon.ico", (_req, res) => res.status(204).end());
app.get("/health", (_req, res) => res.json({ ok: true, storage: useSupabase ? "supabase" : "local", paidApisEnabled: config.PAID_APIS_ENABLED }));

const api = express.Router();
api.use(authenticate);

const asyncH = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

/* ---- options (what the Settings dropdowns offer) ---- */
api.get("/options", (_req, res) => {
  res.json({
    providers: PROVIDER_OPTIONS,
    defaults: { tts: config.TTS_PROVIDER, map: config.MAP_PROVIDER, video: config.VIDEO_PROVIDER },
    paidApisEnabled: config.PAID_APIS_ENABLED,
    keysConfigured: {
      elevenlabs: !!config.ELEVENLABS_API_KEY, google_tts: !!config.GOOGLE_TTS_API_KEY, azure: !!config.AZURE_SPEECH_KEY,
      mapbox: !!config.MAPBOX_ACCESS_TOKEN, google_maps: !!config.GOOGLE_MAPS_API_KEY, cesium: !!config.CESIUM_ION_TOKEN,
      luma: !!config.LUMA_API_KEY, runway: !!config.RUNWAY_API_KEY, kling: !!config.KLING_API_KEY,
    },
    /** Public map token for the in-browser location picker (Mapbox public tokens are designed to be client-visible). */
    mapPickerToken: config.MAPBOX_ACCESS_TOKEN || null,
  });
});

/* ---- settings / brand kit ---- */
api.get("/settings", asyncH(async (req, res) => res.json(await repo.getSettings(req.accountId))));
api.put("/settings", asyncH(async (req, res) => {
  const parsed = AccountSettingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid settings", issues: parsed.error.issues });
  res.json(await repo.saveSettings(req.accountId, parsed.data));
}));

/* ---- uploads ---- */
const ALLOWED = new Map([["image/png", "png"], ["image/jpeg", "jpg"], ["image/webp", "webp"]]);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
api.post("/uploads", upload.single("file"), asyncH(async (req, res) => {
  const f = req.file;
  const ext = f && ALLOWED.get(f.mimetype);
  if (!f || !ext) return res.status(400).json({ error: "Upload a PNG, JPEG or WebP image (max 10 MB)." });
  const kind = z.enum(["logo", "image"]).catch("image").parse(req.body?.kind);
  const url = await storage.put(`${req.accountId}/uploads/${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`, f.buffer, f.mimetype);
  res.status(201).json({ url });
}));

/* ---- projects ---- */
const withJobs = async (p: ProjectRow): Promise<ProjectWithJobs> => ({ ...p, jobs: await repo.listJobs(p.id) });
const owned = async (req: Request, res: Response): Promise<ProjectRow | null> => {
  const p = await repo.getProject(String(req.params.id));
  if (!p || p.accountId !== req.accountId) { res.status(404).json({ error: "Not found" }); return null; }
  return p;
};

function snapshot(settings: AccountSettings, input: z.infer<typeof ProjectInputSchema>): AccountSettings {
  return { ...settings, brandKit: { ...settings.brandKit, builderName: input.builderName, ...(input.brandKitOverride ?? {}) } };
}

api.get("/projects", asyncH(async (req, res) => {
  const list = await repo.listProjects(req.accountId);
  res.json(await Promise.all(list.map(withJobs)));
}));

api.post("/projects", asyncH(async (req, res) => {
  const parsed = ProjectInputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid project", issues: parsed.error.issues });
  const input = parsed.data;
  const roles = input.images.map((i) => i.role);
  if (roles.filter((r) => r === "site_layout").length > 1 || roles.filter((r) => r === "elevation").length > 1)
    return res.status(400).json({ error: "At most one site layout and one elevation image." });
  const project = await repo.createProject(req.accountId, input);
  const settings = snapshot(await repo.getSettings(req.accountId), input);
  await repo.patchProject(project.id, { settingsSnapshot: settings });
  await enqueuePipeline(project.id);
  res.status(201).json(await withJobs((await repo.getProject(project.id))!));
}));

api.get("/projects/:id", asyncH(async (req, res) => {
  const p = await owned(req, res);
  if (p) res.json(await withJobs(p));
}));

/** Re-run the whole pipeline (e.g. after a failure or after changing provider settings). */
api.post("/projects/:id/retry", asyncH(async (req, res) => {
  const p = await owned(req, res);
  if (!p) return;
  if (p.status === "queued" || p.status === "processing") return res.status(409).json({ error: "Already running" });
  const settings = snapshot(await repo.getSettings(req.accountId), p.input);
  await repo.patchProject(p.id, { settingsSnapshot: settings, status: "queued", error: null });
  await enqueuePipeline(p.id);
  res.json(await withJobs((await repo.getProject(p.id))!));
}));

api.delete("/projects/:id", asyncH(async (req, res) => {
  const p = await owned(req, res);
  if (!p) return;
  await repo.deleteProject(p.id);
  res.status(204).end();
}));

/* ---- script preview (same generator the pipeline uses) ---- */
api.post("/script/preview", asyncH(async (req, res) => {
  const parsed = ProjectInputSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
  const i = parsed.data;
  res.json(generateScript({
    name: i.name || "Your Project", builderName: i.builderName || "Your Company", tagline: i.tagline ?? "",
    projectType: i.projectType ?? "tower", addressText: i.addressText || "your chosen location",
    language: i.language ?? "en", images: i.images ?? [], customScript: i.customScript ?? null,
  }));
}));

/* ---- notifications ---- */
api.get("/notifications", asyncH(async (req, res) => res.json(await repo.listNotifications(req.accountId))));
api.post("/notifications/read", asyncH(async (req, res) => { await repo.markNotificationsRead(req.accountId); res.status(204).end(); }));

app.use("/api", api);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  log.error({ err }, "request failed");
  if (err instanceof multer.MulterError) return res.status(400).json({ error: err.message });
  res.status(500).json({ error: "Internal error" });
});

if (process.argv[1]?.endsWith("api.ts") || process.argv[1]?.endsWith("api.js")) {
  app.listen(config.PORT, () => log.info(`API on :${config.PORT} (storage=${useSupabase ? "supabase" : "local"}, paid APIs ${config.PAID_APIS_ENABLED ? "ENABLED" : "mocked"})`));
}
