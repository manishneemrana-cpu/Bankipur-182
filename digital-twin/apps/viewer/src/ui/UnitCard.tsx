import { selectors, useStore } from '../store';

export function UnitCard() {
  const unit = useStore(selectors.unit);
  const type = useStore((s) => s.bundle?.unit_types.find((t) => t.id === selectors.unit(s)?.unit_type_id));
  const back = useStore((s) => s.up);
  const tower = useStore(selectors.tower);
  if (!unit) return null;
  return (
    <aside className="unitcard" aria-label="Unit details">
      <button className="link" onClick={back}>← Back to floor {unit.floor_number}</button>
      <h2>{tower?.name} · {unit.label}</h2>
      <p className="muted">{type?.name ?? type?.code}</p>
      <dl>
        {type && <><dt>Bedrooms</dt><dd>{type.bedrooms}</dd><dt>Bathrooms</dt><dd>{type.bathrooms}</dd></>}
        {(unit.area_sqm ?? type?.area_sqm) != null && <><dt>Area</dt><dd>{Math.round((unit.area_sqm ?? type?.area_sqm)!)} m²</dd></>}
        <dt>Status</dt><dd className={`status ${unit.status}`}>{unit.status}</dd>
      </dl>
      {!type?.glb_url && <p className="warn">No interior model uploaded for this unit type yet.</p>}
    </aside>
  );
}
