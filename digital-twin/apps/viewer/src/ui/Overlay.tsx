import type { Hotspot, Vec3 } from '@dt/shared-types';
import { formatDistance, measureDistance } from '../lib/measure';
import { towerHeight, towerToWorld } from '../lib/presets';
import { selectors, useStore } from '../store';
import { Anchored } from './Anchored';

const ICON: Record<Hotspot['category'], string> = { pool: '🏊', clubhouse: '🏛', garden: '🌳', gym: '🏋', parking: '🅿', play: '🛝', other: '📍' };

/** All in-scene labels as real DOM (accessible, focusable, TV-remote friendly). Positions come from <AnchorProjector>. */
export function Overlay() {
  const level = useStore((s) => s.level);
  return (
    <div className="labels">
      {level === 'site' && <TowerMarkers />}
      {(level === 'site' || level === 'tower') && <HotspotPins />}
      {level === 'floor' && <UnitLabels />}
      {level === 'unit' && <RoomLabels />}
      <MeasureLabels />
    </div>
  );
}

function TowerMarkers() {
  const towers = useStore((s) => s.bundle!.towers);
  const goTower = useStore((s) => s.goTower);
  return <>{towers.map((t) => (
    <Anchored key={t.id} id={`tower-${t.id}`} position={[t.position[0], t.position[1] + towerHeight(t) + 3, t.position[2]]}>
      <button className="tower-marker" onClick={() => goTower(t.id)} aria-label={`Open ${t.name}`}><b>{t.name}</b><span>{t.floor_count} floors</span></button>
    </Anchored>
  ))}</>;
}

function HotspotPins() {
  const towerId = useStore((s) => s.towerId);
  const level = useStore((s) => s.level);
  const hotspots = useStore((s) => s.bundle!.hotspots);
  const active = useStore((s) => s.hotspotId);
  const select = useStore((s) => s.selectHotspot);
  return <>{hotspots.filter((h) => level === 'site' || !h.tower_id || h.tower_id === towerId).map((h) => (
    <Anchored key={h.id} id={`hs-${h.id}`} position={h.position}>
      <button className={`pin${active === h.id ? ' active' : ''}`} onClick={() => select(h.id)} aria-label={`${h.title} – open details`}>
        <span className="pin-icon" aria-hidden>{ICON[h.category]}</span><span className="pin-label">{h.title}</span>
      </button>
    </Anchored>
  ))}</>;
}

function UnitLabels() {
  const bundle = useStore((s) => s.bundle)!;
  const tower = useStore(selectors.tower);
  const floor = useStore(selectors.floor);
  const hover = useStore((s) => s.hoverUnit);
  const set = useStore((s) => s.setHoverUnit);
  const goUnit = useStore((s) => s.goUnit);
  if (!tower || !floor) return null;
  return <>{bundle.units.filter((u) => u.tower_id === tower.id && u.floor_number === floor.floor_number).map((u) => {
    const cx = u.outline.reduce((a, p) => a + p[0], 0) / u.outline.length, cz = u.outline.reduce((a, p) => a + p[1], 0) / u.outline.length;
    const ut = bundle.unit_types.find((t) => t.id === u.unit_type_id);
    return (
      <Anchored key={u.id} id={`unit-${u.id}`} position={towerToWorld(tower, [cx, floor.elevation + 0.9, cz])}>
        <button className={`unit-label${u.status === 'sold' ? ' sold' : ''}${hover === u.id ? ' hot' : ''}`} onClick={() => goUnit(u.id)}
          onPointerEnter={() => set(u.id)} onPointerLeave={() => set(null)} onFocus={() => set(u.id)} onBlur={() => set(null)}>
          <b>{u.label}</b><span>{ut?.code ?? '?'}{u.area_sqm ? ` · ${Math.round(u.area_sqm)} m²` : ''}</span>{u.status !== 'available' && <em>{u.status}</em>}
        </button>
      </Anchored>
    );
  })}</>;
}

function RoomLabels() {
  const rooms = useStore((s) => s.bundle!.unit_types.find((t) => t.id === selectors.unit(s)?.unit_type_id)?.rooms ?? []);
  const walk = useStore((s) => s.walk);
  if (walk) return null;
  return <>{rooms.map((r) => (
    <Anchored key={r.name} id={`room-${r.name}`} position={r.position}>
      <div className="room-label"><b>{r.name}</b>{r.area_sqm ? <span>{r.area_sqm} m²</span> : null}</div>
    </Anchored>
  ))}</>;
}

function MeasureLabels() {
  const list = useStore((s) => s.measurements);
  const scale = useStore((s) => s.bundle!.project.model_scale);
  return <>{list.map((m, i) => {
    const mid: Vec3 = [(m.a[0] + m.b[0]) / 2, (m.a[1] + m.b[1]) / 2 + 0.3, (m.a[2] + m.b[2]) / 2];
    return <Anchored key={i} id={`measure-${i}`} position={mid}><div className="measure-label">{formatDistance(measureDistance(m.a, m.b, scale))}</div></Anchored>;
  })}</>;
}
