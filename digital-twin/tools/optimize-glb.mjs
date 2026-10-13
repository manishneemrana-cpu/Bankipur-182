#!/usr/bin/env node
// Usage: node tools/optimize-glb.mjs <in.glb> [--out dir] [--lod 0.15] [--no-lod]
// Produces <name>.glb (Draco, deduped) and <name>.lod.glb (simplified + Draco) ready to upload in the admin panel.
import { basename, join, resolve } from 'node:path';
import { makeIO, dracoCompress, makeLod, writeGlb } from './glb-lib.mjs';

const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith('--'));
if (!input) { console.error('usage: optimize-glb.mjs <in.glb> [--out dir] [--lod 0.15] [--no-lod]'); process.exit(1); }
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const outDir = resolve(flag('--out', '.'));
const ratio = parseFloat(flag('--lod', '0.15'));
const name = basename(input).replace(/\.glb$/i, '');

const io = await makeIO();
const full = await io.read(input);
await dracoCompress(full);
console.log(`full: ${join(outDir, name + '.glb')}  ${(await writeGlb(io, full, join(outDir, name + '.glb')) / 1024).toFixed(0)} KB`);

if (!args.includes('--no-lod')) {
  const lod = await io.read(input);
  await makeLod(lod, ratio);
  await dracoCompress(lod);
  console.log(`lod : ${join(outDir, name + '.lod.glb')}  ${(await writeGlb(io, lod, join(outDir, name + '.lod.glb')) / 1024).toFixed(0)} KB`);
}
