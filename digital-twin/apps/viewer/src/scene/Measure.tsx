import { Line } from '@react-three/drei';
import { useStore } from '../store';

const Dot = ({ p, ghost }: { p: [number, number, number]; ghost?: boolean }) => (
  <mesh position={p} renderOrder={999}>
    <sphereGeometry args={[0.6, 16, 16]} />
    <meshBasicMaterial color={ghost ? '#fbbf24' : '#ef4444'} depthTest={false} transparent opacity={0.95} />
  </mesh>
);

/** Distance overlay between picked model points, scaled by project.model_scale (metres per model unit). */
export function Measure() {
  const measurements = useStore((s) => s.measurements);
  const pending = useStore((s) => s.pending);
  const level = useStore((s) => s.level);
  // Interior models are small: shrink the markers.
  const k = level === 'unit' ? 0.12 : 1;
  return (
    <group>
      {pending && <group scale={k}><Dot p={pending.map((v) => v / k) as [number, number, number]} ghost /></group>}
      {measurements.map((m, i) => {
        return (
          <group key={i}>
            <group scale={k}>
              <Dot p={m.a.map((v) => v / k) as [number, number, number]} /><Dot p={m.b.map((v) => v / k) as [number, number, number]} />
            </group>
            <Line points={[m.a, m.b]} color="#ef4444" lineWidth={3} depthTest={false} renderOrder={998} />
          </group>
        );
      })}
    </group>
  );
}
