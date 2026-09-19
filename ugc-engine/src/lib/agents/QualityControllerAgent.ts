import { QualityControlEngine } from "@/lib/qc/QualityControlEngine";
import type { ILLMProvider } from "@/lib/llm";
import type { ContinuityBible, QCResult, StoryboardScene } from "@/types/agents";

/** Agent 10 — Quality Controller: thin agent-facing wrapper around QualityControlEngine. */
export class QualityControllerAgent {
  private engine: QualityControlEngine;

  constructor(llm: ILLMProvider) {
    this.engine = new QualityControlEngine(llm);
  }

  public async evaluate(sceneVideoBuffer: Buffer, scene: StoryboardScene, continuity: ContinuityBible): Promise<QCResult> {
    return this.engine.evaluateScene(sceneVideoBuffer, scene, continuity);
  }
}
