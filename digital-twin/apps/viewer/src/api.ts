import type { AnalyticsEventInput, ProjectBundle } from '@dt/shared-types';

export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8787').replace(/\/$/, '');

/** Stored URLs may be API-relative (/files/...) when files live on the API's disk. */
export const assetUrl = <T extends string | null | undefined>(u: T): T =>
  (u && u.startsWith('/') ? `${API_URL}${u}` : u) as T;

export async function fetchBundle(slug: string, signal?: AbortSignal): Promise<ProjectBundle> {
  const res = await fetch(`${API_URL}/api/public/projects/${encodeURIComponent(slug)}`, { signal });
  if (res.status === 404) throw new Error('This project link is not available. It may be unpublished or mistyped.');
  if (!res.ok) throw new Error(`Could not load the project (HTTP ${res.status}).`);
  return res.json();
}

const sessionId = (() => {
  try {
    const k = 'dt-session';
    let s = sessionStorage.getItem(k);
    if (!s) { s = crypto.randomUUID(); sessionStorage.setItem(k, s); }
    return s;
  } catch { return crypto.randomUUID(); }
})();

let slugForEvents = '';
export const setAnalyticsSlug = (s: string) => { slugForEvents = s; };

/** Fire-and-forget. text/plain keeps sendBeacon a "simple" request (no CORS preflight). */
export function track(e: Omit<AnalyticsEventInput, 'session_id'>) {
  if (!slugForEvents) return;
  const url = `${API_URL}/api/public/projects/${encodeURIComponent(slugForEvents)}/events`;
  const body = JSON.stringify({ ...e, session_id: sessionId });
  try {
    if (!navigator.sendBeacon?.(url, new Blob([body], { type: 'text/plain' })))
      void fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'text/plain' }, keepalive: true }).catch(() => {});
  } catch { /* analytics must never break the viewer */ }
}
