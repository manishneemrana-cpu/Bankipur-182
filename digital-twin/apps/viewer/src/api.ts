import type { AnalyticsEventInput, ProjectBundle } from '@dt/shared-types';

export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8787').replace(/\/$/, '');

/** Demo mode (VITE_DEMO=1): no backend. The bundled sample project + models are served as static files from /demo. */
export const DEMO = import.meta.env.VITE_DEMO === '1';
export const DEMO_SLUG = 'skyline-residences';

/** Stored URLs may be API-relative (/files/...) when files live on the API's disk. */
export const assetUrl = <T extends string | null | undefined>(u: T): T => {
  if (!u || !u.startsWith('/')) return u;
  if (DEMO) return `${import.meta.env.BASE_URL}demo/${u.replace(/^\/files\/sample\//, '')}` as T;
  return `${API_URL}${u}` as T;
};

export async function fetchBundle(slug: string, signal?: AbortSignal): Promise<ProjectBundle> {
  if (DEMO) {
    if (slug !== DEMO_SLUG) throw new Error('This demo only contains the sample project.');
    const res = await fetch(`${import.meta.env.BASE_URL}demo/project.json`, { signal });
    if (!res.ok) throw new Error(`Could not load the demo project (HTTP ${res.status}).`);
    return res.json();
  }
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
  if (DEMO || !slugForEvents) return; // the static demo has no analytics endpoint
  const url = `${API_URL}/api/public/projects/${encodeURIComponent(slugForEvents)}/events`;
  const body = JSON.stringify({ ...e, session_id: sessionId });
  try {
    if (!navigator.sendBeacon?.(url, new Blob([body], { type: 'text/plain' })))
      void fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'text/plain' }, keepalive: true }).catch(() => {});
  } catch { /* analytics must never break the viewer */ }
}
