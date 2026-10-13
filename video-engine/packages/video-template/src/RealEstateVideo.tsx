import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import type { VideoProps } from "@ave/shared-types";
import { ClipSlot, FadeEdges, KenBurns, LogoIntro, Outro, TextOverlays, TitleBug, Vignette } from "./components";
import { computeTimeline, musicVolume } from "./timeline";
import { fontCss } from "./theme";

/**
 * Timeline:
 *   0 ─ intro (logo, 1.5s) ─ content [map flyby 60% | cinematic 40%] w/ synced text + voiceover ─ outro (logo + contact + CTA)
 * Background music ducks under the voiceover automatically (see musicVolume).
 */
export const RealEstateVideo: React.FC<VideoProps> = (p) => {
  const t = computeTimeline(p);
  const contentFrom = t.introFrames;
  const music = p.musicUrl ?? staticFile(`music/${p.musicTrack}.wav`);

  const cinematic = p.cinematicClipUrl ? (
    <ClipSlot src={p.cinematicClipUrl} clipSeconds={p.cinematicClipDuration} slotFrames={t.cinematicFrames} />
  ) : p.kenBurnsImageUrl ? (
    <KenBurns src={p.kenBurnsImageUrl} durationInFrames={t.cinematicFrames} />
  ) : (
    <AbsoluteFill style={{ background: `linear-gradient(135deg, ${p.brandColor}, #000)` }} />
  );

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <style>{fontCss()}</style>

      <Sequence from={0} durationInFrames={t.introFrames}>
        <LogoIntro logoUrl={p.logoUrl} builderName={p.builderName} brandColor={p.brandColor} accentColor={p.accentColor} />
      </Sequence>

      <Sequence from={contentFrom} durationInFrames={t.mapFrames}>
        <ClipSlot src={p.mapClipUrl} clipSeconds={p.mapClipDuration} slotFrames={t.mapFrames} fallback={<AbsoluteFill style={{ background: p.brandColor }} />} />
        <FadeEdges inFrames={12} />
      </Sequence>
      <Sequence from={contentFrom + t.mapFrames} durationInFrames={t.cinematicFrames}>
        {cinematic}
        <FadeEdges inFrames={15} outFrames={12} />
      </Sequence>

      <Sequence from={contentFrom} durationInFrames={t.contentFrames}>
        <Vignette />
        <TitleBug name={p.projectName} tagline={p.tagline} accent={p.accentColor} />
      </Sequence>
      <TextOverlays segments={p.segments} startFrame={t.voiceStartFrame} accent={p.accentColor} brand={p.brandColor} />

      <Sequence from={contentFrom + t.contentFrames} durationInFrames={t.outroFrames}>
        <Outro {...p} />
      </Sequence>

      {p.voiceoverUrl && (
        <Sequence from={t.voiceStartFrame} durationInFrames={Math.ceil(p.voiceoverDuration * t.fps) + 2}>
          <Audio src={p.voiceoverUrl} volume={1} />
        </Sequence>
      )}
      <Audio src={music} loop volume={(f) => musicVolume(f, t)} />
    </AbsoluteFill>
  );
};
