import React from "react";
import { Composition } from "remotion";
import { FPS, type VideoProps } from "@ave/shared-types";
import { RealEstateVideo } from "./RealEstateVideo";
import { PlaceholderClip } from "./PlaceholderClip";
import { computeTimeline } from "./timeline";

import { COMPOSITION_IDS } from "./ids";
export { COMPOSITION_IDS };

export const defaultProps: VideoProps = {
  projectName: "Skyline Heights",
  tagline: "Rise above the ordinary",
  builderName: "Bankipur Group",
  mapClipUrl: null,
  mapClipDuration: 0,
  cinematicClipUrl: null,
  cinematicClipDuration: 0,
  kenBurnsImageUrl: null,
  voiceoverUrl: null,
  voiceoverDuration: 20,
  logoUrl: null,
  brandColor: "#0B1F3A",
  accentColor: "#C9A24B",
  contactNumber: "+91 98765 43210",
  segments: [
    { text: "Introducing Skyline Heights by Bankipur Group.", start: 0, end: 4 },
    { text: "Located in Sector 150, Noida.", start: 4.3, end: 8 },
    { text: "Book your site visit today.", start: 8.3, end: 12 },
  ],
  musicTrack: "regal",
  musicUrl: null,
  ctaText: "Book a site visit",
  language: "en",
  twinUrl: "https://digital-twin-viewer-three.vercel.app/",
};

const calc = async ({ props }: { props: VideoProps }) => ({ durationInFrames: computeTimeline(props).totalFrames, props });

export const Root: React.FC = () => (
  <>
    <Composition id={COMPOSITION_IDS.portrait} component={RealEstateVideo} width={1080} height={1920} fps={FPS} durationInFrames={FPS * 20} defaultProps={defaultProps} calculateMetadata={calc} />
    <Composition id={COMPOSITION_IDS.landscape} component={RealEstateVideo} width={1920} height={1080} fps={FPS} durationInFrames={FPS * 20} defaultProps={defaultProps} calculateMetadata={calc} />
    <Composition id="Placeholder-map" component={PlaceholderClip} width={1080} height={1920} fps={FPS} durationInFrames={FPS * 8} defaultProps={{ kind: "map" as const }} />
    <Composition id="Placeholder-building" component={PlaceholderClip} width={1080} height={1920} fps={FPS} durationInFrames={FPS * 6} defaultProps={{ kind: "building" as const }} />
  </>
);
