import type { AnalyticsSummary, FloorPlanAnalysis, ProjectBundle } from '@dt/shared-types';

export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8787').replace(/\/$/, '');
export const VIEWER_URL = (import.meta.env.VITE_VIEWER_URL ?? 'http://localhost:5173').replace(/\/$/, '');
export const assetUrl = <T extends string | null | undefined>(u: T): T => (u && u.startsWith('/') ? `${API_URL}${u}` : u) as T;

// sessionStorage: the admin token dies with the tab.
const KEY = 'dt-admin-token';
export const getToken = () => { try { return sessionStorage.getItem(KEY) ?? ''; } catch { return ''; } };
export const setToken = (t: string) => { try { t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY); } catch { /* ignore */ } };

export class ApiError extends Error { constructor(public status: number, msg: string) { super(msg); } }

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}/api/admin${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${getToken()}`, ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.issues ? ': ' + data.issues.map((i: { path: string; message: string }) => `${i.path} ${i.message}`).join('; ') : '';
    throw new ApiError(res.status, (data.error ?? `HTTP ${res.status}`) + detail);
  }
  return data as T;
}

const json = (method: string, body: unknown) => ({ method, body: JSON.stringify(body) });

export const api = {
  projects: () => req<{ id: string; slug: string; name: string; location: string; cover_image_url: string | null; is_published: boolean }[]>('/projects'),
  createProject: (b: object) => req<{ id: string }>('/projects', json('POST', b)),
  bundle: (id: string) => req<ProjectBundle>(`/projects/${id}`),
  patchProject: (id: string, b: object) => req(`/projects/${id}`, json('PATCH', b)),
  deleteProject: (id: string) => req(`/projects/${id}`, { method: 'DELETE' }),
  createTower: (pid: string, b: object) => req(`/projects/${pid}/towers`, json('POST', b)),
  patchTower: (id: string, b: object) => req(`/towers/${id}`, json('PATCH', b)),
  deleteTower: (id: string) => req(`/towers/${id}`, { method: 'DELETE' }),
  patchFloor: (id: string, b: object) => req(`/floors/${id}`, json('PATCH', b)),
  createUnitType: (pid: string, b: object) => req(`/projects/${pid}/unit-types`, json('POST', b)),
  patchUnitType: (id: string, b: object) => req(`/unit-types/${id}`, json('PATCH', b)),
  deleteUnitType: (id: string) => req(`/unit-types/${id}`, { method: 'DELETE' }),
  generateUnits: (towerId: string, b: object) => req<{ created: number }>(`/towers/${towerId}/units/generate`, json('POST', b)),
  patchUnit: (id: string, b: object) => req(`/units/${id}`, json('PATCH', b)),
  deleteUnit: (id: string) => req(`/units/${id}`, { method: 'DELETE' }),
  assignType: (towerId: string, b: object) => req<{ updated: number }>(`/towers/${towerId}/units/assign-type`, json('POST', b)),
  createHotspot: (pid: string, b: object) => req(`/projects/${pid}/hotspots`, json('POST', b)),
  patchHotspot: (id: string, b: object) => req(`/hotspots/${id}`, json('PATCH', b)),
  deleteHotspot: (id: string) => req(`/hotspots/${id}`, { method: 'DELETE' }),
  analytics: (pid: string, days: number) => req<AnalyticsSummary>(`/projects/${pid}/analytics?days=${days}`),
  analyzeFloorPlan: (file: File, projectId: string) => {
    const f = new FormData(); f.append('project_id', projectId); f.append('file', file);
    return req<{ id: string; provider: string; is_mock: boolean; result: FloorPlanAnalysis }>('/floorplan/analyze', { method: 'POST', body: f });
  },
  floorPlanAnalyses: (pid: string) => req<{ id: string; provider: string; is_mock: boolean; result: FloorPlanAnalysis; created_at: string }[]>(`/projects/${pid}/floorplan-analyses`),
  upload: (file: File, kind: 'glb' | 'image', projectId: string) => {
    const f = new FormData(); f.append('file', file);
    return req<{ url: string; size: number; draco: boolean | null; floor_nodes: number | null; warnings: string[] }>(`/upload?kind=${kind}&project_id=${projectId}`, { method: 'POST', body: f });
  },
};
