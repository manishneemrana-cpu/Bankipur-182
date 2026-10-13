import type { Stage } from "@ave/shared-types";
import type { StageHandler } from "../pipeline/types.js";
import { voiceoverStage } from "./voiceover.js";
import { renderStage } from "./render.js";

const todo = (name: string): StageHandler => async (ctx) => { await ctx.skip(`${name} not built yet`); };

export const handlers: Record<Stage, StageHandler> = {
  voiceover: voiceoverStage,
  map: todo("map"),
  cinematic: todo("cinematic"),
  render: renderStage,
};
