import { assetUrl } from '../api';

export function Splash({ name, cover, label, progress }: { name?: string; cover?: string | null; label?: string; progress?: number }) {
  return (
    <div className="splash" role="status" aria-live="polite">
      {cover && <img src={assetUrl(cover)} alt="" className="splash-bg" />}
      <div className="splash-card">
        {name && <h1>{name}</h1>}
        <p>{label ?? 'Loading…'}</p>
        <div className="bar"><i style={{ width: `${progress ?? 8}%` }} /></div>
      </div>
    </div>
  );
}
