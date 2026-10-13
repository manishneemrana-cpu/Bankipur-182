import { Line } from '@react-three/drei';
import { useMemo } from 'react';
import { DoubleSide, Shape } from 'three';
import { useStore } from '../store';

const TYPE_COLOR = ['#3b82f6', '#f59e0b', '#10b981', '#a855f7', '#ec4899', '#14b8a6'];

/** Clickable unit outlines laid on the selected floor plate. */
export function FloorUnits() {
  const level = useStore((s) => s.level);
  const towerId = useStore((s) => s.towerId);
  const floorNumber = useStore((s) => s.floorNumber);
  const bundle = useStore((s) => s.bundle);
  const goUnit = useStore((s) => s.goUnit);
  const hover = useStore((s) => s.hoverUnit);
  const setHover = useStore((s) => s.setHoverUnit);
  const tower = bundle?.towers.find((t) => t.id === towerId);
  const floor = bundle?.floors.find((f) => f.tower_id === towerId && f.floor_number === floorNumber);
  const typeIdx = useMemo(() => new Map((bundle?.unit_types ?? []).map((t, i) => [t.id, i])), [bundle]);
  const units = useMemo(() => (bundle?.units ?? []).filter((u) => u.tower_id === towerId && u.floor_number === floorNumber), [bundle, towerId, floorNumber]);
  if (level !== 'floor' || !tower || !floor) return null;

  return (
    <group position={tower.position} rotation-y={tower.rotation_y}>
      <group position-y={floor.elevation + 0.32}>
        {units.map((u) => {
          const color = u.status === 'sold' ? '#6b7280' : TYPE_COLOR[(typeIdx.get(u.unit_type_id) ?? 0) % TYPE_COLOR.length]!;
          const shape = new Shape(u.outline.map(([x, z]) => ({ x, y: -z }) as never));
          const pts = u.outline.map(([x, z]) => [x, 0.02, z] as [number, number, number]);
          const hot = hover === u.id;
          return (
            <group key={u.id}>
              <mesh rotation-x={-Math.PI / 2} onPointerOver={(e) => { e.stopPropagation(); setHover(u.id); document.body.style.cursor = 'pointer'; }}
                onPointerOut={() => { setHover(null); document.body.style.cursor = ''; }}
                onClick={(e) => { if (e.delta > 4 || useStore.getState().measuring) return; e.stopPropagation(); document.body.style.cursor = ''; goUnit(u.id); }}>
                <shapeGeometry args={[shape]} />
                <meshBasicMaterial color={color} transparent opacity={hot ? 0.8 : 0.5} side={DoubleSide} depthWrite={false} />
              </mesh>
              <Line points={[...pts, pts[0]!]} color={hot ? '#ffffff' : color} lineWidth={hot ? 3 : 2} />
            </group>
          );
        })}
      </group>
    </group>
  );
}
