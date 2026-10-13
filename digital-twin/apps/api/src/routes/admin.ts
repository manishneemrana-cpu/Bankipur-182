import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import {
  FloorPatch, GenerateUnitsInput, HotspotInput, HotspotPatch, ProjectInput, ProjectPatch,
  TowerInput, TowerPatch, UnitPatch, UnitTypeInput, UnitTypePatch,
} from '@dt/shared-types';
import { Router } from 'express';
import multer from 'multer';
import { rm } from 'node:fs/promises';
import { z } from 'zod';
import type { Deps } from '../app.js';
import { projectSummary } from '../services/analytics.js';
import { inspectGlb, sniffImage } from '../services/glb.js';
import { HttpError } from '../services/repo.js';
import { wrap } from '../util.js';

const uuid = z.string().uuid();
const idOf = (v: unknown) => uuid.parse(v);

export function adminRoutes({ repo, storage, floorplan }: Deps) {
  const r = Router();
  const db = repo.db;
  const need = async (table: Parameters<typeof db.get>[0], id: string, what: string) => {
    const row = await db.get(table, id);
    if (!row) throw new HttpError(404, `${what} not found`);
    return row;
  };

  /* ------------------------------------------------------------- projects */
  r.get('/projects', wrap(async (_req, res) => {
    const list = await db.list('projects');
    res.json(list.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))));
  }));
  r.post('/projects', wrap(async (req, res) => {
    const body = ProjectInput.parse(req.body);
    if (await repo.projectBySlug(body.slug)) throw new HttpError(409, 'Slug already in use');
    const [row] = await db.insert('projects', { location: '', description: null, cover_image_url: null, site_glb_url: null, site_lod_glb_url: null, model_scale: 1, is_published: false, ...body, created_at: new Date().toISOString() });
    res.status(201).json(row);
  }));
  r.get('/projects/:id', wrap(async (req, res) => {
    const p = await need('projects', idOf(req.params.id), 'Project');
    res.json(await repo.bundle(p as any));
  }));
  r.patch('/projects/:id', wrap(async (req, res) => {
    const id = idOf(req.params.id);
    const patch = ProjectPatch.parse(req.body);
    if (patch.slug) { const other = await repo.projectBySlug(patch.slug); if (other && other.id !== id) throw new HttpError(409, 'Slug already in use'); }
    const row = await db.update('projects', id, patch);
    if (!row) throw new HttpError(404, 'Project not found');
    res.json(row);
  }));
  r.delete('/projects/:id', wrap(async (req, res) => {
    const id = idOf(req.params.id);
    await need('projects', id, 'Project');
    await repo.deleteProject(id);
    res.status(204).end();
  }));

  /* --------------------------------------------------------------- towers */
  r.post('/projects/:id/towers', wrap(async (req, res) => {
    const pid = idOf(req.params.id);
    await need('projects', pid, 'Project');
    const body = TowerInput.parse(req.body);
    const [row] = await db.insert('towers', { floor_height: 3, floor_node_prefix: 'Floor_', footprint_w: 24, footprint_d: 14, position: [0, 0, 0], rotation_y: 0, sort_order: 0, glb_url: null, lod_glb_url: null, ...body, project_id: pid });
    await repo.syncFloors(row!);
    res.status(201).json(row);
  }));
  r.patch('/towers/:id', wrap(async (req, res) => {
    const id = idOf(req.params.id);
    const before = await need('towers', id, 'Tower');
    const patch = TowerPatch.parse(req.body);
    const row = (await db.update('towers', id, patch))!;
    if (patch.floor_height !== undefined && patch.floor_height !== before.floor_height) await repo.rescaleElevations(row, before.floor_height);
    if (patch.floor_count !== undefined) await repo.syncFloors(row);
    res.json(row);
  }));
  r.delete('/towers/:id', wrap(async (req, res) => {
    const id = idOf(req.params.id);
    await need('towers', id, 'Tower');
    await repo.deleteTower(id);
    res.status(204).end();
  }));

  r.patch('/floors/:id', wrap(async (req, res) => {
    const row = await db.update('floors', idOf(req.params.id), FloorPatch.parse(req.body));
    if (!row) throw new HttpError(404, 'Floor not found');
    res.json(row);
  }));

  /* ------------------------------------------------------------ unit types */
  r.post('/projects/:id/unit-types', wrap(async (req, res) => {
    const pid = idOf(req.params.id);
    await need('projects', pid, 'Project');
    const [row] = await db.insert('unit_types', { glb_url: null, area_sqm: null, bedrooms: 2, bathrooms: 2, rooms: [], spawn: [0, 1.6, 0], ...UnitTypeInput.parse(req.body), project_id: pid });
    res.status(201).json(row);
  }));
  r.patch('/unit-types/:id', wrap(async (req, res) => {
    const row = await db.update('unit_types', idOf(req.params.id), UnitTypePatch.parse(req.body));
    if (!row) throw new HttpError(404, 'Unit type not found');
    res.json(row);
  }));
  r.delete('/unit-types/:id', wrap(async (req, res) => {
    const id = idOf(req.params.id);
    const towers = await db.list('towers', { project_id: (await need('unit_types', id, 'Unit type')).project_id });
    for (const t of towers) if ((await db.list('units', { tower_id: t.id })).some((u) => u.unit_type_id === id)) throw new HttpError(409, 'Unit type is used by units – reassign or delete them first');
    await db.remove('unit_types', { id });
    res.status(204).end();
  }));

  /* ----------------------------------------------------------------- units */
  r.post('/towers/:id/units/generate', wrap(async (req, res) => {
    const tower = await need('towers', idOf(req.params.id), 'Tower');
    const created = await repo.generateUnits(tower, GenerateUnitsInput.parse(req.body));
    res.status(201).json({ created: created.length });
  }));
  r.patch('/units/:id', wrap(async (req, res) => {
    const row = await db.update('units', idOf(req.params.id), UnitPatch.parse(req.body));
    if (!row) throw new HttpError(404, 'Unit not found');
    res.json(row);
  }));
  r.delete('/units/:id', wrap(async (req, res) => {
    await db.remove('units', { id: idOf(req.params.id) });
    res.status(204).end();
  }));
  /** Tag many units at once: every unit whose label ends with `suffix` on the given floors gets `unit_type_id`. */
  r.post('/towers/:id/units/assign-type', wrap(async (req, res) => {
    const tower = await need('towers', idOf(req.params.id), 'Tower');
    const b = z.object({ unit_type_id: uuid, suffix: z.string().min(1), floor_from: z.number().int().min(1), floor_to: z.number().int().min(1) }).parse(req.body);
    const ut = await need('unit_types', b.unit_type_id, 'Unit type');
    if (ut.project_id !== tower.project_id) throw new HttpError(400, 'Unit type belongs to another project');
    let n = 0;
    for (const u of await db.list('units', { tower_id: tower.id }))
      if (u.floor_number >= b.floor_from && u.floor_number <= b.floor_to && String(u.label).endsWith(b.suffix)) { await db.update('units', u.id, { unit_type_id: ut.id }); n++; }
    res.json({ updated: n });
  }));

  /* -------------------------------------------------------------- hotspots */
  r.post('/projects/:id/hotspots', wrap(async (req, res) => {
    const pid = idOf(req.params.id);
    await need('projects', pid, 'Project');
    const [row] = await db.insert('hotspots', { tower_id: null, description: '', photo_url: null, category: 'other', ...HotspotInput.parse(req.body), project_id: pid });
    res.status(201).json(row);
  }));
  r.patch('/hotspots/:id', wrap(async (req, res) => {
    const row = await db.update('hotspots', idOf(req.params.id), HotspotPatch.parse(req.body));
    if (!row) throw new HttpError(404, 'Hotspot not found');
    res.json(row);
  }));
  r.delete('/hotspots/:id', wrap(async (req, res) => {
    await db.remove('hotspots', { id: idOf(req.params.id) });
    res.status(204).end();
  }));

  /* --------------------------------------------------------------- uploads */
  const upload = multer({ dest: tmpdir(), limits: { fileSize: 300 * 1024 * 1024, files: 1 } });
  r.post('/upload', upload.single('file'), wrap(async (req, res) => {
    const file = req.file;
    if (!file) throw new HttpError(400, 'No file (multipart field "file")');
    try {
      const kind = z.enum(['glb', 'image']).parse(req.query.kind);
      const folder = req.query.project_id ? idOf(req.query.project_id) : 'misc';
      const warnings: string[] = [];
      let ext: string, type: string, glb: Awaited<ReturnType<typeof inspectGlb>> | undefined;
      if (kind === 'glb') {
        glb = await inspectGlb(file.path);
        if (!glb.valid) throw new HttpError(400, glb.error ?? 'Invalid GLB');
        if (!glb.draco) warnings.push('This GLB is not Draco-compressed. Run `npm run optimize -- <file>` to shrink it before publishing (target first view < 5 s).');
        ext = 'glb'; type = 'model/gltf-binary';
      } else {
        if (file.size > 15 * 1024 * 1024) throw new HttpError(413, 'Images are limited to 15 MB');
        const img = await sniffImage(file.path);
        if (!img) throw new HttpError(400, 'Only JPEG, PNG or WebP images are accepted');
        ext = img.ext; type = img.type;
      }
      const stored = await storage.save(file.path, `${folder}/${randomUUID()}.${ext}`, type);
      res.status(201).json({ ...stored, kind, draco: glb?.draco ?? null, floor_nodes: glb?.floorNodes ?? null, warnings });
    } finally {
      await rm(file.path, { force: true }); // no-op if storage already moved it
    }
  }));

  /* ------------------------------------------------------------- analytics */
  r.get('/projects/:id/analytics', wrap(async (req, res) => {
    const id = idOf(req.params.id);
    await need('projects', id, 'Project');
    const days = z.coerce.number().int().min(1).max(365).default(30).parse(req.query.days);
    res.json(await projectSummary(db, id, days));
  }));

  /* ------------------------------------------- floor-plan assist (optional) */
  const planUpload = multer({ dest: tmpdir(), limits: { fileSize: 15 * 1024 * 1024, files: 1 } });
  r.post('/floorplan/analyze', planUpload.single('file'), wrap(async (req, res) => {
    const file = req.file;
    if (!file) throw new HttpError(400, 'No file (multipart field "file")');
    try {
      const projectId = req.body?.project_id ? idOf(req.body.project_id) : null;
      const result = await floorplan.analyze({ filePath: file.path, fileName: file.originalname });
      const [row] = await db.insert('floorplan_analyses', { project_id: projectId, provider: result.provider, is_mock: result.is_mock, result });
      res.status(201).json(row);
    } finally { await rm(file.path, { force: true }); }
  }));
  r.get('/projects/:id/floorplan-analyses', wrap(async (req, res) => {
    res.json(await db.list('floorplan_analyses', { project_id: idOf(req.params.id) }));
  }));

  return r;
}
