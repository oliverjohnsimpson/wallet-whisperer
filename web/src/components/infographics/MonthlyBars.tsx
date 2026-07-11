import type { MonthlyPoint } from "@/types";
import { formatCompactMoney, formatMoney, formatMonthLabel } from "@/lib/format";

/** Lightweight grouped income/expense bars per month with a savings dot, drawn as inline SVG. */
export default function MonthlyBars({
  months,
  currency,
  count = 8,
}: {
  months: MonthlyPoint[];
  currency: string;
  count?: number;
}) {
  const data = months.slice(-count);
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-forest-light dark:text-night-muted">No monthly data yet.</p>;
  }

  const W = 720;
  const H = 240;
  const padX = 36;
  const padTop = 16;
  const padBottom = 28;
  const plotW = W - padX * 2;
  const plotH = H - padTop - padBottom;
  const max = Math.max(...data.map((m) => Math.max(m.income, m.expenses)), 1);

  const groupW = plotW / data.length;
  const barW = Math.min(18, groupW / 3);
  const y = (v: number) => padTop + plotH - (v / max) * plotH;

  return (
    <div className="w-full overflow-x-auto text-forest-light dark:text-night-muted">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px]" role="img" aria-label="Monthly income and expenses">
        {/* gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={padX} x2={W - padX} y1={y(max * t)} y2={y(max * t)} stroke="currentColor" strokeOpacity={0.2} strokeWidth={1} />
            <text x={4} y={y(max * t) + 4} fontSize={10} fill="currentColor">
              {formatCompactMoney(max * t, currency)}
            </text>
          </g>
        ))}

        {data.map((m, i) => {
          const cx = padX + groupW * i + groupW / 2;
          const incX = cx - barW - 2;
          const expX = cx + 2;
          const savingsY = y(Math.max(m.savings, 0));
          return (
            <g key={m.month}>
              <rect x={incX} y={y(m.income)} width={barW} height={padTop + plotH - y(m.income)} rx={3} fill="#2D6A4F">
                <title>{`${formatMonthLabel(m.month, true)} · Income ${formatMoney(m.income, currency)}`}</title>
              </rect>
              <rect x={expX} y={y(m.expenses)} width={barW} height={padTop + plotH - y(m.expenses)} rx={3} fill="#E86A5C">
                <title>{`${formatMonthLabel(m.month, true)} · Expenses ${formatMoney(m.expenses, currency)}`}</title>
              </rect>
              {/* savings marker */}
              <circle cx={cx} cy={savingsY} r={3.5} fill="#E8A33D" stroke="#fff" strokeWidth={1.5}>
                <title>{`${formatMonthLabel(m.month, true)} · Savings ${formatMoney(m.savings, currency)}`}</title>
              </circle>
              <text x={cx} y={H - 10} fontSize={11} fill="currentColor" textAnchor="middle">
                {formatMonthLabel(m.month)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex items-center gap-4 pl-9 text-xs text-forest-light dark:text-night-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-forest" /> Income
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-coral" /> Expenses
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-gold" /> Savings
        </span>
      </div>
    </div>
  );
}
