import type { UnitType, Vec3 } from '@dt/shared-types';
import { useState } from 'react';
import { api } from '../api';
import { ErrorMsg, Field, Num, UploadField, useAction } from '../ui';
import type { TabProps } from './ProjectEditor';

export function UnitTypes({ bundle, reload }: TabProps) {
  const { busy, error, run } = useAction();
  const [d, setD] = useState({ code: '2BHK', name: '2 BHK Apartment', area_sqm: 60, bedrooms: 2, bathrooms: 2 });
  return (
    <div className="stack">
      {bundle.unit_types.map((t) => <TypeCard key={t.id} type={t} projectId={bundle.project.id} used={bundle.units.filter((u) => u.unit_type_id === t.id).length} reload={reload} />)}
      <form className="card form" onSubmit={(e) => { e.preventDefault(); void run(async () => { await api.createUnitType(bundle.project.id, d); await reload(); }); }}>
        <h2>Add unit type</h2>
        <div className="cols">
          <Field label="Code"><input value={d.code} onChange={(e) => setD({ ...d, code: e.target.value.toUpperCase() })} /></Field>
          <Field label="Name"><input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></Field>
          <Field label="Area (m²)"><Num value={d.area_sqm} onChange={(n) => setD({ ...d, area_sqm: n })} /></Field>
          <Field label="Bedrooms"><Num step="1" value={d.bedrooms} onChange={(n) => setD({ ...d, bedrooms: n })} /></Field>
          <Field label="Bathrooms"><Num step="1" value={d.bathrooms} onChange={(n) => setD({ ...d, bathrooms: n })} /></Field>
        </div>
        <ErrorMsg error={error} />
        <button disabled={busy || !d.code || !d.name}>Add unit type</button>
      </form>
    </div>
  );
}

function TypeCard({ type, projectId, used, reload }: { type: UnitType; projectId: string; used: number; reload: () => Promise<void> }) {
  const [rooms, setRooms] = useState(type.rooms);
  const [spawn, setSpawn] = useState<Vec3>(type.spawn);
  const { busy, error, run } = useAction();
  const patch = (p: object) => run(async () => { await api.patchUnitType(type.id, p); await reload(); });
  return (
    <section className="card form">
      <h2>{type.code} <small>{type.name} · used by {used} unit{used === 1 ? '' : 's'}</small></h2>
      <UploadField label="Interior GLB" kind="glb" projectId={projectId} value={type.glb_url} onChange={(u) => patch({ glb_url: u })}
        hint="Origin = centre of the floor plate, y = 0 floor. Nodes: Wall* (collision), Furniture* (furnished toggle), Ceiling* (hidden in dollhouse view)." />
      <h3>Room labels</h3>
      <table className="table">
        <thead><tr><th>Room</th><th>X</th><th>Y</th><th>Z</th><th>Area m²</th><th /></tr></thead>
        <tbody>
          {rooms.map((r, i) => (
            <tr key={i}>
              <td><input value={r.name} onChange={(e) => setRooms(rooms.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /></td>
              {[0, 1, 2].map((k) => <td key={k}><Num value={r.position[k]!} onChange={(n) => setRooms(rooms.map((x, j) => (j === i ? { ...x, position: x.position.map((v, m) => (m === k ? n : v)) as Vec3 } : x)))} /></td>)}
              <td><Num value={r.area_sqm ?? NaN} onChange={(n) => setRooms(rooms.map((x, j) => (j === i ? { ...x, area_sqm: Number.isNaN(n) ? null : n } : x)))} /></td>
              <td><button className="ghost" onClick={() => setRooms(rooms.filter((_, j) => j !== i))}>✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row">
        <button className="ghost" onClick={() => setRooms([...rooms, { name: 'New room', position: [0, 2.1, 0], area_sqm: null }])}>+ Room</button>
        <Field label="Walk-through spawn X / Z"><span className="pair"><Num value={spawn[0]} onChange={(n) => setSpawn([n, spawn[1], spawn[2]])} /><Num value={spawn[2]} onChange={(n) => setSpawn([spawn[0], spawn[1], n])} /></span></Field>
        <button disabled={busy} onClick={() => patch({ rooms, spawn })}>Save rooms & spawn</button>
      </div>
      <ErrorMsg error={error} />
      <button className="danger" onClick={() => { if (confirm(`Delete unit type ${type.code}?`)) void run(async () => { await api.deleteUnitType(type.id); await reload(); }); }}>Delete unit type</button>
    </section>
  );
}
