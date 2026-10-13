import { assetUrl } from '../api';
import { useStore } from '../store';

export function HotspotCard() {
  const h = useStore((s) => s.bundle?.hotspots.find((x) => x.id === s.hotspotId));
  const close = useStore((s) => s.selectHotspot);
  if (!h) return null;
  return (
    <aside className="card" role="dialog" aria-label={h.title}>
      <button className="close" onClick={() => close(null)} aria-label="Close">×</button>
      {h.photo_url && <img src={assetUrl(h.photo_url)} alt={h.title} />}
      <div className="body">
        <small>{h.category}</small>
        <h2>{h.title}</h2>
        <p>{h.description}</p>
      </div>
    </aside>
  );
}
