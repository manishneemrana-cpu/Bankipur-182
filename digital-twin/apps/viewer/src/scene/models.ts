import { useGLTF } from '@react-three/drei';
import { type Material, type Mesh, type MeshStandardMaterial, type Object3D, Box3, Vector3 } from 'three';
import { assetUrl } from '../api';

// Decoder is bundled in /public/draco (copied from three) so the TV never depends on a CDN.
useGLTF.setDecoderPath(`${import.meta.env.BASE_URL}draco/`);

export const glbUrl = (u: string) => assetUrl(u);
export const preload = (u: string | null | undefined) => { if (u) useGLTF.preload(glbUrl(u)); };

const isMesh = (o: Object3D): o is Mesh => (o as Mesh).isMesh === true;
const isWindow = (m: Material) => /window/i.test(m.name);

/** Clone materials so per-instance opacity / emissive changes never leak into the cached glTF. */
function cloneMaterials(root: Object3D, cache = new Map<Material, Material>(), shadows = true): Material[] {
  const out = new Set<Material>();
  root.traverse((o) => {
    if (!isMesh(o)) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const cloned = mats.map((m) => {
      let c = cache.get(m);
      if (!c) { c = m.clone(); c.userData.baseOpacity = m.opacity; c.userData.baseTransparent = m.transparent; cache.set(m, c); }
      out.add(c);
      return c;
    });
    o.material = Array.isArray(o.material) ? cloned : cloned[0]!;
    o.castShadow = shadows; o.receiveShadow = shadows;
  });
  return [...out];
}

export interface FloorPart { n: number; node: Object3D; mats: Material[]; shells: Object3D[]; glass: MeshStandardMaterial[]; opacity: number }
export interface TowerParts { root: Object3D; floors: FloorPart[]; roof?: FloorPart; other: Material[] }

/** Split a tower GLB into floor parts using the `Floor_NN` naming convention (+ optional `Roof`). */
export function prepareTower(src: Object3D, prefix: string): TowerParts {
  const root = src.clone(true);
  const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`, 'i');
  const floors: FloorPart[] = [];
  let roof: FloorPart | undefined;
  const mk = (n: number, node: Object3D): FloorPart => {
    const mats = cloneMaterials(node);
    const shells: Object3D[] = [];
    node.traverse((o) => { if (/^shell/i.test(o.name)) shells.push(o); });
    return { n, node, mats, shells, glass: mats.filter(isWindow) as MeshStandardMaterial[], opacity: 1 };
  };
  const claimed = new Set<Object3D>();
  root.traverse((o) => {
    const m = re.exec(o.name);
    if (m) { floors.push(mk(Number(m[1]), o)); claimed.add(o); }
    else if (/^roof$/i.test(o.name)) { roof = mk(Infinity, o); claimed.add(o); }
  });
  floors.sort((a, b) => a.n - b.n);
  // Anything not under a floor/roof (e.g. podium, plinth) keeps its own materials and always stays solid.
  const rest = new Map<Material, Material>();
  const other: Material[] = [];
  root.traverse((o) => {
    if (!isMesh(o)) return;
    for (let p: Object3D | null = o; p; p = p.parent) if (claimed.has(p)) return;
    other.push(...cloneMaterials(o, rest));
  });
  return { root, floors, roof, other };
}

/** Simple clone with private materials (site, LOD tower, interiors). */
export function prepareSimple(src: Object3D): { root: Object3D; mats: Material[] } {
  const root = src.clone(true);
  return { root, mats: cloneMaterials(root) };
}

export function setNightLook(mats: Material[], night: boolean, seed = 0) {
  for (const m of mats) {
    if (!isWindow(m)) continue;
    const s = m as MeshStandardMaterial;
    if (!s.emissive) continue;
    s.emissive.set(night ? '#ffd79a' : '#000000');
    // Deterministic "lights on / off" variation per floor so towers don't glow uniformly.
    const h = Math.abs(Math.sin(seed * 12.9898 + 4.1414) * 43758.5453) % 1;
    s.emissiveIntensity = night ? (0.25 + 0.85 * h) * (/^lod/i.test(m.name) ? 0.4 : 1) : 0;
  }
}

export function boundsOf(root: Object3D): { min: [number, number, number]; max: [number, number, number] } {
  const b = new Box3().setFromObject(root);
  const v = (x: Vector3): [number, number, number] => [x.x, x.y, x.z];
  return { min: v(b.min), max: v(b.max) };
}
