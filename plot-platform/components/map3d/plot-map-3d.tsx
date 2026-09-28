"use client";

import { useMemo, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";

import type { MapLayoutData, MapPlot } from "@/lib/data/map";
import { bbox } from "@/lib/geometry/polygon";
import { statusStyle } from "@/lib/map/status-colors";

const PLOT_HEIGHT = 0.6;
const ROAD_HEIGHT = 0.05;
const ZONE_FILL: Record<string, string> = {
  park: "#6fbf73",
  amenity: "#e0a94f",
  commercial: "#b98fd1",
  residential: "#d9d9d9",
  utility: "#a8a8a8",
  gate_entry: "#2b2b2b",
  gate_exit: "#2b2b2b",
  boundary: "#666666",
  water: "#6fa8c9",
  other: "#cccccc",
};

/** Builds a flat (or thin-extruded) mesh from a layout-unit polygon, mapping
 * layout (x, y-down) onto the ground plane (x, z) so "up" in the drawing
 * becomes "away from camera" on the ground, with world Y as height. */
function useShape(poly: MapPlot["geometry"]) {
  return useMemo(() => {
    const ring = poly.coordinates[0] ?? [];
    const shape = new THREE.Shape();
    ring.forEach(([x, y], i) => {
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    });
    return shape;
  }, [poly]);
}

function PlotMesh({
  plot,
  selected,
  onSelect,
}: {
  plot: MapPlot;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const shape = useShape(plot.geometry);
  const style = statusStyle(plot.status);
  const geometry = useMemo(
    () =>
      new THREE.ExtrudeGeometry(shape, {
        depth: PLOT_HEIGHT,
        bevelEnabled: false,
      }),
    [shape],
  );

  return (
    <mesh
      geometry={geometry}
      rotation={[-Math.PI / 2, 0, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(plot.id);
      }}
    >
      <meshStandardMaterial
        color={selected ? "#111827" : style.fill}
        opacity={selected ? 1 : 0.92}
        transparent
      />
    </mesh>
  );
}

function FlatPolygon({
  poly,
  color,
  height = 0.02,
  opacity = 1,
}: {
  poly: MapPlot["geometry"];
  color: string;
  height?: number;
  opacity?: number;
}) {
  const shape = useShape(poly);
  const geometry = useMemo(
    () =>
      new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false }),
    [shape, height],
  );
  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial
        color={color}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </mesh>
  );
}

function Compass3D({ northAngleDeg }: { northAngleDeg: number }) {
  // Drawing-up rotated to point at true north — matches the 2D compass convention (§6).
  return (
    <group
      rotation={[0, (northAngleDeg * Math.PI) / 180, 0]}
      position={[0, 0.7, 0]}
    >
      <Text fontSize={4} color="#111827" anchorX="center" anchorY="middle">
        N
      </Text>
    </group>
  );
}

function Scene({
  data,
  selectedId,
  onSelect,
}: {
  data: MapLayoutData;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const box = useMemo(
    () =>
      bbox([
        ...data.plots.map((p) => p.geometry),
        ...data.roads.map((r) => r.geometry),
      ]),
    [data],
  );
  const center: [number, number] = Number.isFinite(box.minX)
    ? [(box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2]
    : [0, 0];
  const span = Number.isFinite(box.minX)
    ? Math.max(box.maxX - box.minX, box.maxY - box.minY)
    : 100;

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[span, span, span]} intensity={0.8} />
      <group position={[-center[0], 0, -center[1]]}>
        {data.zones.map((z) => (
          <FlatPolygon
            key={z.id}
            poly={z.geometry}
            color={ZONE_FILL[z.kind] ?? "#cccccc"}
            opacity={z.kind === "boundary" ? 0 : 0.9}
          />
        ))}
        {data.roads.map((r) => (
          <FlatPolygon
            key={r.id}
            poly={r.geometry}
            color="#3f3f3f"
            height={ROAD_HEIGHT}
          />
        ))}
        {data.plots.map((p) => (
          <PlotMesh
            key={p.id}
            plot={p}
            selected={p.id === selectedId}
            onSelect={(id) => onSelect(id === selectedId ? null : id)}
          />
        ))}
        <Compass3D northAngleDeg={data.northAngleDeg} />
      </group>
      <OrbitControls
        makeDefault
        maxPolarAngle={Math.PI / 2.1}
        target={[0, 0, 0]}
      />
      <CameraRig span={span} />
    </>
  );
}

function CameraRig({ span }: { span: number }) {
  const { camera } = useThree();
  useMemo(() => {
    camera.position.set(0, span * 0.9, span * 0.9);
    camera.lookAt(0, 0, 0);
  }, [camera, span]);
  return null;
}

/** Illustrative 3D view (§11): thin extruded slabs from the same approved 2D
 * geometry, never independently modeled — the honesty banner is permanent
 * in this build since `survey_verified_3d` isn't exposed to the public
 * payload yet, so this view is never labeled anything but illustrative. */
export function PlotMap3D({
  data,
  selectedId,
  onSelect,
}: {
  data: MapLayoutData;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
}) {
  const [internalSelected, setInternalSelected] = useState<string | null>(null);
  const selected = selectedId !== undefined ? selectedId : internalSelected;
  const setSelected = onSelect ?? setInternalSelected;
  const [webglFailed, setWebglFailed] = useState(false);

  if (webglFailed) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        3D isn&apos;t available on this device — showing 2D instead.
      </p>
    );
  }

  return (
    <div className="relative h-[60vh] w-full bg-slate-100 dark:bg-slate-900">
      <div className="absolute top-2 left-1/2 z-10 -translate-x-1/2 rounded-md border border-input bg-background/90 px-3 py-1 text-xs shadow-sm">
        Illustrative 3D view generated from the approved 2D layout
      </div>
      <Canvas
        camera={{ fov: 45 }}
        onCreated={({ gl }) => {
          if (!gl.getContext()) setWebglFailed(true);
        }}
        onError={() => setWebglFailed(true)}
      >
        <Scene data={data} selectedId={selected} onSelect={setSelected} />
      </Canvas>
    </div>
  );
}
