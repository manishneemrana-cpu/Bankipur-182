import { lazy, Suspense, useEffect, useState } from 'react';
import { DEMO, DEMO_SLUG, fetchBundle, setAnalyticsSlug } from './api';
import { useStore } from './store';
import { Splash } from './ui/Splash';

// Start fetching the 3D chunk immediately, in parallel with the project JSON (first-interactive budget).
const loadRoot = () => import('./ViewerRoot');
const ViewerRoot = lazy(loadRoot);
void loadRoot();

const slugFromPath = () => /^\/view\/([^/]+)/.exec(location.pathname)?.[1] ?? (DEMO ? DEMO_SLUG : null);

export function App() {
  const slug = slugFromPath();
  const bundle = useStore((s) => s.bundle);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setAnalyticsSlug(slug);
    const ac = new AbortController();
    fetchBundle(slug, ac.signal).then((b) => { document.title = `${b.project.name} – 3D Tour`; useStore.getState().load(b); })
      .catch((e) => { if (e.name !== 'AbortError') setError(e.message); });
    return () => ac.abort();
  }, [slug]);

  if (!slug) {
    return (
      <main className="message">
        <h1>Digital Twin Viewer</h1>
        <p>Open a project link like <code>/view/your-project-slug</code>.</p>
        <p><a href="/view/skyline-residences">Open the sample project →</a></p>
      </main>
    );
  }
  if (error) return <main className="message"><h1>Can’t open this tour</h1><p>{error}</p><button onClick={() => location.reload()}>Try again</button></main>;
  if (!bundle) return <Splash label="Loading project…" />;
  return <Suspense fallback={<Splash name={bundle.project.name} cover={bundle.project.cover_image_url} label="Preparing 3D…" />}><ViewerRoot /></Suspense>;
}
