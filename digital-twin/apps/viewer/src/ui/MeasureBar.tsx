import { formatDistance, measureDistance } from '../lib/measure';
import { useStore } from '../store';

export function MeasureBar() {
  const measuring = useStore((s) => s.measuring);
  const pending = useStore((s) => s.pending);
  const list = useStore((s) => s.measurements);
  const scale = useStore((s) => s.bundle?.project.model_scale ?? 1);
  const s = useStore.getState;
  if (!measuring && !list.length) return null;
  const last = list[list.length - 1];
  return (
    <div className="measurebar" role="status">
      {measuring && <span>{pending ? 'Click the second point' : 'Click the first point on the model'}</span>}
      {last && <strong>{formatDistance(measureDistance(last.a, last.b, scale))}</strong>}
      {list.length > 0 && <button onClick={() => s().clearMeasure()}>Clear</button>}
      {measuring && <button onClick={() => s().toggleMeasure()}>Done</button>}
    </div>
  );
}
