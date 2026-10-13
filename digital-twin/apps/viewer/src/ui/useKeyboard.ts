import { useEffect } from 'react';
import { walkKeys } from '../lib/input';
import { useStore } from '../store';

/** Presenter shortcuts (also works with TV-remote keyboards). 1/2/3 presets · N day/night · M measure · F furniture · V walk · Esc back · ↑↓ floors. */
export function useKeyboard() {
  useEffect(() => {
    const typing = (e: KeyboardEvent) => /input|textarea|select/i.test((e.target as HTMLElement)?.tagName ?? '');
    const down = (e: KeyboardEvent) => {
      if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      const s = useStore.getState();
      const k = e.key.toLowerCase();
      if (s.walk && ['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) {
        walkKeys.add(k); e.preventDefault(); return;
      }
      switch (k) {
        case '1': s.preset('exterior'); break;
        case '2': s.preset('floor-plan'); break;
        case '3': s.preset('interior'); break;
        case 'n': s.toggleNight(); break;
        case 'm': s.toggleMeasure(); break;
        case 'f': if (s.level === 'unit') s.toggleFurnished(); break;
        case 'v': s.toggleWalk(); break;
        case 'escape': s.up(); break;
        case 'arrowup': if (s.level === 'tower' || s.level === 'floor') { s.stepFloor(1); e.preventDefault(); } break;
        case 'arrowdown': if (s.level === 'tower' || s.level === 'floor') { s.stepFloor(-1); e.preventDefault(); } break;
        case '?': case 'h': s.setHelp(!s.helpOpen); break;
        default: return;
      }
    };
    const up = (e: KeyboardEvent) => walkKeys.delete(e.key.toLowerCase());
    const clear = () => walkKeys.clear();
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', clear);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', clear); };
  }, []);
}
