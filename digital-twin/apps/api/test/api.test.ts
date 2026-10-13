import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { FileDb } from '../src/db/fileDb.js';
import { createFloorPlanProvider } from '../src/floorplan/index.js';
import { LocalStorage } from '../src/storage/local.js';

const TOKEN = 'test-token-test-token-test-token';
let app: ReturnType<typeof createApp>;
let ids: { project: string; tower: string; ut: string };
const auth = { Authorization: `Bearer ${TOKEN}` };

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dt-'));
  const cfg = loadConfig({ ADMIN_API_TOKEN: TOKEN, STORAGE_DIR: dir, DATA_FILE: join(dir, 'db.json') } as NodeJS.ProcessEnv);
  const db = await FileDb.open(cfg.dataFile, cfg.seedFile);
  app = createApp(cfg, db, new LocalStorage(cfg.storageDir, cfg.publicApiUrl), createFloorPlanProvider(cfg));
});

describe('public API', () => {
  it('serves the published sample bundle', async () => {
    const res = await request(app).get('/api/public/projects/skyline-residences').expect(200);
    expect(res.body.towers).toHaveLength(2);
    expect(res.body.floors).toHaveLength(22);
    expect(res.body.units).toHaveLength(88);
    ids = { project: res.body.project.id, tower: res.body.towers[0].id, ut: res.body.unit_types[0].id };
  });
  it('404s unknown slugs', async () => { await request(app).get('/api/public/projects/nope').expect(404); });
  it('accepts analytics events and rejects junk', async () => {
    await request(app).post('/api/public/projects/skyline-residences/events').send({ type: 'view_start', session_id: 'abcdefgh12' }).expect(204);
    await request(app).post('/api/public/projects/skyline-residences/events').send({ type: 'hax', session_id: 'x' }).expect(400);
  });
});

describe('admin API', () => {
  it('requires the bearer token', async () => {
    await request(app).get('/api/admin/projects').expect(401);
    await request(app).get('/api/admin/projects').set('Authorization', 'Bearer wrong').expect(401);
    await request(app).get('/api/admin/projects').set(auth).expect(200);
  });
  it('creates a project, keeps it hidden until published, and enforces unique slugs', async () => {
    const mk = () => request(app).post('/api/admin/projects').set(auth).send({ slug: 'new-proj', name: 'New' });
    const created = await mk().expect(201);
    await mk().expect(409);
    await request(app).get('/api/public/projects/new-proj').expect(404);
    await request(app).patch(`/api/admin/projects/${created.body.id}`).set(auth).send({ is_published: true }).expect(200);
    await request(app).get('/api/public/projects/new-proj').expect(200);
    await request(app).delete(`/api/admin/projects/${created.body.id}`).set(auth).expect(204);
    await request(app).get('/api/public/projects/new-proj').expect(404);
  });
  it('syncs floors when floor_count changes and generates units', async () => {
    const t = await request(app).post(`/api/admin/projects/${ids.project}/towers`).set(auth).send({ name: 'Tower C', floor_count: 3 }).expect(201);
    let b = (await request(app).get(`/api/admin/projects/${ids.project}`).set(auth)).body;
    expect(b.floors.filter((f: any) => f.tower_id === t.body.id)).toHaveLength(3);
    const slot = { suffix: '01', unit_type_id: ids.ut, outline: [[0, 0], [5, 0], [5, 5]] };
    const gen = await request(app).post(`/api/admin/towers/${t.body.id}/units/generate`).set(auth).send({ floor_from: 1, floor_to: 9, slots: [slot] }).expect(201);
    expect(gen.body.created).toBe(3); // clamped to the 3 existing floors
    await request(app).patch(`/api/admin/towers/${t.body.id}`).set(auth).send({ floor_count: 2 }).expect(200);
    b = (await request(app).get(`/api/admin/projects/${ids.project}`).set(auth)).body;
    expect(b.floors.filter((f: any) => f.tower_id === t.body.id)).toHaveLength(2);
    expect(b.units.filter((u: any) => u.tower_id === t.body.id)).toHaveLength(2);
  });
  it('rejects non-GLB uploads', async () => {
    await request(app).post(`/api/admin/upload?kind=glb&project_id=${ids.project}`).set(auth).attach('file', Buffer.from('not a glb'), 'x.glb').expect(400);
  });
  it('returns analytics for recorded events', async () => {
    const res = await request(app).get(`/api/admin/projects/${ids.project}/analytics?days=7`).set(auth).expect(200);
    expect(res.body.total_views).toBe(1);
    expect(res.body.views_by_day).toHaveLength(7);
  });
  it('floor-plan assist returns a flagged mock', async () => {
    const res = await request(app).post('/api/admin/floorplan/analyze').set(auth).attach('file', Buffer.from('x'), 'plan.png').expect(201);
    expect(res.body.is_mock).toBe(true);
    expect(res.body.result.rooms.length).toBeGreaterThan(0);
  });
});
