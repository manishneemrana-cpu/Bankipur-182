import type { Config } from '../config.js';
import { ArchilogicProvider } from './archilogic.js';
import { CubiCasaProvider } from './cubicasa.js';
import { MockProvider } from './mock.js';
import type { FloorPlanAnalysisProvider } from './provider.js';

export type { FloorPlanAnalysisProvider } from './provider.js';

export function createFloorPlanProvider(cfg: Pick<Config, 'floorplanProvider' | 'cubicasaKey' | 'archilogicKey'>): FloorPlanAnalysisProvider {
  switch (cfg.floorplanProvider) {
    case 'cubicasa': return new CubiCasaProvider(cfg.cubicasaKey);
    case 'archilogic': return new ArchilogicProvider(cfg.archilogicKey);
    case 'mock': return new MockProvider();
    default: throw new Error(`Unknown FLOORPLAN_PROVIDER "${cfg.floorplanProvider}" (use mock | cubicasa | archilogic)`);
  }
}
