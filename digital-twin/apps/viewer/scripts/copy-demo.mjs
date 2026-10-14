// Static demo build: bundle the generated sample project (JSON + Draco GLBs + photos) so the viewer runs with no backend.
// Build with:  VITE_DEMO=1 npm run build:demo
import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const api = join(here, '..', '..', 'api');
const dest = join(here, '..', 'public', 'demo');
await mkdir(dest, { recursive: true });
// The seed is a table dump ({projects:[…], towers, …}); the viewer expects the public bundle shape ({project, …}).
const seed = JSON.parse(await readFile(join(api, 'seed', 'sample-project.json'), 'utf8'));
const { projects, ...rest } = seed;
await writeFile(join(dest, 'project.json'), JSON.stringify({ project: projects[0], ...rest }));
await cp(join(api, 'storage', 'sample'), dest, { recursive: true });
console.log('demo assets copied:', (await readdir(dest)).length, 'files ->', dest);
