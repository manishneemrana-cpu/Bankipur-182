import type { AccountSettings, NotificationRow, ProjectInput, ProjectWithJobs } from "@ave/shared-types";
import { accessToken } from "./auth";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4100/api";

export class ApiError extends Error {
  constructor(public status: number, message: string, public issues?: { path: (string | number)[]; message: string }[]) { super(message); }
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await accessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set("content-type", "application/json");
  const res = await fetch(`${API_URL}${path}`, { ...init, headers, cache: "no-store" });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  // HTTP/2 has no reason phrase, so res.statusText is "" behind TLS proxies: always keep a visible message.
  if (!res.ok) throw new ApiError(res.status, body.error ?? (res.statusText || `Request failed (HTTP ${res.status}) – ${path}`), body.issues);
  return body as T;
}

export interface Options {
  providers: { tts: readonly string[]; map: readonly string[]; video: readonly string[] };
  defaults: { tts: string; map: string; video: string };
  paidApisEnabled: boolean;
  keysConfigured: Record<string, boolean>;
}

export const api = {
  options: () => req<Options>("/options"),
  settings: () => req<AccountSettings>("/settings"),
  saveSettings: (s: AccountSettings) => req<AccountSettings>("/settings", { method: "PUT", body: JSON.stringify(s) }),
  projects: () => req<ProjectWithJobs[]>("/projects"),
  project: (id: string) => req<ProjectWithJobs>(`/projects/${id}`),
  createProject: (input: Partial<ProjectInput>) => req<ProjectWithJobs>("/projects", { method: "POST", body: JSON.stringify(input) }),
  retry: (id: string) => req<ProjectWithJobs>(`/projects/${id}/retry`, { method: "POST" }),
  remove: (id: string) => req<void>(`/projects/${id}`, { method: "DELETE" }),
  scriptPreview: (input: Partial<ProjectInput>) => req<{ templateId: string; sentences: string[]; text: string }>("/script/preview", { method: "POST", body: JSON.stringify(input) }),
  notifications: () => req<NotificationRow[]>("/notifications"),
  markRead: () => req<void>("/notifications/read", { method: "POST" }),
  async upload(file: File, kind: "logo" | "image") {
    const fd = new FormData();
    fd.set("kind", kind);
    fd.set("file", file);
    return (await req<{ url: string }>("/uploads", { method: "POST", body: fd })).url;
  },
};

/** Cross-origin `download` attributes are ignored by browsers, so fetch the blob and save it. */
export async function downloadFile(url: string, filename: string) {
  const blob = await (await fetch(url)).blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
