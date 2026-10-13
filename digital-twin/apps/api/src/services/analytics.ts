import type { AnalyticsSummary } from '@dt/shared-types';
import type { Db, Row } from '../db/types.js';

const top = <K>(m: Map<K, number>, n: number) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);

export function summarize(events: Row[], towers: Row[], units: Row[], unitTypes: Row[], hotspots: Row[], days: number): AnalyticsSummary {
  const tName = new Map(towers.map((t) => [t.id, t.name as string]));
  const uById = new Map(units.map((u) => [u.id, u]));
  const utCode = new Map(unitTypes.map((t) => [t.id, t.code as string]));
  const hTitle = new Map(hotspots.map((h) => [h.id, h.title as string]));

  const sessions = new Set<string>();
  const byDay = new Map<string, number>();
  const floors = new Map<string, number>();
  const unitViews = new Map<string, number>();
  const hotspotClicks = new Map<string, number>();
  const presets = new Map<string, number>();
  let views = 0;

  for (const e of events) {
    sessions.add(e.session_id);
    if (e.type === 'view_start') {
      views++;
      const d = String(e.created_at).slice(0, 10);
      byDay.set(d, (byDay.get(d) ?? 0) + 1);
    } else if (e.type === 'floor_view' && e.tower_id && e.floor_number) {
      const k = `${e.tower_id}|${e.floor_number}`;
      floors.set(k, (floors.get(k) ?? 0) + 1);
    } else if (e.type === 'unit_view' && e.unit_id) unitViews.set(e.unit_id, (unitViews.get(e.unit_id) ?? 0) + 1);
    else if (e.type === 'hotspot_click' && e.hotspot_id) hotspotClicks.set(e.hotspot_id, (hotspotClicks.get(e.hotspot_id) ?? 0) + 1);
    else if (e.type === 'preset' && e.meta) presets.set(e.meta, (presets.get(e.meta) ?? 0) + 1);
  }

  const dayList: { date: string; views: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    dayList.push({ date: d, views: byDay.get(d) ?? 0 });
  }
  return {
    days,
    total_views: views,
    unique_sessions: sessions.size,
    views_by_day: dayList,
    top_floors: top(floors, 10).map(([k, v]) => { const [tid, fn] = k.split('|'); return { tower_id: tid!, tower_name: tName.get(tid!) ?? 'Unknown', floor_number: Number(fn), views: v }; }),
    top_units: top(unitViews, 10).map(([id, v]) => { const u = uById.get(id); return { unit_id: id, label: u?.label ?? '(deleted)', unit_type: u ? utCode.get(u.unit_type_id) ?? '?' : '?', views: v }; }),
    top_hotspots: top(hotspotClicks, 10).map(([id, v]) => ({ hotspot_id: id, title: hTitle.get(id) ?? '(deleted)', clicks: v })),
    preset_usage: top(presets, 10).map(([preset, count]) => ({ preset, count })),
  };
}

export async function projectSummary(db: Db, projectId: string, days: number): Promise<AnalyticsSummary> {
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const [events, towers, unitTypes, hotspots] = await Promise.all([
    db.list('analytics_events', { project_id: projectId }, { since }),
    db.list('towers', { project_id: projectId }),
    db.list('unit_types', { project_id: projectId }),
    db.list('hotspots', { project_id: projectId }),
  ]);
  const units = (await Promise.all(towers.map((t) => db.list('units', { tower_id: t.id })))).flat();
  return summarize(events, towers, units, unitTypes, hotspots, days);
}
