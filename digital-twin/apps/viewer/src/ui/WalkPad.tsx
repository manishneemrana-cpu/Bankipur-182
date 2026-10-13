import { walkKeys } from '../lib/input';
import { useStore } from '../store';

const Key = ({ k, label }: { k: string; label: string }) => (
  <button
    className={`pad-${k}`} aria-label={label}
    onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); walkKeys.add(k); }}
    onPointerUp={() => walkKeys.delete(k)} onPointerCancel={() => walkKeys.delete(k)} onContextMenu={(e) => e.preventDefault()}
  >{label}</button>
);

/** On-screen movement pad (touch screens). Keyboard: WASD / arrows, Shift to run. Drag the view to look around. */
export function WalkPad() {
  const walk = useStore((s) => s.walk);
  if (!walk) return null;
  return (
    <>
      <div className="walkhint" role="status">Drag to look · WASD / arrows to move · Shift to run · V to exit</div>
      <div className="walkpad" aria-label="Movement pad">
        <Key k="w" label="▲" /><Key k="a" label="◀" /><Key k="s" label="▼" /><Key k="d" label="▶" />
      </div>
    </>
  );
}
