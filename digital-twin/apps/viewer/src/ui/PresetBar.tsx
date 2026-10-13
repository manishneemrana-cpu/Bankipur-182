import { useStore } from '../store';

/** Explicit camera presets for live demos (1 / 2 / 3). Furnished + walk controls appear inside a unit. */
export function PresetBar() {
  const level = useStore((s) => s.level);
  const measuring = useStore((s) => s.measuring);
  const furnished = useStore((s) => s.furnished);
  const walk = useStore((s) => s.walk);
  const s = useStore.getState;
  const active = level === 'unit' ? 'interior' : level === 'floor' ? 'floor-plan' : 'exterior';
  const Btn = ({ id, label, k }: { id: 'exterior' | 'floor-plan' | 'interior'; label: string; k: string }) => (
    <button className={`preset${active === id && (id !== 'floor-plan' || level === 'floor') ? ' on' : ''}`} onClick={() => s().preset(id)} aria-pressed={active === id}>
      <kbd>{k}</kbd>{label}
    </button>
  );
  return (
    <div className="presetbar" role="toolbar" aria-label="View presets">
      <Btn id="exterior" label="Exterior" k="1" />
      <Btn id="floor-plan" label="Floor plan" k="2" />
      <Btn id="interior" label="Interior" k="3" />
      <span className="sep" aria-hidden />
      {level === 'unit' && (
        <>
          <button className={`toggle${furnished ? ' on' : ''}`} onClick={() => s().toggleFurnished()} aria-pressed={furnished}><kbd>F</kbd>{furnished ? 'Furnished' : 'Unfurnished'}</button>
          <button className={`toggle${walk ? ' on' : ''}`} onClick={() => s().toggleWalk()} aria-pressed={walk}><kbd>V</kbd>{walk ? 'Walking' : 'Walk-through'}</button>
        </>
      )}
      <button className={`toggle${measuring ? ' on' : ''}`} onClick={() => s().toggleMeasure()} aria-pressed={measuring}><kbd>M</kbd>Measure</button>
    </div>
  );
}
