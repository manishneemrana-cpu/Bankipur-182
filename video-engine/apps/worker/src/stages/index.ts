import type { Stage } from "@ave/shared-types";
import type { StageHandler } from "../pipeline/types.js";
import { voiceoverStage } from "./voiceover.js";
import { renderStage } from "./render.js";
import { mapStage } from "./map.js";
import { cinematicStage } from "./cinematic.js";


export const handlers: Record<Stage, StageHandler> = {
  voiceover: voiceoverStage,
  map: mapStage,
  cinematic: cinematicStage,
  render: renderStage,
};
