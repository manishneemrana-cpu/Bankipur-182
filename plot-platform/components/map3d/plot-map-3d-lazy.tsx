"use client";

import dynamic from "next/dynamic";

import type { MapLayoutData } from "@/lib/data/map";

// Lazy-loaded so the 3D bundle (three.js + fiber) never ships on initial
// page load (§9.5 performance budget) — only fetched when the buyer taps
// "3D".
const PlotMap3DImpl = dynamic(
  () => import("./plot-map-3d").then((m) => m.PlotMap3D),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[60vh] items-center justify-center text-sm text-muted-foreground">
        Loading 3D view…
      </div>
    ),
  },
);

export function PlotMap3DLazy(props: {
  data: MapLayoutData;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
}) {
  return <PlotMap3DImpl {...props} />;
}
