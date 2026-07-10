import { useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import type { Mesh } from "three";
import type { MonthlyPoint } from "@/types";
import { formatCompactMoney, formatMonthLabel } from "@/lib/format";

function Bar({
  x,
  height,
  color,
  label,
}: {
  x: number;
  height: number;
  color: string;
  label: string;
}) {
  const ref = useRef<Mesh>(null);
  const [hover, setHover] = useState(false);
  const h = Math.max(height, 0.02);
  return (
    <mesh
      ref={ref}
      position={[x, h / 2, 0]}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
      }}
      onPointerOut={() => setHover(false)}
    >
      <boxGeometry args={[0.5, h, 0.5]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={hover ? 0.4 : 0.05} roughness={0.5} />
      {hover && (
        <Text position={[0, h / 2 + 0.35, 0]} fontSize={0.32} color="#0f2942" anchorX="center" anchorY="bottom">
          {label}
        </Text>
      )}
    </mesh>
  );
}

/** A rotatable, zoomable 3D field of monthly income (green) vs expense (coral) bars. Drag to spin. */
export default function SavingsBars3D({ months, currency }: { months: MonthlyPoint[]; currency: string }) {
  const data = months.slice(-12);
  const max = Math.max(...data.map((m) => Math.max(m.income, m.expenses)), 1);
  const barMax = 4;
  const spacing = 1.4;
  const scale = (v: number) => (v / max) * barMax;

  return (
    <div className="h-80 w-full cursor-grab overflow-hidden rounded-xl2 bg-gradient-to-b from-[#0f2942] to-[#1c3f61] active:cursor-grabbing">
      <Canvas camera={{ position: [0, 5, 12], fov: 45 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[6, 10, 6]} intensity={1.1} />
        <directionalLight position={[-6, 4, -4]} intensity={0.4} />

        {/* floor grid */}
        <gridHelper args={[30, 30, "#2f5476", "#1a3b57"]} position={[0, 0, 0]} />

        <group position={[0, 0, 0]}>
          {data.map((m, i) => {
            const gx = (i - (data.length - 1) / 2) * spacing;
            return (
              <group key={m.month}>
                <Bar
                  x={gx - 0.32}
                  height={scale(m.income)}
                  color="#3fb97e"
                  label={`Income ${formatCompactMoney(m.income, currency)}`}
                />
                <Bar
                  x={gx + 0.32}
                  height={scale(m.expenses)}
                  color="#E86A5C"
                  label={`Spent ${formatCompactMoney(m.expenses, currency)}`}
                />
                <Text
                  position={[gx, -0.35, 0.6]}
                  rotation={[-Math.PI / 3, 0, 0]}
                  fontSize={0.34}
                  color="#c3d3e0"
                  anchorX="center"
                >
                  {formatMonthLabel(m.month)}
                </Text>
              </group>
            );
          })}
        </group>

        <OrbitControls enablePan={false} minDistance={6} maxDistance={20} maxPolarAngle={Math.PI / 2.05} autoRotate autoRotateSpeed={0.6} />
      </Canvas>
    </div>
  );
}
