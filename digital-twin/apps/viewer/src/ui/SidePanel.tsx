import { useMemo } from 'react';
import { assetUrl } from '../api';
import { selectors, useStore } from '../store';

/** Context directory: towers + amenities (site) → floor list (tower) → floor list + units (floor). */
export function SidePanel() {
  const s = useStore();
  const bundle = s.bundle!;
  const tower = selectors.tower(s);
  const floorUnits = useMemo(() => bundle.units.filter((u) => u.tower_id === s.towerId && u.floor_number === s.floorNumber), [bundle, s.towerId, s.floorNumber]);
  const unitCounts = useMemo(() => {
    const m = new Map<string, number>();
    bundle.units.forEach((u) => { if (u.tower_id === s.towerId) m.set(`${u.floor_number}`, (m.get(`${u.floor_number}`) ?? 0) + 1); });
    return m;
  }, [bundle, s.towerId]);
  const typeOf = (id: string) => bundle.unit_types.find((t) => t.id === id);

  if (s.level === 'unit') return null;

  if (s.level === 'site') {
    return (
      <aside className="panel" aria-label="Project directory">
        <h2>Towers</h2>
        <ul className="list">
          {bundle.towers.map((t) => (
            <li key={t.id}><button onClick={() => s.goTower(t.id)}><b>{t.name}</b><span>{t.floor_count} floors</span></button></li>
          ))}
        </ul>
        {bundle.hotspots.length > 0 && (
          <>
            <h2>Amenities</h2>
            <ul className="list">
              {bundle.hotspots.map((h) => (
                <li key={h.id}><button onClick={() => s.selectHotspot(h.id)}>{h.photo_url && <img src={assetUrl(h.photo_url)} alt="" loading="lazy" />}<b>{h.title}</b></button></li>
              ))}
            </ul>
          </>
        )}
      </aside>
    );
  }

  if (!tower) return null;
  const floors = bundle.floors.filter((f) => f.tower_id === tower.id).sort((a, b) => b.floor_number - a.floor_number);
  return (
    <aside className="panel" aria-label={`${tower.name} directory`}>
      <h2>{tower.name}</h2>
      {s.level === 'floor' && (
        <section aria-label={`Units on floor ${s.floorNumber}`} className="units">
          <h3>Floor {s.floorNumber} units</h3>
          <ul className="list">
            {floorUnits.length === 0 && <li className="empty">No units configured for this floor.</li>}
            {floorUnits.map((u) => (
              <li key={u.id}>
                <button onClick={() => s.goUnit(u.id)}>
                  <b>{u.label}</b><span>{typeOf(u.unit_type_id)?.code}{u.area_sqm ? ` · ${Math.round(u.area_sqm)} m²` : ''}</span>
                  {u.status !== 'available' && <em className={u.status}>{u.status}</em>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <h3>Floors <small>(↑ ↓)</small></h3>
      <ul className="list floors" role="listbox" aria-label="Floors">
        {floors.map((f) => (
          <li key={f.id}>
            <button role="option" aria-selected={s.floorNumber === f.floor_number} className={s.floorNumber === f.floor_number ? 'sel' : ''} onClick={() => s.goFloor(tower.id, f.floor_number)}>
              <b>{f.label && f.label !== 'Ground' ? f.label : f.floor_number}</b>
              <span>{f.label === 'Ground' ? 'Ground' : `${unitCounts.get(String(f.floor_number)) ?? 0} units`}</span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
