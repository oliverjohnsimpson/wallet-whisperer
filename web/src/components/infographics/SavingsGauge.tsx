/** Circular savings-rate gauge. Green when saving, coral when overspending. */
export default function SavingsGauge({ rate, size = 150 }: { rate: number; size?: number }) {
  const pct = Math.max(-1, Math.min(1, rate));
  const positive = pct >= 0;
  const stroke = 12;
  // Inset the ring so the stroke (and its rounded caps) sit comfortably *inside*
  // the SVG box, centered with breathing room instead of hugging the border.
  const inset = 10;
  const r = (size - stroke) / 2 - inset;
  const c = 2 * Math.PI * r;
  const filled = Math.min(Math.abs(pct), 1);
  const color = positive ? "#2D6A4F" : "#E86A5C";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EAF3EE" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - filled)}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-display text-2xl font-extrabold" style={{ color }}>
          {Math.round(pct * 100)}%
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-forest-light">
          {positive ? "saved" : "over"}
        </span>
      </div>
    </div>
  );
}
