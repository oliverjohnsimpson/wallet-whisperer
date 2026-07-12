import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Line, OrbitControls, Text } from "@react-three/drei";
import { Vector3 } from "three";
import { formatCompactMoney } from "@/lib/format";

export interface Series3D {
  name: string;
  color: string;
  values: number[];
}

/**
 * A rotatable 3D line graph: each series is a poly-line drawn at its own depth (z),
 * with values on Y and month positions on X. Drag to spin, scroll to zoom.
 * Used in Reports to show income sources and expense categories over time.
 */
export default function Lines3D({
  series,
  labels,
  currency,
}: {
  series: Series3D[];
  labels: string[];
  currency: string;
}) {
  const { lines, monthTicks, seriesLabels, yTicks } = useMemo(() => {
    const max = Math.max(1, ...series.flatMap((s) => s.values));
    const yMax = 4;
    const xStep = labels.length > 1 ? 8 / (labels.length - 1) : 0;
    const x0 = -4;
    const zStep = series.length > 1 ? 4 / (series.length - 1) : 0;
    const z0 = series.length > 1 ? -2 : 0;
    const yScale = (v: number) => (v / max) * yMax;
    const xAt = (i: number) => x0 + i * xStep;
    const zAt = (j: number) => z0 + j * zStep;

    const lines = series.map((s, j) => ({
      color: s.color,
      name: s.name,
      z: zAt(j),
      points: s.values.map((v, i) => new Vector3(xAt(i), yScale(v), zAt(j))),
      labelPos: new Vector3(xAt(0) - 0.4, yScale(s.values[0] ?? 0) + 0.15, zAt(j)),
    }));

    const monthTicks = labels.map((l, i) => ({ label: l, x: xAt(i) }));

    const seriesLabels = lines.map((l) => ({ name: l.name, color: l.color, pos: l.labelPos }));

    // A few Y reference labels (0, half, max).
    const yTicks = [0, max / 2, max].map((v) => ({ label: formatCompactMoney(v, currency), y: yScale(v) }));

    return { lines, monthTicks, seriesLabels, yTicks };
  }, [series, labels, currency]);

  return (
    <div className="h-96 w-full cursor-grab overflow-hidden rounded-xl2 bg-gradient-to-b from-[#0f2942] to-[#1c3f61] active:cursor-grabbing">
      <Canvas camera={{ position: [0, 4, 12], fov: 45 }}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[6, 10, 6]} intensity={1} />
        <gridHelper args={[16, 16, "#2f5476", "#1a3b57"]} position={[0, 0, 0]} />

        {/* Y reference ticks along the left edge */}
        {yTicks.map((t, i) => (
          <Text key={`y-${i}`} position={[-4.9, t.y, 0]} fontSize={0.26} color="#8fb0c9" anchorX="right" anchorY="middle">
            {t.label}
          </Text>
        ))}

        {lines.map((l, i) => (
          <group key={`line-${i}`}>
            <Line points={l.points} color={l.color} lineWidth={3} />
            {l.points.map((p, k) => (
              <mesh key={k} position={p}>
                <sphereGeometry args={[0.07, 12, 12]} />
                <meshStandardMaterial color={l.color} emissive={l.color} emissiveIntensity={0.3} />
              </mesh>
            ))}
          </group>
        ))}

        {/* Series names near each line's start */}
        {seriesLabels.map((s, i) => (
          <Text key={`s-${i}`} position={s.pos} fontSize={0.3} color={s.color} anchorX="right" anchorY="middle">
            {s.name}
          </Text>
        ))}

        {/* Month labels along X */}
        {monthTicks.map((m, i) => (
          <Text
            key={`m-${i}`}
            position={[m.x, -0.35, 2.6]}
            rotation={[-Math.PI / 3, 0, 0]}
            fontSize={0.3}
            color="#c3d3e0"
            anchorX="center"
          >
            {m.label}
          </Text>
        ))}

        <OrbitControls enablePan={false} minDistance={6} maxDistance={22} maxPolarAngle={Math.PI / 2.05} autoRotate autoRotateSpeed={0.5} />
      </Canvas>
    </div>
  );
}
