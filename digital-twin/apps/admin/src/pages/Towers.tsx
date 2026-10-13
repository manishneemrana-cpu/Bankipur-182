import type { Tower } from '@dt/shared-types';
import { useState } from 'react';
import { api } from '../api';
import { ErrorMsg, Field, Num, UploadField, useAction } from '../ui';
import type { TabProps } from './ProjectEditor';

const blank = { name: '', floor_count: 10, floor_height: 3, footprint_w: 24, footprint_d: 14, position: [0, 0, 0] as [number, number, number], rotation_y: 0 };

export function Towers({ bundle, reload }: TabProps) {
  const [draft, setDraft] = useState({ ...blank, name: `Tower ${String.fromCharCode(65 + bundle.towers.length)}` });
  const { busy, error, run } = useAction();
  return (
    <div className="stack">
      {bundle.towers.map((t) => <TowerCard key={t.id} tower={t} bundle={bundle} reload={reload} />)}
      <form className="card form" onSubmit={(e) => { e.preventDefault(); void run(async () => { await api.createTower(bundle.project.id, { ...draft, sort_order: bundle.towers.length }); await reload(); setDraft({ ...blank, name: `Tower ${String.fromCharCode(66 + bundle.towers.length)}` }); }); }}>
        <h2>Add tower</h2>
        <TowerFields v={draft} onChange={(v) => setDraft({ ...draft, ...v })} />
        <ErrorMsg error={error} />
        <button disabled={busy || !draft.name || !(draft.floor_count >= 1)}>Add tower</button>
      </form>
    </div>
  );
}

type Fields = typeof blank;
function TowerFields({ v, onChange }: { v: Fields; onChange: (v: Partial<Fields>) => void }) {
  return (
    <div className="cols">
      <Field label="Name"><input value={v.name} onChange={(e) => onChange({ name: e.target.value })} /></Field>
      <Field label="Floors"><Num step="1" min={1} max={250} value={v.floor_count} onChange={(n) => onChange({ floor_count: n })} /></Field>
      <Field label="Floor height (m)"><Num value={v.floor_height} onChange={(n) => onChange({ floor_height: n })} min={0.1} /></Field>
      <Field label="Footprint W × D (m)"><span className="pair"><Num value={v.footprint_w} onChange={(n) => onChange({ footprint_w: n })} min={1} /><Num value={v.footprint_d} onChange={(n) => onChange({ footprint_d: n })} min={1} /></span></Field>
      <Field label="Position in site X / Y / Z" hint="Where the tower's origin sits in the site model."><span className="triple">{[0, 1, 2].map((i) => <Num key={i} value={v.position[i]!} onChange={(n) => { const p = [...v.position] as [number, number, number]; p[i] = n; onChange({ position: p }); }} />)}</span></Field>
      <Field label="Rotation Y (rad)"><Num value={v.rotation_y} onChange={(n) => onChange({ rotation_y: n })} /></Field>
    </div>
  );
}

function TowerCard({ tower, bundle, reload }: { tower: Tower } & TabProps) {
  const [v, setV] = useState<Fields>({ name: tower.name, floor_count: tower.floor_count, floor_height: tower.floor_height, footprint_w: tower.footprint_w, footprint_d: tower.footprint_d, position: tower.position, rotation_y: tower.rotation_y });
  const [open, setOpen] = useState(false);
  const { busy, error, run } = useAction();
  const floors = bundle.floors.filter((f) => f.tower_id === tower.id).sort((a, b) => a.floor_number - b.floor_number);
  const patch = (p: object) => run(async () => { await api.patchTower(tower.id, p); await reload(); });
  const shrinking = v.floor_count < tower.floor_count;
  return (
    <section className="card form">
      <h2>{tower.name} <small>{tower.floor_count} floors</small></h2>
      <TowerFields v={v} onChange={(p) => setV({ ...v, ...p })} />
      {shrinking && <p className="warn">Reducing floors deletes floors {v.floor_count + 1}–{tower.floor_count} and their units.</p>}
      <div className="row"><button disabled={busy} onClick={() => patch(v)}>Save tower</button>
        <button className="danger" onClick={() => { if (confirm(`Delete ${tower.name}, its floors and units?`)) void run(async () => { await api.deleteTower(tower.id); await reload(); }); }}>Delete</button></div>
      <UploadField label="Tower GLB (full detail)" kind="glb" projectId={bundle.project.id} value={tower.glb_url} onChange={(u) => patch({ glb_url: u })}
        hint={`Floors must be child nodes named ${tower.floor_node_prefix}01, ${tower.floor_node_prefix}02 … (optional: Shell*, Roof). See README → GLB conventions.`} />
      <UploadField label="Tower GLB (LOD – simplified)" kind="glb" projectId={bundle.project.id} value={tower.lod_glb_url} onChange={(u) => patch({ lod_glb_url: u })} hint="Single simplified mesh for far zoom. Loads first, so keep it tiny." />
      <ErrorMsg error={error} />
      <button className="ghost" onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Show'} per-floor settings ({floors.length})</button>
      {open && (
        <table className="table">
          <thead><tr><th>Floor</th><th>Label</th><th>Elevation (m)</th><th>Dedicated floor GLB (optional)</th></tr></thead>
          <tbody>{floors.map((f) => <FloorRow key={f.id} floor={f} projectId={bundle.project.id} reload={reload} />)}</tbody>
        </table>
      )}
    </section>
  );
}

function FloorRow({ floor, projectId, reload }: { floor: TabProps['bundle']['floors'][number]; projectId: string; reload: () => Promise<void> }) {
  const [label, setLabel] = useState(floor.label ?? '');
  const [elev, setElev] = useState(floor.elevation);
  const { run } = useAction();
  const save = (p: object) => run(async () => { await api.patchFloor(floor.id, p); await reload(); });
  return (
    <tr>
      <td>{floor.floor_number}</td>
      <td><input value={label} onChange={(e) => setLabel(e.target.value)} onBlur={() => label !== (floor.label ?? '') && save({ label: label || null })} /></td>
      <td><Num value={elev} onChange={setElev} /> {elev !== floor.elevation && <button className="ghost" onClick={() => save({ elevation: elev })}>Save</button>}</td>
      <td><UploadField label="" kind="glb" projectId={projectId} value={floor.glb_url} onChange={(u) => save({ glb_url: u })} /></td>
    </tr>
  );
}
