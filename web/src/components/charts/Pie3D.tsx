import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";

export interface PieDatum {
  name: string;
  color: string;
  value: number;
}

/**
 * A rotatable 3D pie chart: each category is an extruded wedge (a cylinder sector)
 * whose angle is proportional to its share. Drag to spin, scroll to zoom.
 */
export default function Pie3D({ data }: { data: PieDatum[]; currency?: string }) {
  const slices = useMemo(() => {
    const total = data.reduce((s, d) => s + d.value, 0) || 1;
    let angle = 0;
    return data.map((d) => {
      const theta = (d.value / total) * Math.PI * 2;
      const mid = angle + theta / 2;
      const slice = { ...d, start: angle, theta, mid, pct: d.value / total };
      angle += theta;
      return slice;
    });
  }, [data]);

  const R = 3.2;
  const H = 0.9;
  const labelR = 4.0;

  return (
    <div className="h-96 w-full cursor-grab overflow-hidden rounded-xl2 bg-gradient-to-b from-[#0f2942] to-[#1c3f61] active:cursor-grabbing">
      <Canvas camera={{ position: [0, 5.5, 6.5], fov: 45 }}>
        <ambientLight intensity={0.85} />
        <directionalLight position={[5, 9, 5]} intensity={1} />
        <directionalLight position={[-5, 4, -5]} intensity={0.3} />

        <group>
          {slices.map((s, i) => (
            <group key={i}>
              {/* Cylinder sector: axis is Y, so the disc lies flat in XZ with H thickness. */}
              <mesh castShadow>
                <cylinderGeometry args={[R, R, H, 64, 1, false, s.start, s.theta]} />
                <meshStandardMaterial color={s.color} emissive={s.color} emissiveIntensity={0.12} roughness={0.5} metalness={0.1} />
              </mesh>
              {s.pct >= 0.04 && (
                <Text
                  position={[Math.sin(s.mid) * labelR, H / 2 + 0.15, Math.cos(s.mid) * labelR]}
                  rotation={[-Math.PI / 2.2, 0, 0]}
                  fontSize={0.28}
                  color="#eaf3ee"
                  anchorX="center"
                  anchorY="middle"
                >
                  {`${s.name}  ${Math.round(s.pct * 100)}%`}
                </Text>
              )}
            </group>
          ))}
        </group>

        <OrbitControls enablePan={false} minDistance={4} maxDistance={14} maxPolarAngle={Math.PI / 2.05} autoRotate autoRotateSpeed={0.6} />
      </Canvas>
    </div>
  );
}
