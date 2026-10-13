import type { Hotspot, HotspotCategory, ProjectBundle, Vec3 } from '@dt/shared-types';
import { HotspotCategory as Cat } from '@dt/shared-types';
import { OrbitControls, useGLTF } from '@react-three/drei';
import { Canvas, type ThreeEvent } from '@react-three/fiber';
import { Suspense, useMemo, useState } from 'react';
import { api, assetUrl } from '../api';
import { ErrorMsg, Field, UploadField, useAction } from '../ui';
import type { TabProps } from './ProjectEditor';

useGLTF.setDecoderPath(`${import.meta.env.BASE_URL}draco/`);

type Draft = { id: string | null; title: string; description: string; category: HotspotCategory; photo_url: string | null; tower_id: string | null; position: Vec3 | null };
const empty: Draft = { id: null, title: '', description: '', category: 'other', photo_url: null, tower_id: null, position: null };

function Model({ url, onPick }: { url: string; onPick: (p: Vec3) => void }) {
  const { scene } = useGLTF(assetUrl(url));
  return <primitive object={scene} onClick={(e: ThreeEvent<MouseEvent>) => { if (e.delta > 4) return; e.stopPropagation(); onPick([+e.point.x.toFixed(2), +e.point.y.toFixed(2), +e.point.z.toFixed(2)]); }} />;
}

function Scene({ bundle, onPick, markers, draft }: { bundle: ProjectBundle; onPick: (p: Vec3) => void; markers: Hotspot[]; draft: Draft }) {
  const { project, towers } = bundle;
  const center = useMemo<Vec3>(() => (towers.length ? [towers.reduce((a, t) => a + t.position[0], 0) / towers.length, 10, towers.reduce((a, t) => a + t.position[2], 0) / towers.length] : [0, 5, 0]), [towers]);
  return (
    <>
      <hemisphereLight args={['#ffffff', '#778', 1.2]} />
      <directionalLight position={[80, 120, 60]} intensity={1.6} />
      <Suspense fallback={null}>
        {(project.site_glb_url || project.site_lod_glb_url) && <Model url={(project.site_glb_url ?? project.site_lod_glb_url)!} onPick={onPick} />}
        {towers.map((t) => (t.glb_url ?? t.lod_glb_url) && (
          <group key={t.id} position={t.position} rotation-y={t.rotation_y}><Model url={(t.glb_url ?? t.lod_glb_url)!} onPick={(p) => onPick(p)} /></group>
        ))}
      </Suspense>
      {markers.map((h) => (
        <mesh key={h.id} position={h.position}><sphereGeometry args={[1, 16, 16]} /><meshBasicMaterial color={draft.id === h.id ? '#f59e0b' : '#2563eb'} /></mesh>
      ))}
      {draft.position && <mesh position={draft.position}><sphereGeometry args={[1.2, 16, 16]} /><meshBasicMaterial color="#ef4444" /></mesh>}
      <OrbitControls makeDefault target={center} />
    </>
  );
}

export function Hotspots({ bundle, reload }: TabProps) {
  const [draft, setDraft] = useState<Draft>(empty);
  const { busy, error, run, setError } = useAction();
  const hasModel = !!bundle.project.site_glb_url || !!bundle.project.site_lod_glb_url || bundle.towers.some((t) => t.glb_url || t.lod_glb_url);
  const others = bundle.hotspots.filter((h) => h.id !== draft.id);

  const save = () => run(async () => {
    if (!draft.position) throw new Error('Click the model to place the marker first.');
    const body = { title: draft.title, description: draft.description, category: draft.category, photo_url: draft.photo_url, tower_id: draft.tower_id, position: draft.position };
    if (draft.id) await api.patchHotspot(draft.id, body); else await api.createHotspot(bundle.project.id, body);
    setDraft(empty); await reload();
  });

  if (!hasModel) return <p>Upload a site or tower GLB first (Overview / Towers tabs) so there is a model to place markers on.</p>;
  return (
    <div className="split">
      <div className="viewport" aria-label="3D placement view">
        <Canvas camera={{ position: [90, 60, 90], fov: 45, near: 0.1, far: 2500 }} onPointerMissed={() => {}}>
          <Scene bundle={bundle} onPick={(p) => setDraft((d) => ({ ...d, position: p }))} markers={others.concat(draft.id ? bundle.hotspots.filter((h) => h.id === draft.id) : [])} draft={draft} />
        </Canvas>
        <p className="hint">Drag to orbit · scroll to zoom · <b>click the model</b> to drop / move the marker (red).</p>
      </div>
      <aside className="side">
        <h2>{draft.id ? 'Edit hotspot' : 'New hotspot'}</h2>
        <Field label="Title"><input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
        <Field label="Category"><select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as HotspotCategory })}>{Cat.options.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Description"><textarea rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></Field>
        <UploadField label="Photo" kind="image" projectId={bundle.project.id} value={draft.photo_url} onChange={(u) => setDraft({ ...draft, photo_url: u })} />
        <Field label="Show only in tower" hint="Leave empty to show in the site view and every tower view."><select value={draft.tower_id ?? ''} onChange={(e) => setDraft({ ...draft, tower_id: e.target.value || null })}><option value="">All views</option>{bundle.towers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
        <p className="muted">Position: {draft.position ? draft.position.join(', ') : 'not placed – click the model'}</p>
        <ErrorMsg error={error} />
        <div className="row"><button disabled={busy || !draft.title} onClick={save}>{draft.id ? 'Save changes' : 'Add hotspot'}</button>{draft.id && <button className="ghost" onClick={() => { setDraft(empty); setError(null); }}>Cancel</button>}</div>
        <h3>Hotspots ({bundle.hotspots.length})</h3>
        <ul className="hlist">
          {bundle.hotspots.map((h) => (
            <li key={h.id} className={draft.id === h.id ? 'on' : ''}>
              <button className="link" onClick={() => setDraft({ id: h.id, title: h.title, description: h.description, category: h.category, photo_url: h.photo_url, tower_id: h.tower_id, position: h.position })}>{h.title}</button>
              <button className="ghost" aria-label={`Delete ${h.title}`} onClick={() => { if (confirm(`Delete "${h.title}"?`)) void run(async () => { await api.deleteHotspot(h.id); if (draft.id === h.id) setDraft(empty); await reload(); }); }}>✕</button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
