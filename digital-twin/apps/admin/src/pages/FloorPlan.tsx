import type { FloorPlanAnalysis } from '@dt/shared-types';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { ErrorMsg, useAction } from '../ui';
import type { TabProps } from './ProjectEditor';

type Item = Awaited<ReturnType<typeof api.floorPlanAnalyses>>[number];

export function FloorPlan({ bundle }: TabProps) {
  const [items, setItems] = useState<Item[]>([]);
  const { busy, error, run } = useAction();
  const load = () => run(async () => setItems((await api.floorPlanAnalyses(bundle.project.id)).reverse()));
  useEffect(() => { void load(); }, [bundle.project.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const download = (r: FloorPlanAnalysis) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' }));
    a.download = `floorplan-${r.source_file.replace(/\.[^.]+$/, '')}-${r.provider}.json`; a.click(); URL.revokeObjectURL(a.href);
  };
  return (
    <div className="stack">
      <section className="card form">
        <h2>2D floor plan → structured reference for the 3D artist</h2>
        <p className="muted">Output is a <b>trace reference</b> (rooms, walls, openings in metres) to speed up modelling in Blender/SketchUp. It is never published to the viewer automatically.</p>
        <p className="warn">Provider adapters (CubiCasa, Archilogic) currently return a <b>MOCK</b> response — no paid API is called until you confirm keys are ready.</p>
        <input type="file" accept="image/png,image/jpeg,application/pdf" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void run(async () => { await api.analyzeFloorPlan(f, bundle.project.id); await load(); }); }} />
        <ErrorMsg error={error} />
      </section>
      {items.map((it) => (
        <section key={it.id} className="card">
          <h3>{it.result.source_file} <small>{it.provider} · {new Date(it.created_at).toLocaleString()}</small> {it.is_mock && <em className="draft">MOCK</em>}</h3>
          <p>{it.result.rooms.length} rooms · {it.result.walls.length} walls · {it.result.openings.length} openings</p>
          <ul>{it.result.warnings.map((w, i) => <li key={i} className="warn">{w}</li>)}</ul>
          <button onClick={() => download(it.result)}>Download JSON</button>
        </section>
      ))}
    </div>
  );
}
