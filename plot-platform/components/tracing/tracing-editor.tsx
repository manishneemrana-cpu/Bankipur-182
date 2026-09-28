"use client";

import { useMemo, useState } from "react";

import {
  publishLayout,
  saveCalibration,
} from "@/app/(admin)/dashboard/projects/[projectId]/layout/actions";
import {
  deleteTracedFeature,
  saveTracedPlot,
  saveTracedRoad,
  saveTracedZone,
} from "@/app/(admin)/dashboard/projects/[projectId]/layout/[versionId]/actions";
import type {
  LayoutVersionDetail,
  TracedPlot,
  TracedRoad,
  TracedZone,
} from "@/lib/data/layout";
import type { Point, Polygon } from "@/lib/geometry/types";

type Tool = "select" | "calibrate" | "plot" | "road" | "zone";

function ringToPoints(poly: Polygon): string {
  return (poly.coordinates[0] ?? []).map(([x, y]) => `${x},${y}`).join(" ");
}

/** Converts an already-calibrated (real-world-unit) polygon back into the
 * source image's pixel space, for overlaying previously traced features. */
function toPixelPolygon(poly: Polygon, unitsPerPx: number): Polygon {
  if (!unitsPerPx) return poly;
  return {
    type: "Polygon",
    coordinates: poly.coordinates.map((ring) =>
      ring.map(([x, y]): Point => [x / unitsPerPx, y / unitsPerPx]),
    ),
  };
}

const ZONE_KINDS = [
  "park",
  "amenity",
  "commercial",
  "residential",
  "utility",
  "gate_entry",
  "gate_exit",
  "boundary",
  "water",
  "other",
];

export function TracingEditor({
  projectId,
  layoutVersion,
  plots,
  roads,
  zones,
}: {
  projectId: string;
  layoutVersion: LayoutVersionDetail;
  plots: TracedPlot[];
  roads: TracedRoad[];
  zones: TracedZone[];
}) {
  const [tool, setTool] = useState<Tool>(
    layoutVersion.calibration.scale_units_per_px ? "plot" : "calibrate",
  );
  const [draftPoints, setDraftPoints] = useState<Point[]>([]);
  const [calibPoints, setCalibPoints] = useState<Point[]>([]);
  const [realDistance, setRealDistance] = useState("");
  const [unit, setUnit] = useState<"ft" | "m">("ft");
  const [northAngle, setNorthAngle] = useState(
    String(layoutVersion.calibration.north_angle_deg ?? 0),
  );
  const [pendingPlot, setPendingPlot] = useState<{
    geometry: Polygon;
    roadFacing: Set<number>;
  } | null>(null);
  const [plotNumber, setPlotNumber] = useState("");
  const [zoneKind, setZoneKind] = useState("park");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const unitsPerPx = layoutVersion.calibration.scale_units_per_px ?? 0;
  const calibrated = unitsPerPx > 0;

  const existingPlotPolys = useMemo(
    () =>
      plots
        .filter((p) => p.geometry)
        .map((p) => ({
          id: p.id,
          label: p.plot_number,
          poly: toPixelPolygon(p.geometry!, unitsPerPx),
        })),
    [plots, unitsPerPx],
  );
  const existingRoadPolys = useMemo(
    () =>
      roads.map((r) => ({
        id: r.id,
        poly: toPixelPolygon(r.geometry, unitsPerPx),
      })),
    [roads, unitsPerPx],
  );
  const existingZonePolys = useMemo(
    () =>
      zones.map((z) => ({
        id: z.id,
        poly: toPixelPolygon(z.geometry, unitsPerPx),
      })),
    [zones, unitsPerPx],
  );

  function handleSvgClick(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const viewBox = svg.viewBox.baseVal;
    const x =
      viewBox.x + ((e.clientX - rect.left) / rect.width) * viewBox.width;
    const y =
      viewBox.y + ((e.clientY - rect.top) / rect.height) * viewBox.height;

    if (tool === "calibrate") {
      setCalibPoints((prev) =>
        prev.length >= 2 ? [[x, y]] : [...prev, [x, y]],
      );
      return;
    }
    if (tool === "plot" || tool === "road" || tool === "zone") {
      setDraftPoints((prev) => [...prev, [x, y]]);
    }
  }

  function closePolygon() {
    if (draftPoints.length < 3) {
      setMessage("A polygon needs at least 3 points.");
      return;
    }
    const geometry: Polygon = {
      type: "Polygon",
      coordinates: [[...draftPoints, draftPoints[0]!]],
    };
    if (tool === "plot") {
      setPendingPlot({ geometry, roadFacing: new Set() });
    } else if (tool === "road") {
      void saveRoad(geometry);
    } else if (tool === "zone") {
      void saveZone(geometry);
    }
    setDraftPoints([]);
  }

  async function saveCalibrationStep() {
    if (calibPoints.length < 2) {
      setMessage("Click two points on the image first.");
      return;
    }
    const dist = Number(realDistance);
    if (!dist || dist <= 0) {
      setMessage("Enter the real distance between the two points.");
      return;
    }
    const [p1, p2] = calibPoints;
    const dx = p2![0] - p1![0];
    const dy = p2![1] - p1![1];
    const pxDist = Math.hypot(dx, dy);
    if (pxDist === 0) {
      setMessage("The two points can't be the same spot.");
      return;
    }
    setBusy(true);
    const result = await saveCalibration(layoutVersion.id, projectId, {
      scaleUnitsPerPx: dist / pxDist,
      unit,
      northAngleDeg: Number(northAngle) || 0,
    });
    setBusy(false);
    setMessage(result.error ?? "Calibration saved.");
    if (!result.error) {
      setCalibPoints([]);
      setTool("plot");
    }
  }

  async function saveRoad(geometry: Polygon) {
    setBusy(true);
    const result = await saveTracedRoad(layoutVersion.id, projectId, {
      rawGeometry: geometry,
    });
    setBusy(false);
    setMessage(result.error ?? "Road saved.");
  }

  async function saveZone(geometry: Polygon) {
    setBusy(true);
    const result = await saveTracedZone(layoutVersion.id, projectId, {
      rawGeometry: geometry,
      kind: zoneKind,
    });
    setBusy(false);
    setMessage(result.error ?? "Zone saved.");
  }

  async function confirmPlot() {
    if (!pendingPlot || !plotNumber.trim()) {
      setMessage("Enter a plot number.");
      return;
    }
    setBusy(true);
    const result = await saveTracedPlot(layoutVersion.id, projectId, {
      plotNumber: plotNumber.trim(),
      rawGeometry: pendingPlot.geometry,
      roadFacingEdgeIndices: [...pendingPlot.roadFacing],
    });
    setBusy(false);
    setMessage(result.error ?? `Plot ${plotNumber} saved.`);
    if (!result.error) {
      setPendingPlot(null);
      setPlotNumber("");
    }
  }

  async function doPublish() {
    setBusy(true);
    const result = await publishLayout(layoutVersion.id, projectId);
    setBusy(false);
    setMessage(result.error ?? "Published.");
  }

  const edgeCount = pendingPlot
    ? (pendingPlot.geometry.coordinates[0]?.length ?? 1) - 1
    : 0;

  return (
    <div className="flex flex-col gap-3 lg:flex-row">
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {(["calibrate", "plot", "road", "zone", "select"] as Tool[]).map(
            (t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTool(t);
                  setDraftPoints([]);
                }}
                className={`rounded-md border px-2.5 py-1 text-xs capitalize ${tool === t ? "bg-primary text-primary-foreground" : ""}`}
              >
                {t}
              </button>
            ),
          )}
          {draftPoints.length > 0 ? (
            <button
              type="button"
              onClick={closePolygon}
              className="rounded-md border px-2.5 py-1 text-xs"
            >
              Close polygon ({draftPoints.length} pts)
            </button>
          ) : null}
          <span className="ml-auto text-xs text-muted-foreground">
            {calibrated
              ? `Calibrated: ${unitsPerPx.toFixed(4)} ${layoutVersion.calibration.unit}/px`
              : "Not calibrated"}
          </span>
        </div>

        <div className="relative overflow-hidden rounded-md border bg-slate-50">
          <svg
            viewBox="0 0 1000 700"
            onClick={handleSvgClick}
            className="h-[60vh] w-full touch-none select-none"
          >
            {layoutVersion.sourceImageUrl ? (
              <image
                href={layoutVersion.sourceImageUrl}
                x={0}
                y={0}
                width={1000}
                height={700}
                preserveAspectRatio="xMidYMid meet"
              />
            ) : (
              <text
                x={500}
                y={350}
                textAnchor="middle"
                fontSize={14}
                fill="#888"
              >
                No image underlay — upload a PNG/JPG to trace over it. You can
                still trace against this blank canvas using a printed reference.
              </text>
            )}

            {existingZonePolys.map((z) => (
              <polygon
                key={z.id}
                points={ringToPoints(z.poly)}
                fill="#e5e5e5"
                opacity={0.5}
              />
            ))}
            {existingRoadPolys.map((r) => (
              <polygon
                key={r.id}
                points={ringToPoints(r.poly)}
                fill="#4b4b4b"
                opacity={0.6}
              />
            ))}
            {existingPlotPolys.map((p) => (
              <g key={p.id}>
                <polygon
                  points={ringToPoints(p.poly)}
                  fill="none"
                  stroke="#16a34a"
                  strokeWidth={1.5}
                />
              </g>
            ))}

            {calibPoints.map((p, i) => (
              <circle key={i} cx={p[0]} cy={p[1]} r={5} fill="#dc2626" />
            ))}
            {calibPoints.length === 2 ? (
              <line
                x1={calibPoints[0]![0]}
                y1={calibPoints[0]![1]}
                x2={calibPoints[1]![0]}
                y2={calibPoints[1]![1]}
                stroke="#dc2626"
                strokeWidth={2}
              />
            ) : null}

            {draftPoints.length > 0 ? (
              <polyline
                points={draftPoints.map(([x, y]) => `${x},${y}`).join(" ")}
                fill="none"
                stroke="#2563eb"
                strokeWidth={2}
              />
            ) : null}
            {draftPoints.map((p, i) => (
              <circle key={i} cx={p[0]} cy={p[1]} r={4} fill="#2563eb" />
            ))}
          </svg>
        </div>

        {message ? (
          <p className="text-sm text-muted-foreground">{message}</p>
        ) : null}
      </div>

      <aside className="flex w-full flex-col gap-4 lg:w-72">
        {tool === "calibrate" ? (
          <div className="flex flex-col gap-2 rounded-md border p-3 text-sm">
            <p className="font-medium">Calibrate scale</p>
            <p className="text-xs text-muted-foreground">
              Click two points on the drawing (e.g. the two ends of a plot edge
              with a known dimension), then enter the real distance.
            </p>
            <div className="flex gap-2">
              <input
                type="number"
                value={realDistance}
                onChange={(e) => setRealDistance(e.target.value)}
                placeholder="Real distance"
                className="h-9 w-full rounded-md border border-input px-2"
              />
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as "ft" | "m")}
                className="h-9 rounded-md border border-input px-2"
              >
                <option value="ft">ft</option>
                <option value="m">m</option>
              </select>
            </div>
            <label className="flex flex-col gap-1 text-xs">
              North angle (° clockwise from drawing-up)
              <input
                type="number"
                value={northAngle}
                onChange={(e) => setNorthAngle(e.target.value)}
                className="h-9 rounded-md border border-input px-2"
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={saveCalibrationStep}
              className="h-9 rounded-md bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              Save calibration
            </button>
          </div>
        ) : null}

        {tool === "zone" ? (
          <div className="flex flex-col gap-2 rounded-md border p-3 text-sm">
            <p className="font-medium">Zone kind</p>
            <select
              value={zoneKind}
              onChange={(e) => setZoneKind(e.target.value)}
              className="h-9 rounded-md border border-input px-2"
            >
              {ZONE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {pendingPlot ? (
          <div className="flex flex-col gap-2 rounded-md border p-3 text-sm">
            <p className="font-medium">New plot</p>
            <label className="flex flex-col gap-1 text-xs">
              Plot number
              <input
                value={plotNumber}
                onChange={(e) => setPlotNumber(e.target.value)}
                className="h-9 rounded-md border border-input px-2"
              />
            </label>
            <fieldset className="flex flex-col gap-1 text-xs">
              <legend className="mb-1">Road-facing edges</legend>
              {Array.from({ length: edgeCount }, (_, i) => (
                <label key={i} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={pendingPlot.roadFacing.has(i)}
                    onChange={(e) =>
                      setPendingPlot((prev) => {
                        if (!prev) return prev;
                        const next = new Set(prev.roadFacing);
                        if (e.target.checked) next.add(i);
                        else next.delete(i);
                        return { ...prev, roadFacing: next };
                      })
                    }
                  />
                  Edge {i + 1}
                </label>
              ))}
            </fieldset>
            <button
              type="button"
              disabled={busy}
              onClick={confirmPlot}
              className="h-9 rounded-md bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              Save plot
            </button>
          </div>
        ) : null}

        <div className="flex flex-col gap-1 rounded-md border p-3 text-sm">
          <p className="font-medium">Traced so far</p>
          <p className="text-muted-foreground">
            {plots.length} plot{plots.length === 1 ? "" : "s"} · {roads.length}{" "}
            road{roads.length === 1 ? "" : "s"} · {zones.length} zone
            {zones.length === 1 ? "" : "s"}
          </p>
          {plots.some((p) => p.area_conflict) ? (
            <p className="text-destructive">
              Some traced plots have an open area conflict — resolve on the
              Conflicts page before publishing.
            </p>
          ) : null}
          {roads.length > 0 || zones.length > 0 ? (
            <ul className="mt-1 flex flex-col gap-1 text-xs">
              {roads.map((r) => (
                <li key={r.id} className="flex items-center justify-between">
                  <span>Road{r.name ? ` — ${r.name}` : ""}</span>
                  <button
                    type="button"
                    onClick={() =>
                      deleteTracedFeature(
                        "road",
                        r.id,
                        projectId,
                        layoutVersion.id,
                      )
                    }
                    className="text-destructive"
                  >
                    Remove
                  </button>
                </li>
              ))}
              {zones.map((z) => (
                <li key={z.id} className="flex items-center justify-between">
                  <span>Zone — {z.kind}</span>
                  <button
                    type="button"
                    onClick={() =>
                      deleteTracedFeature(
                        "zone",
                        z.id,
                        projectId,
                        layoutVersion.id,
                      )
                    }
                    className="text-destructive"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <button
          type="button"
          disabled={busy || layoutVersion.status === "published"}
          onClick={doPublish}
          className="h-10 rounded-md border border-input text-sm font-medium disabled:opacity-50"
        >
          {layoutVersion.status === "published"
            ? "Published"
            : "Publish this version"}
        </button>
      </aside>
    </div>
  );
}
