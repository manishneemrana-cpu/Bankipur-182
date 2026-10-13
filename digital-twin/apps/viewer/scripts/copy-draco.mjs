// Serve the Draco decoder from our own origin (no runtime dependency on a third-party CDN – matters on sales-office Wi-Fi/TVs).
import { cp, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
// three's "exports" hides package.json, so walk up from its main entry (build/three.cjs) to the package root.
const three = dirname(dirname(require.resolve('three')));
const dest = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'draco');
await mkdir(dest, { recursive: true });
await cp(join(three, 'examples', 'jsm', 'libs', 'draco', 'gltf'), dest, { recursive: true });
console.log('draco decoder copied to', dest);
