import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Line, OrbitControls, Text } from "@react-three/drei";
import { Shape, Vector3 } from "three";

export interface DoughnutDatum {
  name: string;
  color: string;
  value: number;
}

const OUTER = 3.2;
const INNER = 1.7;
const THICK = 0.8;
const LABEL_R = 4.3;

/** Build a flat annular-sector Shape (a doughnut slice) between two angles. */
function ringSectorShape(inner: number, outer: number, start: number, end: number): Shape {
  const s = new Shape();
  s.moveTo(Math.cos(start) * inner, Math.sin(start) * inner);
  s.lineTo(Math.cos(start) * outer, Math.sin(start) * outer);
  s.absarc(0, 0, outer, start, end, false);
  s.lineTo(Math.cos(end) * inner, Math.sin(end) * inner);
  s.absarc(0, 0, inner, end, start, true);
  return s;
}

/**
 * A rotatable 3D doughnut chart: each category is an extruded annular sector.
 * Labels sit outside their slice with a leader line pointing back to it.
 */
export default function Doughnut3D({ data }: { data: DoughnutDatum[]; currency?: string }) {
  const slices = useMemo(() => {
    const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
    let angle = 0;
    return data.map((d) => {
      const theta = (d.value / total) * Math.PI * 2;
      // Leave a hair of gap so full-circle (100%) slices still render as a ring.
      const end = angle + Math.max(theta - 0.006, 0.02);
      const start = angle;
      const mid = start + (end - start) / 2;
      const shape = ringSectorShape(INNER, OUTER, start, end);
      // After the mesh's -90° X rotation, shape (cosθ, sinθ) maps to world (cosθ, ·, -sinθ).
      const edge = new Vector3(Math.cos(mid) * OUTER, THICK, -Math.sin(mid) * OUTER);
      const label = new Vector3(Math.cos(mid) * LABEL_R, THICK + 0.15, -Math.sin(mid) * LABEL_R);
      const s = { ...d, shape, mid, pct: d.value / total, edge, label };
      angle += theta;
      return s;
    });
  }, [data]);

  return (
    <div className="h-96 w-full cursor-grab overflow-hidden rounded-xl2 bg-gradient-to-b from-[#0f2942] to-[#1c3f61] active:cursor-grabbing">
      <Canvas camera={{ position: [0, 6, 6.5], fov: 45 }}>
        <ambientLight intensity={0.85} />
        <directionalLight position={[5, 9, 5]} intensity={1} />
        <directionalLight position={[-5, 4, -5]} intensity={0.3} />

        <group>
          {slices.map((s, i) => (
            <group key={i}>
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <extrudeGeometry args={[s.shape, { depth: THICK, bevelEnabled: false, curveSegments: 48 }]} />
                <meshStandardMaterial color={s.color} emissive={s.color} emissiveIntensity={0.12} roughness={0.5} metalness={0.1} />
              </mesh>

              {s.pct >= 0.03 && (
                <>
                  {/* Leader line from the slice's outer edge out to its label. */}
                  <Line points={[s.edge, s.label]} color="#cbd5e1" lineWidth={1.5} />
                  <mesh position={s.edge}>
                    <sphereGeometry args={[0.06, 12, 12]} />
                    <meshStandardMaterial color="#cbd5e1" />
                  </mesh>
                  <Text
                    position={[s.label.x + (s.label.x >= 0 ? 0.15 : -0.15), s.label.y, s.label.z]}
                    fontSize={0.3}
                    color="#eaf3ee"
                    anchorX={s.label.x >= 0 ? "left" : "right"}
                    anchorY="middle"
                    rotation={[-Math.PI / 2.2, 0, 0]}
                  >
                    {`${s.name}  ${Math.round(s.pct * 100)}%`}
                  </Text>
                </>
              )}
            </group>
          ))}
        </group>

        <OrbitControls enablePan={false} minDistance={4} maxDistance={14} maxPolarAngle={Math.PI / 2.05} autoRotate autoRotateSpeed={0.6} />
      </Canvas>
    </div>
  );
}
