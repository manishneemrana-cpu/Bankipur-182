"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  TransformComponent,
  TransformWrapper,
  type ReactZoomPanPinchRef,
} from "react-zoom-pan-pinch";

import { bbox, shrinkRingTowardCentroid } from "@/lib/geometry/polygon";
import { edgeDimensions } from "@/lib/geometry/dimensions";
import type { MapLayoutData, MapPlot } from "@/lib/data/map";
import { statusStyle, PLOT_STATUSES } from "@/lib/map/status-colors";

import { Compass } from "./compass";
import { Legend } from "./legend";
import { PlotDetailPanel, type PlotShareContext } from "./plot-detail-panel";

const ZONE_FILL: Record<string, string> = {
  park: "#a3d9a5",
  amenity: "#f0c987",
  commercial: "#cbb2e0",
  residential: "#e7e9ec",
  utility: "#c7ccd1",
  gate_entry: "#3a3f47",
  gate_exit: "#3a3f47",
  water: "#9cc9e8",
  other: "#dde1e5",
};

// A small rendered gap between adjacent plots (§22 premium look) — purely
// visual, computed per-polygon toward its own centroid.
const PLOT_INSET = 0.92;

function ring(poly: MapPlot["geometry"]): string {
  const pts = poly.coordinates[0] ?? [];
  return pts.map(([x, y]) => `${x},${y}`).join(" ");
}

function insetRing(poly: MapPlot["geometry"]): string {
  const pts = poly.coordinates[0] ?? [];
  return shrinkRingTowardCentroid(pts, PLOT_INSET)
    .map(([x, y]) => `${x},${y}`)
    .join(" ");
}

export function PlotMap({
  data,
  highlightIds,
  selectedId: controlledSelectedId,
  onSelect,
  zoomToPlotId,
  shareContext,
}: {
  data: MapLayoutData;
  /** When set (even empty), non-matching plots dim and matches get a match count (§10). */
  highlightIds?: Set<string> | null;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  /** Deep link (§13): auto-zoom to and select this plot on mount. */
  zoomToPlotId?: string | null;
  shareContext?: PlotShareContext;
}) {
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(
    zoomToPlotId ?? null,
  );
  const selectedId =
    controlledSelectedId !== undefined
      ? controlledSelectedId
      : internalSelectedId;
  const setSelectedId = onSelect ?? setInternalSelectedId;
  const [scale, setScale] = useState(1);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const transformRef = useRef<ReactZoomPanPinchRef>(null);

  useEffect(() => {
    if (!zoomToPlotId) return;
    const id = window.setTimeout(() => {
      transformRef.current?.zoomToElement(`plot-${zoomToPlotId}`, 3, 400);
    }, 50);
    return () => window.clearTimeout(id);
    // Only re-run if the deep-linked plot itself changes.
  }, [zoomToPlotId]);

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
  const shortSide = Number.isFinite(box.minX)
    ? Math.min(box.maxX - box.minX, box.maxY - box.minY)
    : 100;

  const selected = data.plots.find((p) => p.id === selectedId) ?? null;
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of data.plots) c[p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [data.plots]);

  return (
    <div className="flex min-h-[70vh] flex-col sm:flex-row">
      <div
        className="relative min-h-[50vh] flex-1 overflow-hidden"
        style={{
          backgroundColor: "var(--color-muted)",
          backgroundImage:
            "radial-gradient(color-mix(in oklch, var(--color-foreground) 8%, transparent) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
        }}
      >
        <TransformWrapper
          ref={transformRef}
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
                  className="rounded-full border border-black/5 bg-background/85 px-3 py-1.5 text-xs font-medium shadow-md ring-1 ring-black/5 backdrop-blur-sm transition hover:bg-background"
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
                  <defs>
                    <filter
                      id="plot-shadow"
                      x="-40%"
                      y="-40%"
                      width="180%"
                      height="180%"
                    >
                      <feDropShadow
                        dx="0"
                        dy={shortSide * 0.002}
                        stdDeviation={shortSide * 0.003}
                        floodColor="#0f172a"
                        floodOpacity="0.35"
                      />
                    </filter>
                    <linearGradient id="road-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#565f6b" />
                      <stop offset="100%" stopColor="#3c434c" />
                    </linearGradient>
                  </defs>

                  {data.zones.map((z) => (
                    <polygon
                      key={z.id}
                      points={ring(z.geometry)}
                      fill={
                        z.kind === "boundary"
                          ? "none"
                          : (ZONE_FILL[z.kind] ?? ZONE_FILL.other)
                      }
                      stroke={z.kind === "boundary" ? "#4b5563" : "none"}
                      strokeWidth={z.kind === "boundary" ? 1.6 / scale : 0}
                      strokeDasharray={
                        z.kind === "boundary"
                          ? `${6 / scale} ${4 / scale}`
                          : undefined
                      }
                      strokeLinejoin="round"
                    />
                  ))}
                  {data.roads.map((r) => (
                    <polygon
                      key={r.id}
                      points={ring(r.geometry)}
                      fill="url(#road-fill)"
                      strokeLinejoin="round"
                    />
                  ))}
                  {data.plots.map((p) => {
                    const style = statusStyle(p.status);
                    const isSelected = p.id === selectedId;
                    const isHovered = p.id === hoveredId;
                    const isMatch = !highlightIds || highlightIds.has(p.id);
                    const labelFontSize = Math.max(2.6, 3.4 / Math.sqrt(scale));
                    return (
                      <g
                        key={p.id}
                        filter={
                          isSelected || isHovered
                            ? "url(#plot-shadow)"
                            : undefined
                        }
                        style={{ transition: "opacity 150ms ease" }}
                      >
                        <polygon
                          id={`plot-${p.id}`}
                          points={insetRing(p.geometry)}
                          fill={style.fill}
                          stroke={
                            isSelected ? "var(--color-primary)" : style.stroke
                          }
                          strokeWidth={
                            isSelected
                              ? 3 / scale
                              : isHovered
                                ? 1.8 / scale
                                : 1 / scale
                          }
                          strokeLinejoin="round"
                          opacity={isMatch ? 1 : 0.22}
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
                          onPointerEnter={() => setHoveredId(p.id)}
                          onPointerLeave={() => setHoveredId(null)}
                          style={{
                            cursor: "pointer",
                            transform: isHovered ? "scale(1.02)" : undefined,
                            transformOrigin: `${p.centroid_x ?? 0}px ${p.centroid_y ?? 0}px`,
                            transition:
                              "transform 150ms ease, stroke-width 150ms ease",
                          }}
                        />
                        {p.centroid_x != null &&
                        p.centroid_y != null &&
                        isMatch ? (
                          <text
                            x={p.centroid_x}
                            y={p.centroid_y}
                            fontSize={labelFontSize}
                            fontWeight={600}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fill="#ffffff"
                            stroke="#00000055"
                            strokeWidth={0.6 / scale}
                            paintOrder="stroke"
                            className="pointer-events-none select-none"
                          >
                            {p.plot_number}
                          </text>
                        ) : null}
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
                                stroke="#ffffff"
                                strokeWidth={0.8 / scale}
                                paintOrder="stroke"
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
        {highlightIds ? (
          <div className="absolute top-2 left-1/2 z-10 -translate-x-1/2 rounded-full border border-black/5 bg-background/85 px-3.5 py-1.5 text-xs font-medium shadow-md ring-1 ring-black/5 backdrop-blur-sm">
            {highlightIds.size} matching plot
            {highlightIds.size === 1 ? "" : "s"}
          </div>
        ) : null}
      </div>

      <PlotDetailPanel
        plot={selected}
        unit={data.unit}
        onClose={() => setSelectedId(null)}
        shareContext={shareContext}
      />
    </div>
  );
}
