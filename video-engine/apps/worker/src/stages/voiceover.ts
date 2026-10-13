import { mediaDurationFromBytes } from "../lib/duration.js";
import { storage } from "../lib/storage.js";
import type { StageHandler } from "../pipeline/types.js";
import { generateScript } from "../script/index.js";
import { createVoiceoverProvider } from "../providers/voiceover/index.js";
import { repo } from "../lib/repo.js";
import { config } from "../config.js";
import { estimateSegments, segmentsFromAlignment } from "./timing.js";
import { log } from "../lib/logger.js";

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
  const { audioUrl, alignment } = provider.generateWithAlignment
    ? await provider.generateWithAlignment(script.text, input.language, voiceId)
    : { audioUrl: await provider.generate(script.text, input.language, voiceId), alignment: undefined };
  await ctx.progress(70);

  const duration = await mediaDurationFromBytes(await storage.fetchBytes(audioUrl), ext);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error(`Could not determine voiceover duration for ${audioUrl} (.${ext})`);

  const exact = alignment ? segmentsFromAlignment(script.sentences, script.text, alignment, duration) : null;
  if (alignment && !exact) log.warn({ projectId: ctx.project.id }, "TTS alignment didn't match script text; using estimated sentence timings");
  await repo.patchProject(ctx.project.id, {
    assets: {
      voiceoverUrl: audioUrl,
      voiceoverDuration: Math.round(duration * 1000) / 1000,
      segments: exact ?? estimateSegments(script.sentences, duration),
    },
  });
  await ctx.progress(100);
};
