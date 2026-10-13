import type { FloorPlanAnalysis, Vec2 } from '@dt/shared-types';
import type { FloorPlanAnalysisProvider, FloorPlanInput } from './provider.js';

/** Deterministic canned response in the normalised schema. Used by every provider until paid calls are approved. */
export function mockAnalysis(provider: string, input: FloorPlanInput, note: string): FloorPlanAnalysis {
  const rect = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const area = (x0: number, y0: number, x1: number, y1: number) => +((x1 - x0) * (y1 - y0)).toFixed(2);
  const rooms = [
    { name: 'Living & Dining', type: 'living', box: [0, 0, 5, 4] },
    { name: 'Master Bedroom', type: 'bedroom', box: [0, 4, 5, 8] },
    { name: 'Kitchen', type: 'kitchen', box: [5, 0, 9, 2.5] },
    { name: 'Bedroom 2', type: 'bedroom', box: [5, 2.5, 9, 5] },
    { name: 'Bedroom 3', type: 'bedroom', box: [5, 5, 9, 8] },
  ] as const;
  return {
    provider,
    is_mock: true,
    source_file: input.fileName,
    scale_m_per_px: null,
    rooms: rooms.map((r) => ({ name: r.name, type: r.type, polygon: rect(...(r.box as [number, number, number, number])), area_sqm: area(...(r.box as [number, number, number, number])) })),
    walls: [
      { start: [0, 0], end: [9, 0], thickness_m: 0.23, kind: 'exterior' },
      { start: [9, 0], end: [9, 8], thickness_m: 0.23, kind: 'exterior' },
      { start: [9, 8], end: [0, 8], thickness_m: 0.23, kind: 'exterior' },
      { start: [0, 8], end: [0, 0], thickness_m: 0.23, kind: 'exterior' },
      { start: [5, 0], end: [5, 8], thickness_m: 0.12, kind: 'interior' },
      { start: [0, 4], end: [5, 4], thickness_m: 0.12, kind: 'interior' },
    ],
    openings: [
      { kind: 'door', position: [1.5, 0], width_m: 0.9, wall_index: 0 },
      { kind: 'window', position: [9, 4], width_m: 1.8, wall_index: 1 },
    ],
    warnings: [note, 'MOCK DATA – not derived from the uploaded file.'],
  };
}

export class MockProvider implements FloorPlanAnalysisProvider {
  readonly name = 'mock';
  async analyze(input: FloorPlanInput) {
    return mockAnalysis('mock', input, 'Mock provider selected (FLOORPLAN_PROVIDER=mock).');
  }
}
