import { useState } from 'react';
import { api, VIEWER_URL } from '../api';
import { ErrorMsg, Field, Num, slugify, UploadField, useAction } from '../ui';
import type { TabProps } from './ProjectEditor';

export function Overview({ bundle, reload }: TabProps) {
  const p = bundle.project;
  const [f, setF] = useState({ name: p.name, slug: p.slug, location: p.location, description: p.description ?? '', model_scale: p.model_scale });
  const { busy, error, run } = useAction();
  const [copied, setCopied] = useState(false);
  const link = `${VIEWER_URL}/view/${p.slug}`;
  const save = (patch: object) => run(async () => { await api.patchProject(p.id, patch); await reload(); });
  const missing = [!p.site_glb_url && !bundle.towers.some((t) => t.glb_url) && 'a site or tower GLB', bundle.towers.length === 0 && 'at least one tower'].filter(Boolean);

  return (
    <div className="stack">
      <section className="card form">
        <h2>Details</h2>
        <Field label="Name"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Link slug" hint="Changing it breaks links you already shared."><input value={f.slug} onChange={(e) => setF({ ...f, slug: slugify(e.target.value) })} /></Field>
        <Field label="Location"><input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></Field>
        <Field label="Description"><textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="Model scale (metres per model unit)" hint="Export GLBs in metres → 1. Drives the viewer's distance tool."><Num value={f.model_scale} onChange={(n) => setF({ ...f, model_scale: n })} min={0.0001} /></Field>
        <button disabled={busy} onClick={() => save({ ...f, description: f.description || null })}>Save details</button>
        <ErrorMsg error={error} />
      </section>

      <section className="card form">
        <h2>Models & cover</h2>
        <UploadField label="Cover image" kind="image" projectId={p.id} value={p.cover_image_url} onChange={(u) => save({ cover_image_url: u })} />
        <UploadField label="Site GLB (full detail)" kind="glb" projectId={p.id} value={p.site_glb_url} onChange={(u) => save({ site_glb_url: u })} hint="Ground, roads, amenities, landscaping. Optional if towers are enough." />
        <UploadField label="Site GLB (LOD – simplified)" kind="glb" projectId={p.id} value={p.site_lod_glb_url} onChange={(u) => save({ site_lod_glb_url: u })} hint="Shown at far zoom and while the full model streams in. Generate with `npm run optimize`." />
      </section>

      <section className="card form">
        <h2>Publish & share</h2>
        <p>Public link: <code>{link}</code>{' '}
          <button className="ghost" onClick={async () => { await navigator.clipboard.writeText(link).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? 'Copied ✓' : 'Copy'}</button>{' '}
          <a href={link} target="_blank" rel="noreferrer">Open ↗</a></p>
        {!p.is_published && missing.length > 0 && <p className="warn">Not ready yet: add {missing.join(' and ')}.</p>}
        <label className="check"><input type="checkbox" checked={p.is_published} onChange={(e) => save({ is_published: e.target.checked })} /> Published (anyone with the link can view)</label>
        <hr />
        <button className="danger" onClick={() => { if (confirm(`Delete "${p.name}" and everything in it? This cannot be undone.`)) void run(async () => { await api.deleteProject(p.id); location.hash = '#/'; }); }}>Delete project</button>
      </section>
    </div>
  );
}
