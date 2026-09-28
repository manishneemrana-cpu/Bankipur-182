"use client";

import { useMemo, useState } from "react";
import {
  TransformComponent,
  TransformWrapper,
  type ReactZoomPanPinchRef,
} from "react-zoom-pan-pinch";

import { bbox } from "@/lib/geometry/polygon";
import { edgeDimensions } from "@/lib/geometry/dimensions";
import type { MapLayoutData, MapPlot } from "@/lib/data/map";
import { statusStyle, PLOT_STATUSES } from "@/lib/map/status-colors";

import { Compass } from "./compass";
import { Legend } from "./legend";
import { PlotDetailPanel } from "./plot-detail-panel";

const ZONE_FILL: Record<string, string> = {
  park: "#bbe4b4",
  amenity: "#f5d6a8",
  commercial: "#d9c2e8",
  residential: "#e5e5e5",
  utility: "#c9c9c9",
  gate_entry: "#333333",
  gate_exit: "#333333",
  water: "#a9d3e8",
  other: "#dddddd",
};

function ring(poly: MapPlot["geometry"]): string {
  const pts = poly.coordinates[0] ?? [];
  return pts.map(([x, y]) => `${x},${y}`).join(" ");
}

export function PlotMap({ data }: { data: MapLayoutData }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scale, setScale] = useState(1);

  const box = useMemo(
    () =>
      bbox([
        ...data.plots.map((p) => p.geometry),
        ...data.roads.map((r) => r.geometry),
      ]),
    [data],
  );
  const pad = 20;
  const viewBox = Number.isFinite(box.minX)
    ? `${box.minX - pad} ${box.minY - pad} ${box.maxX - box.minX + pad * 2} ${box.maxY - box.minY + pad * 2}`
    : "0 0 100 100";

  const selected = data.plots.find((p) => p.id === selectedId) ?? null;
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of data.plots) c[p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [data.plots]);

  return (
    <div className="flex min-h-[70vh] flex-col sm:flex-row">
      <div className="relative min-h-[50vh] flex-1 overflow-hidden bg-slate-50 dark:bg-slate-900">
        <TransformWrapper
          minScale={0.3}
          maxScale={12}
          doubleClick={{ mode: "zoomIn" }}
          onTransform={(_ref: ReactZoomPanPinchRef, state: { scale: number }) =>
            setScale(state.scale)
          }
        >
          {({ resetTransform, zoomIn }) => (
            <>
              <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => resetTransform()}
                  className="rounded-md border border-input bg-background/90 px-2 py-1 text-xs shadow-sm"
                >
                  Fit to project
                </button>
              </div>
              <Compass northAngleDeg={data.northAngleDeg} />
              <TransformComponent
                wrapperClass="!w-full !h-full"
                contentClass="!w-full !h-full"
              >
                <svg
                  viewBox={viewBox}
                  className="h-[70vh] w-full min-w-[600px] touch-none select-none"
                  role="group"
                  aria-label="Plot layout map"
                >
                  {data.zones.map((z) => (
                    <polygon
                      key={z.id}
                      points={ring(z.geometry)}
                      fill={
                        z.kind === "boundary"
                          ? "none"
                          : (ZONE_FILL[z.kind] ?? ZONE_FILL.other)
                      }
                      stroke={z.kind === "boundary" ? "#666" : "none"}
                      strokeWidth={z.kind === "boundary" ? 2 : 0}
                    />
                  ))}
                  {data.roads.map((r) => (
                    <g key={r.id}>
                      <polygon
                        points={ring(r.geometry)}
                        fill="#4b4b4b"
                        opacity={0.85}
                      />
                    </g>
                  ))}
                  {data.plots.map((p) => {
                    const style = statusStyle(p.status);
                    const isSelected = p.id === selectedId;
                    return (
                      <g key={p.id}>
                        <polygon
                          points={ring(p.geometry)}
                          fill={style.fill}
                          stroke={isSelected ? "#111827" : style.stroke}
                          strokeWidth={isSelected ? 2.5 / scale : 0.8 / scale}
                          tabIndex={0}
                          role="button"
                          aria-label={`Plot ${p.plot_number}, ${p.area_official_value ?? "area not provided"} ${p.area_official_unit ?? ""}, ${p.facing} facing, ${style.label.toLowerCase()}`}
                          onClick={() => setSelectedId(p.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelectedId(p.id);
                            }
                          }}
                          style={{ cursor: "pointer" }}
                        />
                        {isSelected
                          ? edgeDimensions(p.geometry).map((d, i) => (
                              <text
                                key={i}
                                x={d.labelPos[0]}
                                y={d.labelPos[1]}
                                fontSize={3.2 / Math.sqrt(scale)}
                                textAnchor="middle"
                                transform={`rotate(${d.angleDeg} ${d.labelPos[0]} ${d.labelPos[1]})`}
                                fill="#111827"
                                className="pointer-events-none select-none"
                              >
                                {d.lengthLayoutUnits.toFixed(1)} ft
                              </text>
                            ))
                          : null}
                      </g>
                    );
                  })}
                </svg>
              </TransformComponent>
              <div className="absolute bottom-2 left-2 z-10">
                <button
                  type="button"
                  onClick={() => zoomIn()}
                  className="sr-only"
                  aria-hidden
                >
                  Zoom in
                </button>
              </div>
            </>
          )}
        </TransformWrapper>
        <Legend counts={counts} statuses={PLOT_STATUSES} />
      </div>

      <PlotDetailPanel
        plot={selected}
        unit={data.unit}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
