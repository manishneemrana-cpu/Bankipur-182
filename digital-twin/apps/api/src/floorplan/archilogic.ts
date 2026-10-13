import type { FloorPlanAnalysisProvider, FloorPlanInput } from './provider.js';
import { mockAnalysis } from './mock.js';

/**
 * Archilogic floor-plan → structured data.
 *
 * STATUS: STUB. Returns a mock response – NO paid API call is made.
 * TODO(owner approval required): once the owner confirms an ARCHILOGIC_API_KEY is ready for testing,
 *   1. read the current Archilogic API docs for the floor-plan-conversion endpoints (do not guess shapes),
 *   2. submit `input.filePath`, wait for the job, fetch the resulting scene/floor data,
 *   3. map walls/rooms/openings into FloorPlanAnalysis (see shared-types) in metres,
 *   4. add a contract test with a recorded fixture, then drop the mock fallback.
 */
export class ArchilogicProvider implements FloorPlanAnalysisProvider {
  readonly name = 'archilogic';
  constructor(private apiKey?: string) {}
  async analyze(input: FloorPlanInput) {
    const keyNote = this.apiKey ? 'ARCHILOGIC_API_KEY is set but live calls are disabled until approved.' : 'ARCHILOGIC_API_KEY not set.';
    return mockAnalysis('archilogic', input, `Archilogic adapter is a stub – ${keyNote}`);
  }
}
