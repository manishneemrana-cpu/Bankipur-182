import type { FloorPlanAnalysis } from '@dt/shared-types';

export interface FloorPlanInput {
  /** Path to the uploaded plan image/PDF on local disk. */
  filePath: string;
  fileName: string;
}

/**
 * Adapter port for "2D floor plan → structured room/wall data".
 * Output is a REFERENCE for the 3D artist (trace in Blender/SketchUp). It is never published to the viewer automatically.
 */
export interface FloorPlanAnalysisProvider {
  readonly name: string;
  analyze(input: FloorPlanInput): Promise<FloorPlanAnalysis>;
}
