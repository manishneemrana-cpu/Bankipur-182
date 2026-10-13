import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  AccountSettings, JobRow, NotificationRow, ProjectAssets, ProjectInput, ProjectRow, ProjectStatus, Stage, StageStatus,
} from "@ave/shared-types";
import { config, useSupabase } from "../config.js";

export const DEFAULT_SETTINGS = (): AccountSettings => ({
  brandKit: {
    builderName: "Your Company",
    logoUrl: null,
    primaryColor: "#0B1F3A",
    accentColor: "#C9A24B",
    contactNumber: "",
  },
  providers: { tts: config.TTS_PROVIDER, map: config.MAP_PROVIDER, video: config.VIDEO_PROVIDER, voiceId: "" },
  notifyWebhookUrl: null,
  notifyEmail: null,
});

export interface JobPatch {
  status?: StageStatus;
  progress?: number;
  provider?: string | null;
  error?: string | null;
  attempts?: number;
  startedAt?: string | null;
  finishedAt?: string | null;
  bullJobId?: string | null;
}

export interface Repo {
  ensureAccount(accountId: string, name?: string): Promise<void>;
  /** Resolve the account for an authenticated Supabase user id (creating it on first login). */
  accountForOwner(ownerId: string): Promise<string>;
  getSettings(accountId: string): Promise<AccountSettings>;
  saveSettings(accountId: string, s: AccountSettings): Promise<AccountSettings>;
  createProject(accountId: string, input: ProjectInput): Promise<ProjectRow>;
  getProject(id: string): Promise<ProjectRow | null>;
  listProjects(accountId: string): Promise<ProjectRow[]>;
  patchProject(id: string, patch: { status?: ProjectStatus; assets?: ProjectAssets; error?: string | null; settingsSnapshot?: AccountSettings | null; input?: ProjectInput }): Promise<ProjectRow>;
  deleteProject(id: string): Promise<void>;
  createJob(projectId: string, stage: Stage, provider?: string | null): Promise<JobRow>;
  patchJob(id: string, patch: JobPatch): Promise<void>;
  listJobs(projectId: string): Promise<JobRow[]>;
  addNotification(n: Omit<NotificationRow, "id" | "createdAt" | "read">): Promise<void>;
  listNotifications(accountId: string): Promise<NotificationRow[]>;
  markNotificationsRead(accountId: string): Promise<void>;
}

/* ============================ Supabase ============================ */
type Row = Record<string, any>;

const toProject = (r: Row): ProjectRow => ({
  id: r.id, accountId: r.account_id, input: r.input, status: r.status, assets: r.assets ?? {},
  settingsSnapshot: r.settings_snapshot ?? null, error: r.error, createdAt: r.created_at, updatedAt: r.updated_at,
});
const toJob = (r: Row): JobRow => ({
  id: r.id, projectId: r.project_id, stage: r.stage, status: r.status, progress: r.progress, provider: r.provider,
  error: r.error, attempts: r.attempts, startedAt: r.started_at, finishedAt: r.finished_at, createdAt: r.created_at,
});
const toNotif = (r: Row): NotificationRow => ({
  id: r.id, accountId: r.account_id, projectId: r.project_id, kind: r.kind, message: r.message, read: r.read, createdAt: r.created_at,
});

class SupabaseRepo implements Repo {
  sb: SupabaseClient = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  private ok(r: { data: unknown; error: { message: string } | null }): any {
    if (r.error) throw new Error(`DB: ${r.error.message}`);
    return r.data;
  }
  async ensureAccount(accountId: string, name = "Dev account") {
    this.ok(await this.sb.from("accounts").upsert({ id: accountId, name }, { onConflict: "id", ignoreDuplicates: true }));
  }
  async accountForOwner(ownerId: string) {
    const found = this.ok(await this.sb.from("accounts").select("id").eq("owner_id", ownerId).maybeSingle());
    if (found) return (found as Row).id as string;
    const created = this.ok(await this.sb.from("accounts").insert({ owner_id: ownerId, name: "My account" }).select("id").single());
    return (created as Row).id as string;
  }
  async getSettings(accountId: string): Promise<AccountSettings> {
    const acc = this.ok(await this.sb.from("accounts").select("settings").eq("id", accountId).maybeSingle()) as Row | null;
    const kit = this.ok(await this.sb.from("brand_kits").select("*").eq("account_id", accountId).maybeSingle()) as Row | null;
    const d = DEFAULT_SETTINGS();
    const s = (acc?.settings ?? {}) as Partial<AccountSettings>;
    return {
      ...d, ...s,
      providers: { ...d.providers, ...(s.providers ?? {}) },
      brandKit: kit
        ? { builderName: kit.builder_name, logoUrl: kit.logo_url, primaryColor: kit.primary_color, accentColor: kit.accent_color, contactNumber: kit.contact_number }
        : d.brandKit,
    };
  }
  async saveSettings(accountId: string, s: AccountSettings) {
    const { brandKit, ...rest } = s;
    this.ok(await this.sb.from("accounts").update({ settings: rest }).eq("id", accountId));
    this.ok(await this.sb.from("brand_kits").upsert({
      account_id: accountId, builder_name: brandKit.builderName, logo_url: brandKit.logoUrl,
      primary_color: brandKit.primaryColor, accent_color: brandKit.accentColor, contact_number: brandKit.contactNumber,
      updated_at: new Date().toISOString(),
    }));
    return this.getSettings(accountId);
  }
  async createProject(accountId: string, input: ProjectInput) {
    return toProject(this.ok(await this.sb.from("projects").insert({ account_id: accountId, input }).select().single()));
  }
  async getProject(id: string) {
    const r = this.ok(await this.sb.from("projects").select("*").eq("id", id).maybeSingle());
    return r ? toProject(r as Row) : null;
  }
  async listProjects(accountId: string) {
    return (this.ok(await this.sb.from("projects").select("*").eq("account_id", accountId).order("created_at", { ascending: false })) as Row[]).map(toProject);
  }
  async patchProject(id: string, p: Parameters<Repo["patchProject"]>[1]) {
    const u: Row = { updated_at: new Date().toISOString() };
    if (p.status) u.status = p.status;
    if (p.error !== undefined) u.error = p.error;
    if (p.settingsSnapshot !== undefined) u.settings_snapshot = p.settingsSnapshot;
    if (p.input) u.input = p.input;
    if (p.assets) {
      // Merge into the latest stored assets (stages run in parallel and each writes only its own keys).
      // NOTE: read-modify-write; if contention ever matters, move this into a jsonb `||` SQL function.
      const cur = await this.getProject(id);
      u.assets = { ...(cur?.assets ?? {}), ...p.assets };
    }
    return toProject(this.ok(await this.sb.from("projects").update(u).eq("id", id).select().single()));
  }
  async deleteProject(id: string) {
    this.ok(await this.sb.from("projects").delete().eq("id", id));
  }
  async createJob(projectId: string, stage: Stage, provider: string | null = null) {
    return toJob(this.ok(await this.sb.from("jobs").insert({ project_id: projectId, stage, provider }).select().single()));
  }
  async patchJob(id: string, p: JobPatch) {
    const u: Row = {};
    if (p.status) u.status = p.status;
    if (p.progress !== undefined) u.progress = p.progress;
    if (p.provider !== undefined) u.provider = p.provider;
    if (p.error !== undefined) u.error = p.error;
    if (p.attempts !== undefined) u.attempts = p.attempts;
    if (p.startedAt !== undefined) u.started_at = p.startedAt;
    if (p.finishedAt !== undefined) u.finished_at = p.finishedAt;
    if (p.bullJobId !== undefined) u.bull_job_id = p.bullJobId;
    this.ok(await this.sb.from("jobs").update(u).eq("id", id));
  }
  async listJobs(projectId: string) {
    return (this.ok(await this.sb.from("jobs").select("*").eq("project_id", projectId).order("created_at")) as Row[]).map(toJob);
  }
  async addNotification(n: Omit<NotificationRow, "id" | "createdAt" | "read">) {
    this.ok(await this.sb.from("notifications").insert({ account_id: n.accountId, project_id: n.projectId, kind: n.kind, message: n.message }));
  }
  async listNotifications(accountId: string) {
    return (this.ok(await this.sb.from("notifications").select("*").eq("account_id", accountId).order("created_at", { ascending: false }).limit(50)) as Row[]).map(toNotif);
  }
  async markNotificationsRead(accountId: string) {
    this.ok(await this.sb.from("notifications").update({ read: true }).eq("account_id", accountId));
  }
}

/* ============================ Local JSON file (dev only) ============================ */
interface LocalDb {
  accounts: Record<string, { settings: AccountSettings }>;
  projects: ProjectRow[];
  jobs: JobRow[];
  notifications: NotificationRow[];
}

class LocalRepo implements Repo {
  private file = path.join(config.LOCAL_DATA_DIR, "db.json");
  /** serialise writes within this process; cross-process writes are last-writer-wins (dev only) */
  private chain: Promise<unknown> = Promise.resolve();

  private load(): LocalDb {
    try {
      return JSON.parse(fsSync.readFileSync(this.file, "utf8"));
    } catch {
      return { accounts: {}, projects: [], jobs: [], notifications: [] };
    }
  }
  private tx<T>(fn: (db: LocalDb) => T): Promise<T> {
    const run = async () => {
      const db = this.load();
      const out = fn(db);
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.${process.pid}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(db, null, 2));
      await fs.rename(tmp, this.file);
      return out;
    };
    const p = this.chain.then(run, run);
    this.chain = p.catch(() => undefined);
    return p;
  }
  private now = () => new Date().toISOString();

  ensureAccount(id: string) {
    return this.tx((db) => { db.accounts[id] ??= { settings: DEFAULT_SETTINGS() }; });
  }
  async accountForOwner(ownerId: string) {
    await this.ensureAccount(ownerId);
    return ownerId;
  }
  async getSettings(id: string) {
    const db = this.load();
    const d = DEFAULT_SETTINGS();
    const s = db.accounts[id]?.settings;
    return s ? { ...d, ...s, providers: { ...d.providers, ...s.providers }, brandKit: { ...d.brandKit, ...s.brandKit } } : d;
  }
  saveSettings(id: string, s: AccountSettings) {
    return this.tx((db) => { (db.accounts[id] ??= { settings: s }).settings = s; return s; });
  }
  createProject(accountId: string, input: ProjectInput) {
    return this.tx((db) => {
      const t = this.now();
      const p: ProjectRow = { id: randomUUID(), accountId, input, status: "draft", assets: {}, settingsSnapshot: null, error: null, createdAt: t, updatedAt: t };
      db.projects.push(p);
      return p;
    });
  }
  async getProject(id: string) { return this.load().projects.find((p) => p.id === id) ?? null; }
  async listProjects(accountId: string) {
    return this.load().projects.filter((p) => p.accountId === accountId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  patchProject(id: string, patch: Parameters<Repo["patchProject"]>[1]) {
    return this.tx((db) => {
      const p = db.projects.find((x) => x.id === id);
      if (!p) throw new Error(`project ${id} not found`);
      if (patch.status) p.status = patch.status;
      if (patch.error !== undefined) p.error = patch.error;
      if (patch.settingsSnapshot !== undefined) p.settingsSnapshot = patch.settingsSnapshot;
      if (patch.input) p.input = patch.input;
      if (patch.assets) p.assets = { ...p.assets, ...patch.assets };
      p.updatedAt = this.now();
      return p;
    });
  }
  deleteProject(id: string) {
    return this.tx((db) => { db.projects = db.projects.filter((p) => p.id !== id); db.jobs = db.jobs.filter((j) => j.projectId !== id); });
  }
  createJob(projectId: string, stage: Stage, provider: string | null = null) {
    return this.tx((db) => {
      const j: JobRow = { id: randomUUID(), projectId, stage, status: "queued", progress: 0, provider, error: null, attempts: 0, startedAt: null, finishedAt: null, createdAt: this.now() };
      db.jobs.push(j);
      return j;
    });
  }
  patchJob(id: string, p: JobPatch) {
    return this.tx((db) => {
      const j = db.jobs.find((x) => x.id === id);
      if (!j) return;
      const { bullJobId: _b, ...rest } = p;
      Object.assign(j, Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)));
    });
  }
  async listJobs(projectId: string) { return this.load().jobs.filter((j) => j.projectId === projectId); }
  addNotification(n: Omit<NotificationRow, "id" | "createdAt" | "read">) {
    return this.tx((db) => { db.notifications.unshift({ ...n, id: randomUUID(), read: false, createdAt: this.now() }); });
  }
  async listNotifications(accountId: string) { return this.load().notifications.filter((n) => n.accountId === accountId).slice(0, 50); }
  markNotificationsRead(accountId: string) {
    return this.tx((db) => { db.notifications.forEach((n) => { if (n.accountId === accountId) n.read = true; }); });
  }
}

export const repo: Repo = useSupabase ? new SupabaseRepo() : new LocalRepo();
