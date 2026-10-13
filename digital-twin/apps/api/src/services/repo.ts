import type { Floor, Hotspot, Project, ProjectBundle, Tower, Unit, UnitType, GenerateUnitsInput } from '@dt/shared-types';
import type { Db, Row } from '../db/types.js';

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Domain operations shared by the public and admin routes. Keeps routes thin and behaviour identical on both stores. */
export class Repo {
  constructor(public db: Db) {}

  async projectBySlug(slug: string): Promise<Project | null> {
    const [p] = await this.db.list('projects', { slug });
    return (p as Project) ?? null;
  }

  async bundle(project: Project): Promise<ProjectBundle> {
    const [towers, unit_types, hotspots] = await Promise.all([
      this.db.list('towers', { project_id: project.id }),
      this.db.list('unit_types', { project_id: project.id }),
      this.db.list('hotspots', { project_id: project.id }),
    ]);
    const perTower = await Promise.all(towers.map(async (t) => [await this.db.list('floors', { tower_id: t.id }), await this.db.list('units', { tower_id: t.id })] as const));
    return {
      project,
      towers: (towers as Tower[]).sort((a, b) => a.sort_order - b.sort_order),
      floors: perTower.flatMap(([f]) => f) as Floor[],
      unit_types: unit_types as UnitType[],
      units: perTower.flatMap(([, u]) => u) as Unit[],
      hotspots: hotspots as Hotspot[],
    };
  }

  async deleteProject(id: string) {
    const towers = await this.db.list('towers', { project_id: id });
    for (const t of towers) await this.deleteTower(t.id);
    await this.db.remove('hotspots', { project_id: id });
    await this.db.remove('unit_types', { project_id: id });
    await this.db.remove('analytics_events', { project_id: id });
    await this.db.remove('floorplan_analyses', { project_id: id });
    await this.db.remove('projects', { id });
  }

  async deleteTower(id: string) {
    await this.db.remove('units', { tower_id: id });
    await this.db.remove('floors', { tower_id: id });
    await this.db.remove('hotspots', { tower_id: id }); // tower-scoped markers go with the tower
    await this.db.remove('towers', { id });
  }

  /** Make the floors table match tower.floor_count / floor_height. Preserves existing rows (labels, per-floor GLBs). */
  async syncFloors(tower: Row) {
    const existing = await this.db.list('floors', { tower_id: tower.id });
    const have = new Set(existing.map((f) => f.floor_number as number));
    const add: Omit<Row, 'id'>[] = [];
    for (let n = 1; n <= tower.floor_count; n++)
      if (!have.has(n)) add.push({ tower_id: tower.id, floor_number: n, label: n === 1 ? 'Ground' : null, elevation: (n - 1) * tower.floor_height, glb_url: null });
    if (add.length) await this.db.insert('floors', add);
    for (const f of existing) {
      if (f.floor_number > tower.floor_count) {
        await this.db.remove('units', { tower_id: tower.id, floor_number: f.floor_number });
        await this.db.remove('floors', { id: f.id });
      }
    }
  }

  /** Re-derive elevation for floors that still use the default (n-1)*height when floor_height changes. */
  async rescaleElevations(tower: Row, oldHeight: number) {
    for (const f of await this.db.list('floors', { tower_id: tower.id })) {
      if (Math.abs(f.elevation - (f.floor_number - 1) * oldHeight) < 1e-6)
        await this.db.update('floors', f.id, { elevation: (f.floor_number - 1) * tower.floor_height });
    }
  }

  async generateUnits(tower: Row, input: GenerateUnitsInput): Promise<Row[]> {
    const to = Math.min(input.floor_to, tower.floor_count);
    if (input.floor_from > to) throw new HttpError(400, 'floor_from must be <= floor_to and within the tower floor count');
    const types = new Map((await this.db.list('unit_types', { project_id: tower.project_id })).map((t) => [t.id, t]));
    for (const s of input.slots) if (!types.has(s.unit_type_id)) throw new HttpError(400, `Unknown unit_type_id ${s.unit_type_id}`);
    if (input.replace) for (let n = input.floor_from; n <= to; n++) await this.db.remove('units', { tower_id: tower.id, floor_number: n });
    const existing = new Set((await this.db.list('units', { tower_id: tower.id })).map((u) => u.label));
    const rows: Omit<Row, 'id'>[] = [];
    for (let n = input.floor_from; n <= to; n++)
      for (const s of input.slots) {
        const label = `${n}${s.suffix}`;
        if (existing.has(label)) continue;
        rows.push({ tower_id: tower.id, floor_number: n, unit_type_id: s.unit_type_id, label, outline: s.outline, area_sqm: s.area_sqm ?? (types.get(s.unit_type_id)!.area_sqm ?? null), status: 'available' });
      }
    return rows.length ? this.db.insert('units', rows) : [];
  }
}
