import { open } from 'node:fs/promises';

export interface GlbInfo { valid: boolean; draco: boolean; nodes: number; floorNodes: number; extensions: string[]; error?: string }

/** Reads only the GLB header + JSON chunk (no geometry) to validate the file and detect Draco. */
export async function inspectGlb(path: string): Promise<GlbInfo> {
  const bad = (error: string): GlbInfo => ({ valid: false, draco: false, nodes: 0, floorNodes: 0, extensions: [], error });
  const fh = await open(path, 'r');
  try {
    const head = Buffer.alloc(20);
    await fh.read(head, 0, 20, 0);
    if (head.readUInt32LE(0) !== 0x46546c67) return bad('Not a GLB file (bad magic)');
    if (head.readUInt32LE(4) !== 2) return bad('Unsupported glTF version');
    const jsonLen = head.readUInt32LE(12);
    if (head.readUInt32LE(16) !== 0x4e4f534a) return bad('First GLB chunk is not JSON');
    if (jsonLen > 32 * 1024 * 1024) return bad('GLB JSON chunk too large');
    const buf = Buffer.alloc(jsonLen);
    await fh.read(buf, 0, jsonLen, 20);
    const json = JSON.parse(buf.toString('utf8')) as { extensionsUsed?: string[]; nodes?: { name?: string }[] };
    const ext = json.extensionsUsed ?? [];
    const nodes = json.nodes ?? [];
    return {
      valid: true,
      draco: ext.includes('KHR_draco_mesh_compression'),
      nodes: nodes.length,
      floorNodes: nodes.filter((n) => /^floor_\d+$/i.test(n.name ?? '')).length,
      extensions: ext,
    };
  } catch (e) {
    return bad(`Could not parse GLB: ${(e as Error).message}`);
  } finally {
    await fh.close();
  }
}

const IMG_MAGIC: [string, number[], string][] = [
  ['jpg', [0xff, 0xd8, 0xff], 'image/jpeg'],
  ['png', [0x89, 0x50, 0x4e, 0x47], 'image/png'],
  ['webp', [0x52, 0x49, 0x46, 0x46], 'image/webp'], // RIFF....WEBP
];
export async function sniffImage(path: string): Promise<{ ext: string; type: string } | null> {
  const fh = await open(path, 'r');
  try {
    const b = Buffer.alloc(12);
    await fh.read(b, 0, 12, 0);
    for (const [ext, magic, type] of IMG_MAGIC) {
      if (magic.every((v, i) => b[i] === v) && (ext !== 'webp' || b.subarray(8, 12).toString() === 'WEBP')) return { ext, type };
    }
    return null;
  } finally { await fh.close(); }
}
