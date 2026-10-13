import { mkdir, rename, copyFile, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Storage } from './types.js';

/** Writes under <storageDir>/uploads and is served by Express at /files/uploads/... (dev/demo). */
export class LocalStorage implements Storage {
  constructor(private root: string, private publicUrl: string) {}
  async save(tmpPath: string, objectPath: string) {
    const dest = join(this.root, 'uploads', objectPath);
    await mkdir(dirname(dest), { recursive: true });
    try { await rename(tmpPath, dest); } catch { await copyFile(tmpPath, dest); await rm(tmpPath, { force: true }); }
    const { size } = await stat(dest);
    return { url: `${this.publicUrl}/files/uploads/${objectPath}`, path: objectPath, size };
  }
}
