import type { Floor, Hotspot, ProjectBundle, Tower, Unit, Vec3 } from '@dt/shared-types';
import { create } from 'zustand';
import { track } from './api';
import { type CamGoal, type GoalSpec, type Box, exteriorGoal, floorGoal, hotspotGoal, interiorGoal, planGoal, towerGoal } from './lib/presets';

export type Level = 'site' | 'tower' | 'floor' | 'unit';
export type PresetName = 'exterior' | 'floor-plan' | 'interior';
export interface Measurement { a: Vec3; b: Vec3 }

interface State {
  bundle: ProjectBundle | null;
  level: Level;
  towerId: string | null;
  floorNumber: number | null;
  unitId: string | null;
  /** floor level shown top-down (plan) vs angled cutaway */
  plan: boolean;
  night: boolean;
  furnished: boolean;
  walk: boolean;
  measuring: boolean;
  pending: Vec3 | null;
  measurements: Measurement[];
  hotspotId: string | null;
  hoverUnit: string | null;
  goal: CamGoal | null;
  interiorBox: Box | null;
  fade: boolean;
  helpOpen: boolean;

  load(b: ProjectBundle): void;
  goExterior(): void;
  goTower(id: string): void;
  goFloor(towerId: string, n: number, plan?: boolean): void;
  goUnit(unitId: string): void;
  up(): void;
  preset(p: PresetName): void;
  stepFloor(d: 1 | -1): void;
  flyTo(spec: GoalSpec): void;
  interiorLoaded(box: Box): void;
  selectHotspot(id: string | null): void;
  toggleNight(): void;
  toggleFurnished(): void;
  toggleWalk(): void;
  toggleMeasure(): void;
  addMeasurePoint(p: Vec3): void;
  clearMeasure(): void;
  setHelp(v: boolean): void;
  setHoverUnit(id: string | null): void;
}

let goalKey = 0;
const mk = (spec: GoalSpec): CamGoal => ({ ...spec, key: ++goalKey });
const aspect = () => (typeof window === 'undefined' ? 16 / 9 : window.innerWidth / Math.max(1, window.innerHeight));

export const selectors = {
  tower: (s: State): Tower | undefined => s.bundle?.towers.find((t) => t.id === s.towerId),
  floor: (s: State): Floor | undefined => s.bundle?.floors.find((f) => f.tower_id === s.towerId && f.floor_number === s.floorNumber),
  unit: (s: State): Unit | undefined => s.bundle?.units.find((u) => u.id === s.unitId),
};

export const useStore = create<State>((set, get) => {
  const floorOf = (towerId: string, n: number) => get().bundle?.floors.find((f) => f.tower_id === towerId && f.floor_number === n);
  const towerOf = (id: string) => get().bundle?.towers.find((t) => t.id === id);

  return {
    bundle: null, level: 'site', towerId: null, floorNumber: null, unitId: null, plan: false, night: false,
    furnished: true, walk: false, measuring: false, pending: null, measurements: [], hotspotId: null, hoverUnit: null,
    goal: null, interiorBox: null, fade: false, helpOpen: false,

    load(b) {
      set({ bundle: b, level: 'site', towerId: null, floorNumber: null, unitId: null, goal: mk({ ...exteriorGoal(b.towers), instant: true }) });
      track({ type: 'view_start' });
    },

    goExterior() {
      const b = get().bundle; if (!b) return;
      set({ level: 'site', towerId: null, floorNumber: null, unitId: null, plan: false, walk: false, hotspotId: null, pending: null, measurements: [], goal: mk(exteriorGoal(b.towers)) });
      track({ type: 'preset', meta: 'exterior' });
    },

    goTower(id) {
      const t = towerOf(id); if (!t) return;
      set({ level: 'tower', towerId: id, floorNumber: null, unitId: null, plan: false, walk: false, hotspotId: null, pending: null, goal: mk(towerGoal(t)) });
      track({ type: 'tower_view', tower_id: id });
    },

    goFloor(towerId, n, plan = get().plan) {
      const t = towerOf(towerId), f = floorOf(towerId, n); if (!t || !f) return;
      set({ level: 'floor', towerId, floorNumber: n, unitId: null, plan, walk: false, hotspotId: null, pending: null, goal: mk(plan ? planGoal(t, f, aspect()) : floorGoal(t, f)) });
      track({ type: 'floor_view', tower_id: towerId, floor_number: n });
    },

    goUnit(unitId) {
      const s = get();
      const u = s.bundle?.units.find((x) => x.id === unitId); if (!u) return;
      set({ fade: true });
      setTimeout(() => {
        set({ level: 'unit', towerId: u.tower_id, floorNumber: u.floor_number, unitId, walk: false, hotspotId: null, pending: null, measurements: [], measuring: false });
        setTimeout(() => set({ fade: false }), 350);
      }, 280);
      track({ type: 'unit_view', unit_id: unitId, tower_id: u.tower_id, floor_number: u.floor_number });
    },

    up() {
      const { level, towerId, floorNumber } = get();
      if (get().hotspotId) return set({ hotspotId: null });
      if (get().measuring) return set({ measuring: false, pending: null });
      if (level === 'unit') {
        set({ fade: true });
        setTimeout(() => { get().goFloor(towerId!, floorNumber!, false); setTimeout(() => set({ fade: false }), 350); }, 280);
      } else if (level === 'floor') get().goTower(towerId!);
      else if (level === 'tower') get().goExterior();
    },

    preset(p) {
      const s = get(), b = s.bundle; if (!b || !b.towers.length) return;
      if (p === 'exterior') return s.goExterior();
      const tower = selectors.tower(s) ?? b.towers[0]!;
      if (p === 'floor-plan') {
        const n = s.floorNumber ?? Math.max(1, Math.ceil(tower.floor_count / 2));
        s.goFloor(tower.id, n, true);
        track({ type: 'preset', meta: 'floor-plan' });
        return;
      }
      // interior: current unit → a unit on the current floor → the middle floor of the current/first tower
      const n = s.floorNumber ?? Math.max(1, Math.ceil(tower.floor_count / 2));
      const candidate = s.unitId ? s.unitId : (b.units.find((u) => u.tower_id === tower.id && u.floor_number === n && u.unit_type_id && b.unit_types.find((t) => t.id === u.unit_type_id)?.glb_url) ?? b.units.find((u) => u.tower_id === tower.id && b.unit_types.find((t) => t.id === u.unit_type_id)?.glb_url))?.id;
      if (candidate) s.goUnit(candidate);
      track({ type: 'preset', meta: 'interior' });
    },

    stepFloor(d) {
      const s = get(); const t = selectors.tower(s); if (!t || s.level === 'site' || s.level === 'unit') return;
      const n = Math.min(t.floor_count, Math.max(1, (s.floorNumber ?? (d > 0 ? 0 : t.floor_count + 1)) + d));
      s.goFloor(t.id, n);
    },

    flyTo(spec) { set({ goal: mk(spec) }); },
    interiorLoaded(box) { if (get().level === 'unit') set({ interiorBox: box, goal: mk({ ...interiorGoal(box), instant: true }) }); },

    selectHotspot(id) {
      const h = id ? get().bundle?.hotspots.find((x) => x.id === id) : undefined;
      if (h) {
        set({ hotspotId: id, goal: mk(hotspotGoal(h.position)) });
        track({ type: 'hotspot_click', hotspot_id: h.id, tower_id: h.tower_id });
      } else set({ hotspotId: null });
    },

    toggleNight() { set((s) => ({ night: !s.night })); },
    toggleFurnished() { set((s) => ({ furnished: !s.furnished })); },
    toggleWalk() {
      const s = get();
      if (s.level !== 'unit') return;
      // Leaving walk mode: fly back out to the dollhouse view (the orbit target is stale after walking).
      if (s.walk && s.interiorBox) set({ walk: false, goal: mk({ ...interiorGoal(s.interiorBox), instant: true }) });
      else set({ walk: !s.walk });
    },
    toggleMeasure() { set((s) => ({ measuring: !s.measuring, pending: null, hotspotId: null })); },
    addMeasurePoint(p) {
      const { pending } = get();
      if (!pending) return set({ pending: p });
      set((s) => ({ measurements: [...s.measurements, { a: pending, b: p }], pending: null }));
      track({ type: 'measure' });
    },
    clearMeasure() { set({ measurements: [], pending: null }); },
    setHelp(v) { set({ helpOpen: v }); },
    setHoverUnit(id) { if (get().hoverUnit !== id) set({ hoverUnit: id }); },
  };
});
