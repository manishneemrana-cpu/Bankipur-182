import { type ReactNode, useState } from 'react';
import { api, assetUrl } from './api';

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export function Num({ value, onChange, step = 'any', ...rest }: { value: number; onChange: (n: number) => void; step?: string; min?: number; max?: number }) {
  return <input type="number" step={step} value={Number.isFinite(value) ? value : ''} onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))} {...rest} />;
}

export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true); setError(null);
    try { return await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return { busy, error, run, setError };
}

export const ErrorMsg = ({ error }: { error: string | null }) => (error ? <p className="error" role="alert">{error}</p> : null);

/** File → upload → URL. For GLBs it surfaces the Draco check from the API. */
export function UploadField({ label, kind, projectId, value, onChange, hint }: { label: string; kind: 'glb' | 'image'; projectId: string; value: string | null; onChange: (url: string | null) => void; hint?: string }) {
  const { busy, error, run } = useAction();
  const [notes, setNotes] = useState<string[]>([]);
  const pick = (file?: File) => file && run(async () => {
    const r = await api.upload(file, kind, projectId);
    setNotes([`${(r.size / 1024).toFixed(0)} KB`, ...(kind === 'glb' ? [r.draco ? '✓ Draco-compressed' : '', r.floor_nodes ? `${r.floor_nodes} Floor_NN nodes found` : ''] : []), ...r.warnings].filter(Boolean));
    onChange(r.url);
  });
  return (
    <div className="field upload">
      <span>{label}</span>
      <div className="row">
        {kind === 'image' && value && <img src={assetUrl(value)} alt="" className="thumb" />}
        {value ? <code className="url" title={value}>{value.split('/').slice(-1)[0]}</code> : <em>none</em>}
        <input type="file" accept={kind === 'glb' ? '.glb,model/gltf-binary' : 'image/jpeg,image/png,image/webp'} disabled={busy} onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
        {value && <button type="button" className="ghost" onClick={() => onChange(null)}>Remove</button>}
      </div>
      {busy && <small>Uploading…</small>}
      {hint && <small>{hint}</small>}
      {notes.map((n, i) => <small key={i} className={n.startsWith('This GLB') ? 'warn' : ''}>{n}</small>)}
      <ErrorMsg error={error} />
    </div>
  );
}

export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
