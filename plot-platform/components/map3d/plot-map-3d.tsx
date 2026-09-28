"use client";

import { useMemo, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

import type { MapLayoutData, MapPlot } from "@/lib/data/map";
import { bbox, shrinkRingTowardCentroid } from "@/lib/geometry/polygon";
import { statusStyle } from "@/lib/map/status-colors";

const PLOT_HEIGHT_RATIO = 0.018; // scaled by layout span so it reads consistently at any project size
const ROAD_HEIGHT = 0.03;
const PLOT_INSET = 0.9; // same visual gap technique as the 2D map (§22)
const ZONE_FILL: Record<string, string> = {
  park: "#5fae63",
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
function useShape(poly: MapPlot["geometry"], inset?: number): THREE.Shape {
  return useMemo(() => {
    const rawRing = poly.coordinates[0] ?? [];
    const ring = inset ? shrinkRingTowardCentroid(rawRing, inset) : rawRing;
    const shape = new THREE.Shape();
    ring.forEach(([x, y], i) => {
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    });
    return shape;
  }, [poly, inset]);
}

function PlotMesh({
  plot,
  selected,
  hovered,
  height,
  onSelect,
  onHover,
}: {
  plot: MapPlot;
  selected: boolean;
  hovered: boolean;
  height: number;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  const shape = useShape(plot.geometry, PLOT_INSET);
  const style = statusStyle(plot.status);
  const geometry = useMemo(
    () =>
      new THREE.ExtrudeGeometry(shape, {
        depth: height,
        bevelEnabled: true,
        bevelThickness: height * 0.15,
        bevelSize: height * 0.15,
        bevelSegments: 2,
      }),
    [shape, height],
  );
  const color = selected ? "#1d3a8f" : style.fill;
  const targetY = selected ? height * 0.35 : hovered ? height * 0.12 : 0;

  return (
    <mesh
      geometry={geometry}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, targetY, 0]}
      castShadow
      receiveShadow
      onClick={(e) => {
        e.stopPropagation();
        onSelect(plot.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(plot.id);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        onHover(null);
        document.body.style.cursor = "auto";
      }}
    >
      <meshStandardMaterial
        color={color}
        roughness={0.55}
        metalness={0.05}
        emissive={selected ? "#1d3a8f" : "#000000"}
        emissiveIntensity={selected ? 0.25 : 0}
      />
    </mesh>
  );
}

function FlatPolygon({
  poly,
  color,
  height = 0.02,
  opacity = 1,
  roughness = 0.9,
}: {
  poly: MapPlot["geometry"];
  color: string;
  height?: number;
  opacity?: number;
  roughness?: number;
}) {
  const shape = useShape(poly);
  const geometry = useMemo(
    () =>
      new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false }),
    [shape, height],
  );
  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <meshStandardMaterial
        color={color}
        transparent={opacity < 1}
        opacity={opacity}
        roughness={roughness}
      />
    </mesh>
  );
}

function RoadMesh({ poly, span }: { poly: MapPlot["geometry"]; span: number }) {
  return (
    <FlatPolygon
      poly={poly}
      color="#4a4f57"
      height={ROAD_HEIGHT * span * 0.01}
      roughness={0.75}
    />
  );
}

function Ground({ span }: { span: number }) {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.01, 0]}
      receiveShadow
    >
      <planeGeometry args={[span * 3, span * 3]} />
      <meshStandardMaterial color="#eef1ea" roughness={1} />
    </mesh>
  );
}

/**
 * Draws a label onto a local <canvas> and uses it as a sprite texture —
 * deliberately not drei's <Text> (troika-three-text), which loads its font
 * over the network with no Suspense/error boundary around it here: on a
 * slow or blocked connection that fetch failure crashes the whole R3F tree,
 * leaving only the background visible (§22 — no unverifiable external
 * fetch, same reasoning as skipping drei's <Environment>).
 */
function useLabelTexture(label: string): THREE.CanvasTexture {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#111827";
      ctx.font = "bold 96px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, 64, 68);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, [label]);
}

function Compass3D({
  northAngleDeg,
  span,
}: {
  northAngleDeg: number;
  span: number;
}) {
  const r = span * 0.02;
  const labelTexture = useLabelTexture("N");
  return (
    <group position={[0, span * 0.01, 0]}>
      <group rotation={[0, (northAngleDeg * Math.PI) / 180, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[r, 24]} />
          <meshStandardMaterial color="#ffffff" roughness={0.4} />
        </mesh>
        <mesh position={[0, span * 0.001, -r * 0.55]}>
          <coneGeometry args={[r * 0.35, r * 0.9, 4]} />
          <meshStandardMaterial color="#dc2626" />
        </mesh>
        <sprite
          position={[0, span * 0.003, -r * 1.3]}
          scale={[r * 0.9, r * 0.9, 1]}
        >
          <spriteMaterial map={labelTexture} transparent depthTest={false} />
        </sprite>
      </group>
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
  const [hoveredId, setHoveredId] = useState<string | null>(null);
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
  const plotHeight = span * PLOT_HEIGHT_RATIO;

  return (
    <>
      <color attach="background" args={["#dbe4ea"]} />
      <fog attach="fog" args={["#dbe4ea", span * 1.2, span * 3.5]} />
      <hemisphereLight args={["#f4f8ff", "#9ba38c", 0.65]} />
      <directionalLight
        position={[span * 0.6, span * 0.9, span * 0.4]}
        intensity={1.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-span}
        shadow-camera-right={span}
        shadow-camera-top={span}
        shadow-camera-bottom={-span}
        shadow-camera-far={span * 4}
      />
      {/*
        Each child mesh below is laid flat with rotation={[-Math.PI/2,0,0]},
        which maps its local (x, y) plane onto world (x, z) as (x, -y) — so
        centering the layout at world origin needs +center[1] here, not
        -center[1]; the sign flip cancels the rotation's y→-z flip. Getting
        this wrong silently pushes the whole layout ~2*center[1] units away
        from where the camera/OrbitControls target look, so nothing but the
        (unpositioned) ground plane ever appears in frame.
      */}
      <group position={[-center[0], 0, center[1]]}>
        <Ground span={span} />
        {data.zones.map((z) => (
          <FlatPolygon
            key={z.id}
            poly={z.geometry}
            color={ZONE_FILL[z.kind] ?? "#cccccc"}
            opacity={z.kind === "boundary" ? 0 : 0.92}
          />
        ))}
        {data.roads.map((r) => (
          <RoadMesh key={r.id} poly={r.geometry} span={span} />
        ))}
        {data.plots.map((p) => (
          <PlotMesh
            key={p.id}
            plot={p}
            selected={p.id === selectedId}
            hovered={p.id === hoveredId}
            height={plotHeight}
            onSelect={(id) => onSelect(id === selectedId ? null : id)}
            onHover={setHoveredId}
          />
        ))}
        <Compass3D northAngleDeg={data.northAngleDeg} span={span} />
        <ContactShadows
          position={[0, 0.001, 0]}
          opacity={0.45}
          scale={span * 2.2}
          blur={2.4}
          far={span * 0.3}
        />
      </group>

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={span * 0.25}
        maxDistance={span * 3}
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
    camera.position.set(span * 0.15, span * 0.85, span * 1.05);
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
    <div className="relative h-[60vh] w-full overflow-hidden bg-[#dbe4ea]">
      <div className="absolute top-2 left-1/2 z-10 -translate-x-1/2 rounded-full border border-black/5 bg-background/85 px-3.5 py-1.5 text-xs font-medium shadow-md ring-1 ring-black/5 backdrop-blur-sm">
        Illustrative 3D view generated from the approved 2D layout
      </div>
      <Canvas
        shadows
        camera={{ fov: 42 }}
        gl={{ antialias: true }}
        dpr={[1, 2]}
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
