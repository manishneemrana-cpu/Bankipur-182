import { useEffect, useState } from 'react';
import { api, assetUrl, VIEWER_URL } from '../api';
import { ErrorMsg, Field, slugify, UploadField, useAction } from '../ui';

type Row = Awaited<ReturnType<typeof api.projects>>[number];

export function ProjectList() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const { error, run } = useAction();
  const load = () => run(async () => setRows(await api.projects()));
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <h1>Projects</h1>
      <ErrorMsg error={error} />
      <div className="grid">
        {rows?.map((p) => (
          <a key={p.id} href={`#/p/${p.id}`} className="card project">
            {p.cover_image_url ? <img src={assetUrl(p.cover_image_url)} alt="" /> : <div className="noimg">No cover</div>}
            <div><b>{p.name}</b><span>{p.location}</span><code>{VIEWER_URL}/view/{p.slug}</code><em className={p.is_published ? 'pub' : 'draft'}>{p.is_published ? 'Published' : 'Draft'}</em></div>
          </a>
        ))}
        {rows?.length === 0 && <p>No projects yet.</p>}
      </div>
      <NewProject onCreated={(id) => { location.hash = `#/p/${id}`; }} />
    </>
  );
}

function NewProject({ onCreated }: { onCreated: (id: string) => void }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [location_, setLocation] = useState('');
  const [cover, setCover] = useState<string | null>(null);
  const { busy, error, run } = useAction();
  // Cover upload needs a folder id; use a throwaway placeholder folder until the project exists.
  const folder = '00000000-0000-4000-8000-000000000000';
  const submit = (e: React.FormEvent) => { e.preventDefault(); void run(async () => { const p = await api.createProject({ name, slug: slug || slugify(name), location: location_, cover_image_url: cover }); onCreated(p.id); }); };
  return (
    <form className="card form" onSubmit={submit}>
      <h2>New project</h2>
      <Field label="Name"><input required value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Link slug" hint={`Public link: ${VIEWER_URL}/view/${slug || slugify(name) || '…'}`}><input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} placeholder={slugify(name)} /></Field>
      <Field label="Location"><input value={location_} onChange={(e) => setLocation(e.target.value)} /></Field>
      <UploadField label="Cover image" kind="image" projectId={folder} value={cover} onChange={setCover} />
      <ErrorMsg error={error} />
      <button disabled={busy || !name}>Create project</button>
    </form>
  );
}
