import { mediaDurationFromBytes } from "../lib/duration.js";
import { storage } from "../lib/storage.js";
import type { StageHandler } from "../pipeline/types.js";
import { generateScript } from "../script/index.js";
import { createVoiceoverProvider } from "../providers/voiceover/index.js";
import { repo } from "../lib/repo.js";
import { config } from "../config.js";
import { estimateSegments } from "./timing.js";

/** Stage 1 — script (template or custom) -> TTS via the VoiceoverProvider adapter -> stored audio + duration. */
export const voiceoverStage: StageHandler = async (ctx) => {
  const { input } = ctx.project;
  const providerId = ctx.settings.providers.tts;
  await ctx.setProvider(providerId);

  const script = generateScript(input);
  await repo.patchProject(ctx.project.id, {
    assets: { script: script.text, scriptTemplateId: script.templateId, scriptSentences: script.sentences },
  });
  await ctx.progress(20);

  let ext = "mp3";
  const provider = createVoiceoverProvider(providerId, (bytes, e, mime) => {
    ext = e;
    return ctx.save(`voiceover.${e}`, bytes, mime);
  });
  const voiceId = ctx.settings.providers.voiceId || config.ELEVENLABS_VOICE_ID;
  const audioUrl = await provider.generate(script.text, input.language, voiceId);
  await ctx.progress(70);

  const duration = await mediaDurationFromBytes(await storage.fetchBytes(audioUrl), ext);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error(`Could not determine voiceover duration for ${audioUrl} (.${ext})`);

  await repo.patchProject(ctx.project.id, {
    assets: {
      voiceoverUrl: audioUrl,
      voiceoverDuration: Math.round(duration * 1000) / 1000,
      segments: estimateSegments(script.sentences, duration),
    },
  });
  await ctx.progress(100);
};
