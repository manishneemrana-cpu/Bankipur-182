import { useStore } from '../store';

const KEYS: [string, string][] = [
  ['1 / 2 / 3', 'Exterior · Floor plan · Interior presets'], ['↑ / ↓', 'Next / previous floor (tower & floor views)'],
  ['Esc', 'Go back one level'], ['N', 'Day / night'], ['M', 'Measure distance (click two points)'],
  ['F', 'Furnished / unfurnished (inside a unit)'], ['V', 'Walk-through (inside a unit)'], ['?', 'This help'],
];

export function Help() {
  const open = useStore((s) => s.helpOpen);
  const set = useStore((s) => s.setHelp);
  if (!open) return null;
  return (
    <div className="modal" role="dialog" aria-label="Shortcuts" onClick={() => set(false)}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>How to explore</h2>
        <p>Drag to rotate · scroll / pinch to zoom · right-drag or two fingers to pan. Click a tower, floor or unit to dive in.</p>
        <table><tbody>{KEYS.map(([k, d]) => <tr key={k}><td><kbd>{k}</kbd></td><td>{d}</td></tr>)}</tbody></table>
        <button onClick={() => set(false)}>Got it</button>
      </div>
    </div>
  );
}
