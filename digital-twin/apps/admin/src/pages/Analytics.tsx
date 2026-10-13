import type { AnalyticsSummary } from '@dt/shared-types';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { ErrorMsg, useAction } from '../ui';
import type { TabProps } from './ProjectEditor';

function Bars({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="muted">No data yet.</p>;
  return <ul className="bars">{rows.map((r, i) => <li key={i}><span>{r.label}</span><i style={{ width: `${(r.value / max) * 100}%` }} /><b>{r.value}</b></li>)}</ul>;
}

export function Analytics({ bundle }: TabProps) {
  const [days, setDays] = useState(30);
  const [s, setS] = useState<AnalyticsSummary | null>(null);
  const { error, run } = useAction();
  useEffect(() => { void run(async () => setS(await api.analytics(bundle.project.id, days))); }, [bundle.project.id, days]); // eslint-disable-line react-hooks/exhaustive-deps
  const maxDay = Math.max(1, ...(s?.views_by_day.map((d) => d.views) ?? [1]));
  return (
    <div className="stack">
      <div className="row"><label>Period <select value={days} onChange={(e) => setDays(Number(e.target.value))}>{[7, 30, 90, 365].map((d) => <option key={d} value={d}>Last {d} days</option>)}</select></label></div>
      <ErrorMsg error={error} />
      {s && (
        <>
          <div className="stats"><div className="card"><b>{s.total_views}</b><span>Views</span></div><div className="card"><b>{s.unique_sessions}</b><span>Unique sessions</span></div></div>
          <section className="card"><h2>Views per day</h2><div className="spark" role="img" aria-label="Views per day">{s.views_by_day.map((d) => <i key={d.date} title={`${d.date}: ${d.views}`} style={{ height: `${(d.views / maxDay) * 100}%` }} />)}</div></section>
          <div className="cols">
            <section className="card"><h2>Most-explored floors</h2><Bars rows={s.top_floors.map((f) => ({ label: `${f.tower_name} · floor ${f.floor_number}`, value: f.views }))} /></section>
            <section className="card"><h2>Most-explored units</h2><Bars rows={s.top_units.map((u) => ({ label: `${u.label} (${u.unit_type})`, value: u.views }))} /></section>
            <section className="card"><h2>Amenity clicks</h2><Bars rows={s.top_hotspots.map((h) => ({ label: h.title, value: h.clicks }))} /></section>
            <section className="card"><h2>Preset usage</h2><Bars rows={s.preset_usage.map((p) => ({ label: p.preset, value: p.count }))} /></section>
          </div>
        </>
      )}
    </div>
  );
}
