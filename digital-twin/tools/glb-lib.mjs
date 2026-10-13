// Shared helpers for building / optimising GLBs. Plain ESM so artists can run it with just Node.
import { Document, NodeIO } from '@gltf-transform/core';
import { KHRDracoMeshCompression } from '@gltf-transform/extensions';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { draco, simplify, weld, dedup, prune } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { MeshoptSimplifier } from 'meshoptimizer';

export async function makeIO() {
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'draco3d.encoder': await draco3d.createEncoderModule(),
    'draco3d.decoder': await draco3d.createDecoderModule(),
  });
}

/** Draco-compress every primitive in the document. */
export async function dracoCompress(doc) {
  await doc.transform(dedup(), prune(), draco({ method: 'edgebreaker' }));
  return doc;
}

/** Aggressively simplified copy for far-zoom LOD, then Draco. ratio = fraction of triangles kept. */
export async function makeLod(doc, ratio = 0.15, error = 0.05) {
  await MeshoptSimplifier.ready;
  await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio, error }), dedup(), prune());
  return doc;
}

export async function writeGlb(io, doc, path) {
  const { writeFile, mkdir } = await import('node:fs/promises');
  const { dirname } = await import('node:path');
  await mkdir(dirname(path), { recursive: true });
  const bytes = await io.writeBinary(doc);
  await writeFile(path, bytes);
  return bytes.byteLength;
}

/* ------------------------------------------------------------ box builder */

const FACES = [
  { n: [1, 0, 0], v: [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]] },
  { n: [-1, 0, 0], v: [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]] },
  { n: [0, 1, 0], v: [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]] },
  { n: [0, -1, 0], v: [[-1, -1, 1], [-1, -1, -1], [1, -1, -1], [1, -1, 1]] },
  { n: [0, 0, 1], v: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
  { n: [0, 0, -1], v: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] },
];

export class Builder {
  constructor() {
    this.doc = new Document();
    this.buffer = this.doc.createBuffer();
    this.scene = this.doc.createScene('Scene');
    this.mats = new Map();
  }
  material(name, rgb, { rough = 0.8, metal = 0, alpha = 1 } = {}) {
    if (this.mats.has(name)) return this.mats.get(name);
    const m = this.doc.createMaterial(name).setBaseColorFactor([...rgb, alpha]).setRoughnessFactor(rough).setMetallicFactor(metal);
    if (alpha < 1) m.setAlphaMode('BLEND');
    this.mats.set(name, m);
    return m;
  }
  /** Axis-aligned box centred at `pos`, size [w,h,d]. Returns a Node (not yet parented). */
  box(name, size, pos, material) {
    const [w, h, d] = size;
    const P = [], N = [], I = [];
    FACES.forEach((f, fi) => {
      f.v.forEach((c) => { P.push(c[0] * w / 2, c[1] * h / 2, c[2] * d / 2); N.push(...f.n); });
      const o = fi * 4;
      I.push(o, o + 1, o + 2, o, o + 2, o + 3);
    });
    const acc = (type, arr, A) => this.doc.createAccessor().setType(type).setArray(arr).setBuffer(this.buffer);
    const prim = this.doc.createPrimitive()
      .setAttribute('POSITION', acc('VEC3', new Float32Array(P)))
      .setAttribute('NORMAL', acc('VEC3', new Float32Array(N)))
      .setIndices(this.doc.createAccessor().setType('SCALAR').setArray(new Uint16Array(I)).setBuffer(this.buffer))
      .setMaterial(material);
    const mesh = this.doc.createMesh(name).addPrimitive(prim);
    return this.doc.createNode(name).setMesh(mesh).setTranslation(pos);
  }
  group(name, pos = [0, 0, 0]) { return this.doc.createNode(name).setTranslation(pos); }
}
