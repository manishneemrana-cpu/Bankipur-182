import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

/** Static stand-in clips used before the real map/cinematic stages are wired (and by the mock providers). */
export const PlaceholderClip: React.FC<{ kind: "map" | "building"; label?: string }> = ({ kind, label }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const p = frame / durationInFrames;
  const u = Math.min(width, height) / 1080;
  const bg = kind === "map" ? ["#0d2a3a", "#164e63"] : ["#2b1d3a", "#7c4a2d"];
  return (
    <AbsoluteFill style={{ background: `linear-gradient(${120 + p * 60}deg, ${bg[0]}, ${bg[1]})`, overflow: "hidden" }}>
      {kind === "map"
        ? Array.from({ length: 14 }).map((_, i) => (
            <div key={i} style={{ position: "absolute", left: 0, right: 0, top: `${(i * 7.5 + p * 12) % 100}%`, height: 2 * u, background: "rgba(255,255,255,.12)" }} />
          ))
        : Array.from({ length: 7 }).map((_, i) => (
            <div key={i} style={{ position: "absolute", bottom: 0, left: `${8 + i * 13}%`, width: `${9}%`, height: `${30 + ((i * 37) % 40) + p * 20}%`, background: "rgba(255,255,255,.10)", border: "1px solid rgba(255,255,255,.2)" }} />
          ))}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,.75)", fontFamily: "sans-serif", fontSize: 54 * u, letterSpacing: 6, textTransform: "uppercase", opacity: interpolate(p, [0, 0.1], [0, 1], { extrapolateRight: "clamp" }) }}>
        {label ?? (kind === "map" ? "Map flyby placeholder" : "Cinematic placeholder")}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
