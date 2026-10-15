import React from "react";
import qrcode from "qrcode-generator";
import { AbsoluteFill, Easing, Freeze, Img, OffthreadVideo, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { ScriptSegment, VideoProps } from "@ave/shared-types";
import { CALL_LABEL, CTA_TEXT, FONT_BODY, FONT_HEADING, shade } from "./theme";
import { fitClip } from "./timeline";

const useScale = () => {
  const { width, height } = useVideoConfig();
  const portrait = height > width;
  return { portrait, u: Math.min(width, height) / 1080, width, height };
};

/** Video clip stretched/frozen to fill `slotFrames`; falls back to a gradient if no clip. */
export const ClipSlot: React.FC<{ src: string | null; clipSeconds: number; slotFrames: number; fallback?: React.ReactNode }> = ({ src, clipSeconds, slotFrames, fallback }) => {
  if (!src) return <>{fallback ?? null}</>;
  const { rate, playFrames } = fitClip(clipSeconds, slotFrames);
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={Math.max(1, playFrames)}>
        <OffthreadVideo src={src} muted playbackRate={rate} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </Sequence>
      {playFrames < slotFrames && (
        <Sequence from={playFrames}>
          <Freeze frame={Math.max(0, playFrames - 1)}>
            <OffthreadVideo src={src} muted playbackRate={rate} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </Freeze>
        </Sequence>
      )}
    </AbsoluteFill>
  );
};

/** Local pan/zoom on a still: the zero-cost fallback when no elevation image exists. */
export const KenBurns: React.FC<{ src: string; durationInFrames: number; flip?: boolean }> = ({ src, durationInFrames, flip }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, durationInFrames], [0, 1], { easing: Easing.inOut(Easing.cubic), extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${1.05 + p * 0.2}) translate(${(p - 0.5) * -4 * (flip ? -1 : 1)}%, ${(p - 0.5) * -2.5}%)`, transformOrigin: "50% 50%" }} />
    </AbsoluteFill>
  );
};

/** Photos one after another (each with a slow pan/zoom), optionally preceded by an AI cinematic clip. */
export const PhotoReel: React.FC<{ clipUrl: string | null; clipSeconds: number; slides: string[]; frames: number; fallback: React.ReactNode }> = ({ clipUrl, clipSeconds, slides, frames, fallback }) => {
  if (!clipUrl && !slides.length) return <>{fallback}</>;
  const clipFrames = clipUrl ? (slides.length ? Math.round(frames * 0.4) : frames) : 0;
  const per = slides.length ? Math.floor((frames - clipFrames) / slides.length) : 0;
  return (
    <AbsoluteFill>
      {clipUrl && <Sequence from={0} durationInFrames={clipFrames}><ClipSlot src={clipUrl} clipSeconds={clipSeconds} slotFrames={clipFrames} /></Sequence>}
      {slides.map((src, i) => {
        const last = i === slides.length - 1;
        const dur = last ? frames - clipFrames - per * i : per;
        return (
          <Sequence key={`${i}-${src}`} from={clipFrames + per * i} durationInFrames={dur}>
            <KenBurns src={src} durationInFrames={dur} flip={i % 2 === 1} />
            {(i > 0 || clipUrl) && <FadeEdges inFrames={10} />}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

export const Vignette: React.FC = () => (
  <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%), linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0) 38%)" }} />
);

const Mark: React.FC<{ logoUrl: string | null; name: string; size: number; color: string }> = ({ logoUrl, name, size, color }) =>
  logoUrl ? (
    <Img src={logoUrl} style={{ height: size, maxWidth: size * 3.2, objectFit: "contain" }} />
  ) : (
    <div style={{ fontFamily: FONT_HEADING, fontSize: size * 0.42, fontWeight: 700, color, letterSpacing: 2, textTransform: "uppercase", textAlign: "center" }}>{name}</div>
  );

export const LogoIntro: React.FC<Pick<VideoProps, "logoUrl" | "builderName" | "brandColor" | "accentColor">> = (p) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { u } = useScale();
  const s = spring({ frame, fps, config: { damping: 18, stiffness: 90 } });
  const fadeOut = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const line = interpolate(frame, [8, 30], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 40%, ${shade(p.brandColor, 0.15)}, ${shade(p.brandColor, -0.45)})`, alignItems: "center", justifyContent: "center", opacity: fadeOut }}>
      <div style={{ transform: `scale(${0.85 + 0.15 * s})`, opacity: s, display: "flex", flexDirection: "column", alignItems: "center", gap: 28 * u }}>
        <Mark logoUrl={p.logoUrl} name={p.builderName} size={200 * u} color="#fff" />
        <div style={{ width: 360 * u * line, height: 3 * u, background: p.accentColor }} />
        {p.logoUrl && <div style={{ fontFamily: FONT_BODY, color: "rgba(255,255,255,.8)", fontSize: 34 * u, letterSpacing: 6, textTransform: "uppercase" }}>{p.builderName}</div>}
      </div>
    </AbsoluteFill>
  );
};

/** One sentence at a time, lower-third, fading/sliding in and out in sync with the voiceover. */
export const TextOverlays: React.FC<{ segments: ScriptSegment[]; startFrame: number; accent: string; brand: string }> = ({ segments, startFrame, accent, brand }) => {
  const { fps } = useVideoConfig();
  const { portrait, u } = useScale();
  return (
    <>
      {segments.map((seg, i) => {
        const from = startFrame + Math.round(seg.start * fps) - 3;
        const next = segments[i + 1];
        // end exactly when the next caption starts so cards never overlap (no ghosting)
        const to = next ? startFrame + Math.round(next.start * fps) - 3 : startFrame + Math.round(seg.end * fps) + 12;
        return (
          <Sequence key={i} from={from} durationInFrames={Math.max(12, to - from)}>
            <SegmentCard text={seg.text} accent={accent} brand={brand} portrait={portrait} u={u} />
          </Sequence>
        );
      })}
    </>
  );
};

const SegmentCard: React.FC<{ text: string; accent: string; brand: string; portrait: boolean; u: number }> = ({ text, accent, brand, portrait, u }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const inP = spring({ frame, fps, config: { damping: 20, stiffness: 120 } });
  const out = interpolate(frame, [durationInFrames - 5, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const long = text.length > 70;
  const size = (portrait ? (long ? 58 : 68) : long ? 46 : 54) * u;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: portrait ? "center" : "flex-start", padding: `0 ${(portrait ? 70 : 120) * u}px ${(portrait ? 300 : 120) * u}px` }}>
      <div style={{ opacity: inP * out, transform: `translateY(${(1 - inP) * 28 * u}px)`, maxWidth: portrait ? "100%" : "62%", borderLeft: `${6 * u}px solid ${accent}`, padding: `${18 * u}px ${28 * u}px`, background: `linear-gradient(90deg, ${shade(brand, -0.3)}cc, ${shade(brand, -0.3)}66)`, borderRadius: 6 * u, backdropFilter: "blur(6px)" }}>
        <div style={{ fontFamily: FONT_HEADING, color: "#fff", fontSize: size, lineHeight: 1.25, fontWeight: 600, textShadow: "0 2px 12px rgba(0,0,0,.45)" }}>{text}</div>
      </div>
    </AbsoluteFill>
  );
};

/** Project title chip shown top-left throughout the content section. */
export const TitleBug: React.FC<{ name: string; tagline: string; accent: string }> = ({ name, tagline, accent }) => {
  const frame = useCurrentFrame();
  const { u, portrait } = useScale();
  const o = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ padding: `${(portrait ? 90 : 56) * u}px ${(portrait ? 60 : 80) * u}px`, opacity: o }}>
      <div style={{ fontFamily: FONT_HEADING, color: "#fff", fontSize: 44 * u, fontWeight: 700, textShadow: "0 2px 10px rgba(0,0,0,.6)" }}>{name}</div>
      {tagline && <div style={{ fontFamily: FONT_BODY, color: accent, fontSize: 26 * u, letterSpacing: 4, textTransform: "uppercase", marginTop: 6 * u, textShadow: "0 2px 8px rgba(0,0,0,.6)" }}>{tagline}</div>}
    </AbsoluteFill>
  );
};

/** Cross-fade to black used at section boundaries. */
export const FadeEdges: React.FC<{ inFrames?: number; outFrames?: number }> = ({ inFrames = 0, outFrames = 0 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const a = inFrames ? interpolate(frame, [0, inFrames], [1, 0], { extrapolateRight: "clamp" }) : 0;
  const b = outFrames ? interpolate(frame, [durationInFrames - outFrames, durationInFrames], [0, 1], { extrapolateLeft: "clamp" }) : 0;
  return <AbsoluteFill style={{ background: "#000", opacity: Math.max(a, b) }} />;
};

export const Outro: React.FC<Pick<VideoProps, "logoUrl" | "builderName" | "projectName" | "contactNumber" | "brandColor" | "accentColor" | "ctaText" | "language" | "twinUrl">> = (p) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u } = useScale();
  const s = (d: number) => spring({ frame: frame - d, fps, config: { damping: 18, stiffness: 100 } });
  const cta = p.ctaText && p.ctaText !== "Book a site visit" ? p.ctaText : CTA_TEXT[p.language];
  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${shade(p.brandColor, 0.08)}, ${shade(p.brandColor, -0.5)})`, alignItems: "center", justifyContent: "center", gap: 34 * u, flexDirection: "column", textAlign: "center", padding: 60 * u }}>
      <div style={{ opacity: s(0), transform: `translateY(${(1 - s(0)) * 30}px)` }}><Mark logoUrl={p.logoUrl} name={p.builderName} size={170 * u} color="#fff" /></div>
      <div style={{ opacity: s(8), fontFamily: FONT_HEADING, color: "#fff", fontSize: 70 * u, fontWeight: 700 }}>{p.projectName}</div>
      <div style={{ opacity: s(16), background: p.accentColor, color: shade(p.brandColor, -0.6), fontFamily: FONT_BODY, fontWeight: 700, fontSize: 44 * u, padding: `${20 * u}px ${54 * u}px`, borderRadius: 100, transform: `scale(${0.9 + 0.1 * s(16)})` }}>{cta}</div>
      {p.contactNumber && (
        <div style={{ opacity: s(24), fontFamily: FONT_BODY, color: "#fff" }}>
          <div style={{ fontSize: 28 * u, letterSpacing: 5, textTransform: "uppercase", color: p.accentColor }}>{CALL_LABEL[p.language]}</div>
          <div style={{ fontSize: 66 * u, fontWeight: 600, letterSpacing: 2 }}>{p.contactNumber}</div>
        </div>
      )}
      {p.twinUrl && (
        <div style={{ opacity: s(32), display: "flex", flexDirection: "column", alignItems: "center", gap: 14 * u, fontFamily: FONT_BODY, color: "#fff" }}>
          <div style={{ background: "#fff", padding: 16 * u, borderRadius: 16 * u }}><QrCode value={p.twinUrl} size={230 * u} /></div>
          <div style={{ fontSize: 26 * u, letterSpacing: 4, textTransform: "uppercase", color: p.accentColor }}>{TWIN_LABEL[p.language]}</div>
          <div style={{ fontSize: 28 * u, opacity: 0.9 }}>{p.twinUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}</div>
        </div>
      )}
    </AbsoluteFill>
  );
};

const TWIN_LABEL: Record<VideoProps["language"], string> = {
  en: "Scan for the 3D tour",
  hi: "3D टूर के लिए स्कैन करें",
  hinglish: "3D tour ke liye scan karein",
};

/** Inline-SVG QR code (no network, renders identically in headless Chromium). */
const QrCode: React.FC<{ value: string; size: number }> = ({ value, size }) => {
  const qr = qrcode(0, "M");
  qr.addData(value);
  qr.make();
  const n = qr.getModuleCount();
  const cells: React.ReactNode[] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) cells.push(<rect key={`${r}-${c}`} x={c} y={r} width={1.02} height={1.02} />);
  return <svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges" fill="#000">{cells}</svg>;
};
