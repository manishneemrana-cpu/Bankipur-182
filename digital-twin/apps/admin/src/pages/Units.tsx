import type { UnitSlot } from '@dt/shared-types';
import { useMemo, useState } from 'react';
import { api } from '../api';
import { ErrorMsg, Field, Num, useAction } from '../ui';
import type { TabProps } from './ProjectEditor';

interface SlotRow { suffix: string; unit_type_id: string; x0: number; z0: number; x1: number; z1: number; area: number }

export function Units({ bundle, reload }: TabProps) {
  const [towerId, setTowerId] = useState(bundle.towers[0]?.id ?? '');
  const tower = bundle.towers.find((t) => t.id === towerId);
  const types = bundle.unit_types;
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(tower?.floor_count ?? 1);
  const [replace, setReplace] = useState(false);
  const [slots, setSlots] = useState<SlotRow[]>([{ suffix: '01', unit_type_id: types[0]?.id ?? '', x0: -12, z0: -7, x1: -3, z1: 1, area: 72 }]);
  const [floorFilter, setFloorFilter] = useState<number | ''>('');
  const { busy, error, run } = useAction();
  const [msg, setMsg] = useState('');
  const units = useMemo(() => bundle.units.filter((u) => u.tower_id === towerId && (floorFilter === '' || u.floor_number === floorFilter)).sort((a, b) => a.floor_number - b.floor_number || a.label.localeCompare(b.label)), [bundle.units, towerId, floorFilter]);

  if (!bundle.towers.length) return <p>Add a tower first.</p>;
  if (!types.length) return <p>Add at least one unit type first.</p>;

  const generate = () => run(async () => {
    const payload = slots.map<UnitSlot>((s) => ({ suffix: s.suffix, unit_type_id: s.unit_type_id, area_sqm: Number.isFinite(s.area) ? s.area : null, outline: [[s.x0, s.z0], [s.x1, s.z0], [s.x1, s.z1], [s.x0, s.z1]] }));
    const r = await api.generateUnits(towerId, { floor_from: from, floor_to: to, slots: payload, replace });
    setMsg(`Created ${r.created} unit${r.created === 1 ? '' : 's'}.`); await reload();
  });

  return (
    <div className="stack">
      <Field label="Tower"><select value={towerId} onChange={(e) => { setTowerId(e.target.value); setTo(bundle.towers.find((t) => t.id === e.target.value)!.floor_count); }}>{bundle.towers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>

      <section className="card form">
        <h2>Generate units from a typical floor plate</h2>
        <p className="muted">Each row is one apartment position that repeats on every floor in the range. The rectangle is in <b>tower-local metres</b> (origin = footprint centre, X right, Z toward the viewer). Labels become floor + suffix (e.g. 12 + 01 → 1201).</p>
        <table className="table">
          <thead><tr><th>Suffix</th><th>Unit type</th><th>X min</th><th>Z min</th><th>X max</th><th>Z max</th><th>Area m²</th><th /></tr></thead>
          <tbody>{slots.map((s, i) => {
            const set = (p: Partial<SlotRow>) => setSlots(slots.map((x, j) => (j === i ? { ...x, ...p } : x)));
            return (
              <tr key={i}>
                <td><input size={4} value={s.suffix} onChange={(e) => set({ suffix: e.target.value })} /></td>
                <td><select value={s.unit_type_id} onChange={(e) => set({ unit_type_id: e.target.value })}>{types.map((t) => <option key={t.id} value={t.id}>{t.code}</option>)}</select></td>
                {(['x0', 'z0', 'x1', 'z1', 'area'] as const).map((k) => <td key={k}><Num value={s[k]} onChange={(n) => set({ [k]: n })} /></td>)}
                <td><button className="ghost" onClick={() => setSlots(slots.filter((_, j) => j !== i))}>✕</button></td>
              </tr>
            );
          })}</tbody>
        </table>
        <div className="row">
          <button className="ghost" onClick={() => setSlots([...slots, { ...slots[slots.length - 1]!, suffix: String(slots.length + 1).padStart(2, '0') }])}>+ Slot</button>
          <Field label="Floors from"><Num step="1" min={1} value={from} onChange={setFrom} /></Field>
          <Field label="to"><Num step="1" min={1} value={to} onChange={setTo} /></Field>
          <label className="check"><input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} /> Replace existing units on these floors</label>
          <button disabled={busy || !slots.length || slots.some((s) => !s.suffix || ![s.x0, s.z0, s.x1, s.z1].every(Number.isFinite) || s.x0 === s.x1 || s.z0 === s.z1)} onClick={generate}>Generate</button>
        </div>
        {msg && <p className="ok">{msg}</p>}
        <ErrorMsg error={error} />
      </section>

      <section className="card form">
        <h2>Units ({units.length})</h2>
        <div className="row">
          <Field label="Filter by floor"><Num step="1" value={floorFilter === '' ? NaN : floorFilter} onChange={(n) => setFloorFilter(Number.isNaN(n) ? '' : n)} /></Field>
          <BulkAssign towerId={towerId} types={types} reload={reload} />
        </div>
        <table className="table">
          <thead><tr><th>Floor</th><th>Unit</th><th>Type</th><th>Area</th><th>Status</th><th /></tr></thead>
          <tbody>{units.slice(0, 200).map((u) => (
            <tr key={u.id}>
              <td>{u.floor_number}</td><td>{u.label}</td>
              <td><select value={u.unit_type_id} onChange={(e) => run(async () => { await api.patchUnit(u.id, { unit_type_id: e.target.value }); await reload(); })}>{types.map((t) => <option key={t.id} value={t.id}>{t.code}</option>)}</select></td>
              <td>{u.area_sqm ?? '–'}</td>
              <td><select value={u.status} onChange={(e) => run(async () => { await api.patchUnit(u.id, { status: e.target.value }); await reload(); })}><option>available</option><option>hold</option><option>sold</option></select></td>
              <td><button className="ghost" onClick={() => run(async () => { await api.deleteUnit(u.id); await reload(); })}>✕</button></td>
            </tr>
          ))}</tbody>
        </table>
        {units.length > 200 && <p className="muted">Showing the first 200 – use the floor filter.</p>}
      </section>
    </div>
  );
}

/** "Tag which floors/units use which type": retarget every unit ending in a suffix across a floor range. */
function BulkAssign({ towerId, types, reload }: { towerId: string; types: TabProps['bundle']['unit_types']; reload: () => Promise<void> }) {
  const [suffix, setSuffix] = useState('01');
  const [type, setType] = useState(types[0]!.id);
  const [a, setA] = useState(1);
  const [b, setB] = useState(99);
  const { busy, run } = useAction();
  const [n, setN] = useState<number | null>(null);
  return (
    <div className="row bulk">
      <b>Bulk tag:</b> units ending <input size={3} value={suffix} onChange={(e) => setSuffix(e.target.value)} /> on floors <Num step="1" value={a} onChange={setA} /> – <Num step="1" value={b} onChange={setB} /> →
      <select value={type} onChange={(e) => setType(e.target.value)}>{types.map((t) => <option key={t.id} value={t.id}>{t.code}</option>)}</select>
      <button disabled={busy || !suffix} onClick={() => run(async () => { setN((await api.assignType(towerId, { unit_type_id: type, suffix, floor_from: a, floor_to: b })).updated); await reload(); })}>Apply</button>
      {n !== null && <span className="ok">{n} updated</span>}
    </div>
  );
}
