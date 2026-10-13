// Generates a self-contained SAMPLE project (procedural, no downloads): Draco-compressed GLBs + seed JSON.
// Output: apps/api/storage/sample/*  and  apps/api/seed/sample-project.json
// The geometry is deliberately simple. It follows the same naming conventions a real artist export must follow
// (see README → "GLB conventions"), so it exercises every viewer feature.
import { createHash } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Builder, makeIO, dracoCompress, writeGlb } from './glb-lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'api');
const outDir = join(root, 'storage', 'sample');
const io = await makeIO();

const uuid = (key) => {
  const h = createHash('sha1').update('dt-sample:' + key).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const save = async (b, file) => {
  await dracoCompress(b.doc);
  const n = await writeGlb(io, b.doc, join(outDir, file));
  console.log(`${file.padEnd(22)} ${(n / 1024).toFixed(1)} KB`);
};

const C = {
  concrete: [0.84, 0.82, 0.78], dark: [0.35, 0.36, 0.4], glass: [0.32, 0.5, 0.7], roof: [0.5, 0.5, 0.52],
  grass: [0.33, 0.52, 0.28], road: [0.22, 0.22, 0.24], water: [0.2, 0.55, 0.8], deck: [0.75, 0.7, 0.62],
  trunk: [0.4, 0.28, 0.18], leaf: [0.2, 0.45, 0.22], wood: [0.62, 0.45, 0.3], fabric: [0.3, 0.42, 0.55],
  wall: [0.93, 0.92, 0.9], lodBody: [0.62, 0.7, 0.78],
};

/* ------------------------------------------------------------------ towers */
const FW = 24, FD = 14, H = 3;

async function tower(floors, file) {
  const b = new Builder();
  const mConcrete = b.material('Concrete', C.concrete), mGlass = b.material('Window_Glass', C.glass, { rough: 0.15, metal: 0.3 });
  const mDark = b.material('Core', C.dark), mRoof = b.material('Roof', C.roof);
  const root = b.group('Tower'); b.scene.addChild(root);
  for (let n = 1; n <= floors; n++) {
    const f = b.group(`Floor_${String(n).padStart(2, '0')}`, [0, (n - 1) * H, 0]); root.addChild(f);
    f.addChild(b.box('Slab', [FW, 0.25, FD], [0, 0.125, 0], mConcrete));
    // Shell: ribbon-window facade; hidden when this floor is cut away.
    const shell = b.group('Shell'); f.addChild(shell);
    const strips = [[0.9, 0.475 + 0.0, mConcrete], [1.6, 0.25 + 0.9 + 0.8, mGlass], [0.5, 0.25 + 2.5 + 0.0, mConcrete]];
    // heights: lower sill 0.9 (y .25-1.15), glass 1.2 (1.15-2.35), upper band .65 (2.35-3.0)
    const bands = [[0.9, 0.25 + 0.45, mConcrete], [1.2, 1.15 + 0.6, mGlass], [0.65, 2.35 + 0.325, mConcrete]];
    for (const [h, y, m] of bands) {
      shell.addChild(b.box('FacadeN', [FW, h, 0.3], [0, y, -FD / 2 + 0.15], m));
      shell.addChild(b.box('FacadeS', [FW, h, 0.3], [0, y, FD / 2 - 0.15], m));
      shell.addChild(b.box('FacadeW', [0.3, h, FD - 0.6], [-FW / 2 + 0.15, y, 0], m));
      shell.addChild(b.box('FacadeE', [0.3, h, FD - 0.6], [FW / 2 - 0.15, y, 0], m));
    }
    // Partitions: low walls that stay visible in the floor cutaway so the layout reads.
    const part = b.group('Partitions'); f.addChild(part);
    part.addChild(b.box('Core', [6, 1.1, FD - 0.6], [0, 0.8, 0], mDark));
    part.addChild(b.box('DividerL', [9, 1.1, 0.15], [-7.5, 0.8, 1], mConcrete));
    part.addChild(b.box('DividerR', [9, 1.1, 0.15], [7.5, 0.8, 1], mConcrete));
  }
  root.addChild(b.box('Roof', [FW + 0.6, 0.4, FD + 0.6], [0, floors * H + 0.2, 0], mRoof));
  await save(b, file);
}

async function towerLod(floors, file) {
  const b = new Builder();
  const body = b.material('LOD_Window_Body', C.lodBody, { rough: 0.5 }), roof = b.material('Roof', C.roof);
  const g = b.group('Tower_LOD'); b.scene.addChild(g);
  g.addChild(b.box('Body', [FW, floors * H, FD], [0, (floors * H) / 2, 0], body));
  g.addChild(b.box('Roof', [FW + 0.6, 0.4, FD + 0.6], [0, floors * H + 0.2, 0], roof));
  await save(b, file);
}

/* -------------------------------------------------------------------- site */
async function site(file, withTrees) {
  const b = new Builder();
  const grass = b.material('Grass', C.grass), road = b.material('Road', C.road), water = b.material('Water', C.water, { rough: 0.05, metal: 0.2 });
  const deck = b.material('Deck', C.deck), concrete = b.material('Concrete', C.concrete), glass = b.material('Window_Glass', C.glass, { rough: 0.15 });
  const roof = b.material('Roof', C.roof), trunk = b.material('Trunk', C.trunk), leaf = b.material('Leaf', C.leaf);
  const g = b.group('Site'); b.scene.addChild(g);
  g.addChild(b.box('Ground', [240, 0.4, 240], [0, -0.2, 0], grass));
  g.addChild(b.box('Road_Main', [8, 0.05, 240], [0, 0.03, 20], road));
  g.addChild(b.box('Road_Cross', [240, 0.05, 8], [0, 0.03, 20], road));
  const pool = b.group('Amenity_Pool', [0, 0, -38]); g.addChild(pool);
  pool.addChild(b.box('Deck', [26, 0.2, 16], [0, 0.1, 0], deck));
  pool.addChild(b.box('Water', [20, 0.1, 10], [0, 0.22, 0], water));
  const club = b.group('Amenity_Clubhouse', [0, 0, 48]); g.addChild(club);
  club.addChild(b.box('Body', [22, 6, 12], [0, 3, 0], concrete));
  club.addChild(b.box('Glazing', [18, 3, 0.3], [0, 2.6, -6.1], glass));
  club.addChild(b.box('Roof', [23, 0.5, 13], [0, 6.25, 0], roof));
  const park = b.group('Amenity_Parking', [58, 0, -38]); g.addChild(park);
  park.addChild(b.box('Slab', [26, 0.05, 18], [0, 0.03, 0], road));
  if (withTrees) {
    const garden = b.group('Amenity_Garden', [-62, 0, -34]); g.addChild(garden);
    garden.addChild(b.box('Lawn', [30, 0.1, 24], [0, 0.05, 0], b.material('Lawn', [0.42, 0.62, 0.34])));
    for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) {
      const t = b.group('Tree', [-12 + i * 6, 0, -9 + j * 6]); garden.addChild(t);
      t.addChild(b.box('Trunk', [0.4, 3, 0.4], [0, 1.5, 0], trunk));
      t.addChild(b.box('Crown', [3, 3, 3], [0, 4, 0], leaf));
    }
    for (let k = 0; k < 14; k++) { // street trees
      const t = b.group('Tree', [-100 + k * 15, 0, 28]); g.addChild(t);
      t.addChild(b.box('Trunk', [0.4, 3, 0.4], [0, 1.5, 0], trunk));
      t.addChild(b.box('Crown', [3, 3, 3], [0, 4, 0], leaf));
    }
  } else {
    g.addChild(b.box('Amenity_Garden', [30, 0.1, 24], [-62, 0.05, -34], b.material('Lawn', [0.42, 0.62, 0.34])));
  }
  await save(b, file);
}

/* ---------------------------------------------------------------- interiors */
const T = 0.12, WH = 2.8;
function wallsX(b, parent, mat, z, x0, x1, gaps = [], name = 'Wall') { // wall running along X at fixed z
  let a = x0;
  for (const [g0, g1] of [...gaps].sort((p, q) => p[0] - q[0]).concat([[x1, x1]])) {
    if (g0 > a + 0.01) parent.addChild(b.box(name, [g0 - a, WH, T], [(a + g0) / 2, WH / 2, z], mat));
    a = g1;
  }
}
function wallsZ(b, parent, mat, x, z0, z1, gaps = [], name = 'Wall') {
  let a = z0;
  for (const [g0, g1] of [...gaps].sort((p, q) => p[0] - q[0]).concat([[z1, z1]])) {
    if (g0 > a + 0.01) parent.addChild(b.box(name, [T, WH, g0 - a], [x, WH / 2, (a + g0) / 2], mat));
    a = g1;
  }
}

async function unit(kind, file) {
  const b = new Builder();
  const wall = b.material('Wall', C.wall), wood = b.material('Wood', C.wood), fabric = b.material('Fabric', C.fabric), dark = b.material('Dark', C.dark);
  const root = b.group('Unit'); b.scene.addChild(root);
  const d = kind === '3BHK' ? 4 : 3; // half-depth
  root.addChild(b.box('Floor_Interior', [9, 0.1, d * 2], [0, -0.05, 0], wood));
  root.addChild(b.box('Ceiling', [9.2, 0.1, d * 2 + 0.2], [0, WH + 0.05, 0], wall));
  wallsX(b, root, wall, -d, -4.5, 4.5, [[-3.5, -2.6]], 'Wall_N');
  wallsX(b, root, wall, d, -4.5, 4.5, [], 'Wall_S');
  wallsZ(b, root, wall, -4.5, -d, d, [], 'Wall_W');
  wallsZ(b, root, wall, 4.5, -d, d, [], 'Wall_E');
  const F = (name, size, pos, m) => root.addChild(b.box(`Furniture_${name}`, size, pos, m));
  if (kind === '3BHK') {
    wallsZ(b, root, wall, 0.5, -4, 4, [[-3.3, -2.4]], 'Wall_Mid');
    wallsX(b, root, wall, 0, -4.5, 0.5, [[-2.5, -1.6]], 'Wall_LivingMaster');
    wallsX(b, root, wall, 2, -4.5, -2.5, [], 'Wall_Bath');
    wallsZ(b, root, wall, -2.5, 2, 4, [[2.4, 3.3]], 'Wall_Bath');
    wallsX(b, root, wall, -1.5, 0.5, 4.5, [[2.0, 2.9]].map(([a, c]) => [a + 0.5, c + 0.5]), 'Wall_KitchenBR2');
    wallsX(b, root, wall, 1, 0.5, 4.5, [[2.5, 3.4]], 'Wall_BR2BR3');
    F('Sofa', [2.2, 0.8, 0.9], [-2.5, 0.4, -3.3], fabric); F('TVUnit', [0.3, 1, 1.6], [-4.3, 0.5, -2], dark);
    F('DiningTable', [1.5, 0.75, 0.9], [-1.8, 0.38, -1], wood);
    F('MasterBed', [1.8, 0.6, 2], [-0.9, 0.3, 2.2], fabric); F('MasterWardrobe', [2, 2, 0.5], [-3.5, 1, 0.4], wood);
    F('KitchenCounter', [0.6, 0.9, 2.2], [4.1, 0.45, -2.8], dark);
    F('Bed2', [2, 0.6, 1.5], [3.2, 0.3, -0.3], fabric); F('Wardrobe2', [0.5, 2, 1], [4.2, 1, 0.55], wood);
    F('Bed3', [2, 0.6, 1.4], [3, 0.3, 2.6], fabric); F('Desk3', [0.7, 0.75, 0.6], [4.1, 0.38, 3.6], wood);
  } else {
    wallsZ(b, root, wall, 0.5, -3, 3, [[-2.3, -1.4]], 'Wall_Mid');
    wallsX(b, root, wall, 0.5, -4.5, 0.5, [[-2.5, -1.6]], 'Wall_LivingMaster');
    wallsX(b, root, wall, 1.5, -4.5, -2.5, [], 'Wall_Bath');
    wallsZ(b, root, wall, -2.5, 1.5, 3, [[1.7, 2.6]], 'Wall_Bath');
    wallsX(b, root, wall, -1, 0.5, 4.5, [[2, 2.9]], 'Wall_KitchenBR2');
    F('Sofa', [2.2, 0.8, 0.9], [-2.5, 0.4, -2.4], fabric); F('TVUnit', [0.3, 1, 1.6], [-4.3, 0.5, -1.2], dark);
    F('DiningTable', [1.5, 0.75, 0.9], [-1.2, 0.38, -0.3], wood);
    F('MasterBed', [1.8, 0.6, 2], [-0.4, 0.3, 1.8], fabric); F('MasterWardrobe', [1.6, 2, 0.5], [-3.6, 1, 0.8], wood);
    F('KitchenCounter', [0.6, 0.9, 2], [4.1, 0.45, -2], dark);
    F('Bed2', [2, 0.6, 1.5], [3.2, 0.3, 1.2], fabric); F('Wardrobe2', [0.5, 2, 1], [4.2, 1, -0.4], wood);
  }
  await save(b, file);
}

/* ---------------------------------------------------------------- SVG photos */
const svg = (title, c1, c2) => `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="960" height="540" fill="url(#g)"/><text x="480" y="270" font-family="sans-serif" font-size="56" fill="#fff" text-anchor="middle" font-weight="700">${title}</text><text x="480" y="320" font-family="sans-serif" font-size="24" fill="#ffffffcc" text-anchor="middle">Sample placeholder photo - replace in Admin</text></svg>`;
await mkdir(outDir, { recursive: true });
for (const [n, t, a, b2] of [['cover', 'Skyline Residences', '#1f3a5f', '#4f8fc0'], ['pool', 'Infinity Pool', '#0b6fa4', '#6fd0e8'], ['clubhouse', 'Clubhouse', '#6b4f3a', '#d9a066'], ['garden', 'Central Garden', '#2f6b3a', '#9ed17b']])
  await writeFile(join(outDir, `${n}.svg`), svg(t, a, b2));

/* -------------------------------------------------------------------- run */
await site('site.glb', true); await site('site.lod.glb', false);
await tower(12, 'tower-a.glb'); await towerLod(12, 'tower-a.lod.glb');
await tower(10, 'tower-b.glb'); await towerLod(10, 'tower-b.lod.glb');
await unit('2BHK', 'unit-2bhk.glb'); await unit('3BHK', 'unit-3bhk.glb');

/* --------------------------------------------------------------- seed json */
const U = (p) => `/files/sample/${p}`;
const pid = uuid('project');
const ut2 = uuid('ut2'), ut3 = uuid('ut3');
const towers = [
  { id: uuid('ta'), project_id: pid, name: 'Tower A', glb_url: U('tower-a.glb'), lod_glb_url: U('tower-a.lod.glb'), floor_count: 12, floor_height: H, floor_node_prefix: 'Floor_', footprint_w: FW, footprint_d: FD, position: [-34, 0, 4], rotation_y: 0, sort_order: 0 },
  { id: uuid('tb'), project_id: pid, name: 'Tower B', glb_url: U('tower-b.glb'), lod_glb_url: U('tower-b.lod.glb'), floor_count: 10, floor_height: H, floor_node_prefix: 'Floor_', footprint_w: FW, footprint_d: FD, position: [34, 0, 4], rotation_y: 0, sort_order: 1 },
];
const slots = [['01', ut3, -12, -7, -3, 1, 72], ['02', ut2, -12, 1, -3, 7, 54], ['03', ut3, 3, -7, 12, 1, 72], ['04', ut2, 3, 1, 12, 7, 54]];
const floors = [], units = [];
for (const t of towers) for (let n = 1; n <= t.floor_count; n++) {
  floors.push({ id: uuid(`f-${t.name}-${n}`), tower_id: t.id, floor_number: n, label: n === 1 ? 'Ground' : null, elevation: (n - 1) * H, glb_url: null });
  for (const [sfx, ut, x0, z0, x1, z1, area] of slots) {
    const e = 0.15;
    units.push({ id: uuid(`u-${t.name}-${n}-${sfx}`), tower_id: t.id, floor_number: n, unit_type_id: ut, label: `${n}${sfx}`,
      outline: [[x0 + e, z0 + e], [x1 - e, z0 + e], [x1 - e, z1 - e], [x0 + e, z1 - e]], area_sqm: area, status: (n * 7 + Number(sfx)) % 9 === 0 ? 'sold' : 'available' });
  }
}
const seed = {
  projects: [{ id: pid, slug: 'skyline-residences', name: 'Skyline Residences', location: 'Sample City (demo data)', description: 'Procedurally generated demo project that ships with the repo. Replace it with a real artist-built GLB set via the admin panel.',
    cover_image_url: U('cover.svg'), site_glb_url: U('site.glb'), site_lod_glb_url: U('site.lod.glb'), model_scale: 1, is_published: true, created_at: '2026-01-01T00:00:00.000Z' }],
  towers, floors,
  unit_types: [
    { id: ut2, project_id: pid, code: '2BHK', name: '2 BHK Apartment', glb_url: U('unit-2bhk.glb'), area_sqm: 54, bedrooms: 2, bathrooms: 2, spawn: [-3.05, 1.6, -2.4],
      rooms: [['Living & Dining', -2, -1.25, 16.5], ['Master Bedroom', -0.9, 1.9, 7.5], ['Bathroom', -3.5, 2.3, 3], ['Kitchen', 2.5, -2, 8], ['Bedroom 2', 2.5, 1, 16]].map(([name, x, z, a]) => ({ name, position: [x, 2.1, z], area_sqm: a })) },
    { id: ut3, project_id: pid, code: '3BHK', name: '3 BHK Apartment', glb_url: U('unit-3bhk.glb'), area_sqm: 72, bedrooms: 3, bathrooms: 2, spawn: [-3.05, 1.6, -3.2],
      rooms: [['Living & Dining', -2, -2, 20], ['Master Bedroom', -1.2, 1, 16], ['Master Bath', -3.5, 3, 4], ['Kitchen', 2.5, -2.75, 10], ['Bedroom 2', 2.5, -0.25, 10], ['Bedroom 3', 2.5, 2.5, 12]].map(([name, x, z, a]) => ({ name, position: [x, 2.1, z], area_sqm: a })) },
  ],
  units,
  hotspots: [
    { id: uuid('h-pool'), project_id: pid, tower_id: null, title: 'Infinity Pool', category: 'pool', position: [0, 3, -38], photo_url: U('pool.svg'), description: '20 m x 10 m heated pool with sun deck and kids\' shallow zone. Open 6 am to 10 pm.' },
    { id: uuid('h-club'), project_id: pid, tower_id: null, title: 'Clubhouse', category: 'clubhouse', position: [0, 8.5, 48], photo_url: U('clubhouse.svg'), description: 'Gym, indoor games, party hall and co-working lounge across 264 sq m.' },
    { id: uuid('h-garden'), project_id: pid, tower_id: null, title: 'Central Garden', category: 'garden', position: [-62, 7, -34], photo_url: U('garden.svg'), description: 'Landscaped 720 sq m garden with walking track and seating.' },
  ],
};
const seedDir = join(root, 'seed'); await mkdir(seedDir, { recursive: true });
await writeFile(join(seedDir, 'sample-project.json'), JSON.stringify(seed, null, 1));
console.log('seed written:', towers.length, 'towers,', floors.length, 'floors,', units.length, 'units');
