import { useEffect, useState } from 'react';
import { api, getToken, setToken } from './api';
import { ErrorMsg, useAction } from './ui';
import { ProjectEditor } from './pages/ProjectEditor';
import { ProjectList } from './pages/ProjectList';

function useHash() {
  const [h, setH] = useState(location.hash.slice(1) || '/');
  useEffect(() => { const f = () => setH(location.hash.slice(1) || '/'); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  return h;
}

function Login({ onOk }: { onOk: () => void }) {
  const [t, setT] = useState('');
  const { busy, error, run } = useAction();
  const submit = (e: React.FormEvent) => { e.preventDefault(); setToken(t.trim()); run(async () => { await api.projects(); onOk(); }).then(() => { if (!getToken()) return; }); };
  return (
    <main className="login">
      <form onSubmit={submit} className="card">
        <h1>Digital Twin Admin</h1>
        <label className="field"><span>Admin API token</span><input type="password" value={t} onChange={(e) => setT(e.target.value)} autoFocus placeholder="ADMIN_API_TOKEN" /></label>
        <ErrorMsg error={error} />
        <button disabled={busy || !t}>Sign in</button>
        <small>The token is set in the API server's environment (<code>ADMIN_API_TOKEN</code>) and kept only for this browser tab.</small>
      </form>
    </main>
  );
}

export function App() {
  const hash = useHash();
  const [authed, setAuthed] = useState(false);
  const [checked, setChecked] = useState(false);
  useEffect(() => { if (!getToken()) { setChecked(true); return; } api.projects().then(() => setAuthed(true)).catch(() => setToken('')).finally(() => setChecked(true)); }, []);
  if (!checked) return null;
  if (!authed) return <Login onOk={() => setAuthed(true)} />;

  const m = /^\/p\/([0-9a-f-]{36})(?:\/(\w+))?/.exec(hash);
  return (
    <>
      <header className="top">
        <a href="#/" className="brand">◈ Digital Twin Admin</a>
        <button className="ghost" onClick={() => { setToken(''); setAuthed(false); }}>Sign out</button>
      </header>
      <main className="page">{m ? <ProjectEditor id={m[1]!} tab={m[2] ?? 'overview'} /> : <ProjectList />}</main>
    </>
  );
}
