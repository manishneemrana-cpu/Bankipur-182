import type { FloorPlanAnalysisProvider, FloorPlanInput } from './provider.js';
import { mockAnalysis } from './mock.js';

/**
 * CubiCasa floor-plan → structured room/wall data.
 *
 * STATUS: STUB. Returns a mock response – NO paid API call is made.
 * TODO(owner approval required): once the owner confirms a CUBICASA_API_KEY is ready for testing,
 *   1. read the current CubiCasa API docs for the upload/"order" + result-retrieval endpoints (do not guess shapes),
 *   2. upload `input.filePath` using `apiKey` in the auth header the docs specify,
 *   3. poll or receive the callback for completion,
 *   4. map the response (rooms, walls, doors/windows, scale) into FloorPlanAnalysis (see shared-types),
 *      converting px→metres with the returned scale,
 *   5. add a contract test with a recorded fixture, then drop the mock fallback.
 */
export class CubiCasaProvider implements FloorPlanAnalysisProvider {
  readonly name = 'cubicasa';
  constructor(private apiKey?: string) {}
  async analyze(input: FloorPlanInput) {
    const keyNote = this.apiKey ? 'CUBICASA_API_KEY is set but live calls are disabled until approved.' : 'CUBICASA_API_KEY not set.';
    return mockAnalysis('cubicasa', input, `CubiCasa adapter is a stub – ${keyNote}`);
  }
}
