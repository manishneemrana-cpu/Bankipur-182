import type { IVideoProviderAdapter } from "@/lib/providers/video/VideoProviderInterface";

export interface CostEstimate {
  videoCostUsd: number;
  voiceCostUsd: number;
  qcCostUsd: number;
  renderCostUsd: number;
  totalCostUsd: number;
}

const QC_COST_PER_SCENE_USD = 0.02; // multimodal QC evaluation call
const RENDER_COST_PER_SECOND_USD = 0.005; // compute time for FFmpeg pass
const VOICE_COST_PER_CHARACTER_USD = 0.00003;

export class CostEngine {
  static estimateProjectCost(params: {
    totalDurationSeconds: number;
    sceneCount: number;
    scriptCharacterCount: number;
    videoProvider: IVideoProviderAdapter;
    maxQcRetriesPerScene: number;
  }): CostEstimate {
    const videoCostUsd = params.totalDurationSeconds * params.videoProvider.costPerSecondUsd * params.maxQcRetriesPerScene;
    const voiceCostUsd = params.scriptCharacterCount * VOICE_COST_PER_CHARACTER_USD;
    const qcCostUsd = params.sceneCount * params.maxQcRetriesPerScene * QC_COST_PER_SCENE_USD;
    const renderCostUsd = params.totalDurationSeconds * RENDER_COST_PER_SECOND_USD;

    return {
      videoCostUsd: round(videoCostUsd),
      voiceCostUsd: round(voiceCostUsd),
      qcCostUsd: round(qcCostUsd),
      renderCostUsd: round(renderCostUsd),
      totalCostUsd: round(videoCostUsd + voiceCostUsd + qcCostUsd + renderCostUsd),
    };
  }

  /** Regenerating one locked-out scene costs only that scene, never the whole project (spec #33/#12). */
  static estimateSceneRegenerationCost(durationSeconds: number, videoProvider: IVideoProviderAdapter, maxRetries: number): number {
    return round(durationSeconds * videoProvider.costPerSecondUsd * maxRetries + QC_COST_PER_SCENE_USD * maxRetries);
  }
}

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}
