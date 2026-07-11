import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiGet } from "@/lib/api";
import type { MonthlySummary } from "@/types";
import { formatCompactMoney, formatMoney, formatMonthLabel } from "@/lib/format";
import { CHART_INK, OTHER_COLOR } from "@/lib/chartPalette";

// three.js is heavy — load the 3D chart on its own so the 2D charts paint first.
const SavingsBars3D = lazy(() => import("@/components/charts/SavingsBars3D"));

type RangePreset = "3m" | "6m" | "12m" | "all";

const PRESETS: { id: RangePreset; label: string }[] = [
  { id: "3m", label: "Last 3 months" },
  { id: "6m", label: "Last 6 months" },
  { id: "12m", label: "Last 12 months" },
  { id: "all", label: "All time" },
];

function rangeFrom(preset: RangePreset): string | null {
  const now = new Date();
  const months = preset === "3m" ? 3 : preset === "6m" ? 6 : preset === "12m" ? 12 : 0;
  if (months === 0) return null;
  return new Date(now.getFullYear(), now.getMonth() - (months - 1), 1).toISOString().slice(0, 10);
}

const MAX_SLOTS = 7;

export default function Reports() {
  const [preset, setPreset] = useState<RangePreset>("12m");
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    const from = rangeFrom(preset);
    const params = new URLSearchParams();
    params.set("from", from ?? "2000-01-01");
    apiGet(`/api/reports/monthly-summary?${params.toString()}`)
      .then((data) => {
        if (requestId !== requestIdRef.current) return;
        setSummary(data);
      })
      .catch((err) => {
        if (requestId !== requestIdRef.current) return;
        setError(err?.message ?? "Couldn't load reports.");
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setLoading(false);
      });
  }, [preset]);

  const currency = summary?.primaryCurrency ?? "INR";
  const t = summary?.totals ?? { income: 0, expenses: 0, savings: 0, savingsRate: 0 };

  const monthData = useMemo(
    () => (summary?.months ?? []).map((m) => ({ ...m, label: formatMonthLabel(m.month, true) })),
    [summary]
  );

  const expensePie = useMemo(() => pieData(summary?.byExpenseCategory ?? []), [summary]);
  const incomePie = useMemo(() => pieData(summary?.byIncomeCategory ?? []), [summary]);

  const tooltipStyle = { borderRadius: 12, border: "1px solid #e1e0d9" } as const;
  const fmt = (v: number) => formatMoney(v, currency);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-extrabold text-forest-dark dark:text-night-ink">Reports</h1>
        <p className="text-forest-light dark:text-night-muted">Income, expenses, and savings — sliced any way you like.</p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPreset(p.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              preset === p.id
                ? "bg-forest text-cream shadow-card"
                : "bg-white text-forest-dark shadow-card dark:bg-night-card dark:text-night-ink"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-forest-light dark:text-night-muted">Crunching the numbers…</p>}

      {error && (
        <div className="rounded-xl2 bg-coral/10 p-4 text-sm text-coral-dark">{error}</div>
      )}

      {!loading && !error && summary && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Tile label="Income" value={fmt(t.income)} className="bg-forest text-cream" muted="text-cream/70" />
            <Tile label="Expenses" value={fmt(t.expenses)} className="bg-white text-forest-dark shadow-card dark:bg-night-card dark:text-night-ink" />
            <Tile
              label={t.savings >= 0 ? "Savings" : "Overspent"}
              value={fmt(Math.abs(t.savings))}
              className="bg-gold/15 text-forest-dark shadow-card dark:bg-gold/10 dark:text-night-ink"
            />
            <Tile
              label="Savings rate"
              value={`${Math.round(t.savingsRate * 100)}%`}
              className="bg-white text-forest-dark shadow-card dark:bg-night-card dark:text-night-ink"
            />
          </div>

          {/* 3D showcase */}
          <div className="rounded-xl2 bg-white p-6 shadow-card dark:bg-night-card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-forest-dark dark:text-night-ink">Income vs. expenses in 3D</h2>
              <span className="text-xs text-forest-light dark:text-night-muted">🖱️ drag to spin · scroll to zoom</span>
            </div>
            <Suspense
              fallback={<div className="flex h-80 items-center justify-center rounded-xl2 bg-forest-50 text-forest-light dark:bg-white/5 dark:text-night-muted">Loading 3D view…</div>}
            >
              <SavingsBars3D months={summary.months} currency={currency} />
            </Suspense>
          </div>

          {/* Interactive composed chart */}
          <div className="rounded-xl2 bg-white p-6 shadow-card dark:bg-night-card">
            <h2 className="mb-4 font-display text-lg font-bold text-forest-dark dark:text-night-ink">Monthly income, expenses &amp; savings</h2>
            {monthData.length === 0 ? (
              <p className="text-forest-light dark:text-night-muted">No data in this range yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={monthData} margin={{ left: 8, right: 16 }}>
                  <defs>
                    <linearGradient id="savingsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#E8A33D" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#E8A33D" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={CHART_INK.grid} />
                  <XAxis dataKey="label" stroke={CHART_INK.muted} fontSize={12} />
                  <YAxis tickFormatter={(v) => formatCompactMoney(v, currency)} stroke={CHART_INK.muted} fontSize={12} width={64} />
                  <Tooltip formatter={fmt} contentStyle={tooltipStyle} />
                  <Legend />
                  <Bar dataKey="income" name="Income" fill="#2D6A4F" radius={[4, 4, 0, 0]} maxBarSize={22} />
                  <Bar dataKey="expenses" name="Expenses" fill="#E86A5C" radius={[4, 4, 0, 0]} maxBarSize={22} />
                  <Area type="monotone" dataKey="savings" name="Savings" stroke="#C9821F" strokeWidth={2} fill="url(#savingsFill)" />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Category donuts */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <DonutCard title="Income by source" data={incomePie} currency={currency} emptyLabel="No income in this range." />
            <DonutCard title="Expenses by category" data={expensePie} currency={currency} emptyLabel="No expenses in this range." />
          </div>

          {(summary.unconverted.incomes > 0 || summary.unconverted.expenses > 0) && (
            <p className="rounded-lg bg-gold/10 p-3 text-xs text-forest-light dark:text-night-muted">
              Note: {summary.unconverted.incomes + summary.unconverted.expenses} entr
              {summary.unconverted.incomes + summary.unconverted.expenses === 1 ? "y" : "ies"} in a currency we couldn't
              convert to {currency} were left out of these totals.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function pieData(items: { category_id: string; label: string; icon: string; color: string; total: number }[]) {
  const sorted = [...items].sort((a, b) => b.total - a.total);
  const top = sorted.slice(0, MAX_SLOTS).map((c) => ({ name: `${c.icon} ${c.label}`, value: c.total, fill: c.color }));
  const rest = sorted.slice(MAX_SLOTS);
  if (rest.length) top.push({ name: "Other", value: rest.reduce((s, c) => s + c.total, 0), fill: OTHER_COLOR });
  return top;
}

function Tile({ label, value, className, muted = "text-forest-light dark:text-night-muted" }: { label: string; value: string; className: string; muted?: string }) {
  return (
    <div className={`rounded-xl2 p-5 ${className}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${muted}`}>{label}</p>
      <p className="mt-1 font-display text-2xl font-extrabold">{value}</p>
    </div>
  );
}

function DonutCard({
  title,
  data,
  currency,
  emptyLabel,
}: {
  title: string;
  data: { name: string; value: number; fill: string }[];
  currency: string;
  emptyLabel: string;
}) {
  return (
    <div className="rounded-xl2 bg-white p-6 shadow-card dark:bg-night-card">
      <h2 className="mb-4 font-display text-lg font-bold text-forest-dark dark:text-night-ink">{title}</h2>
      {data.length === 0 ? (
        <p className="py-8 text-center text-forest-light dark:text-night-muted">{emptyLabel}</p>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.fill} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => formatMoney(v, currency)} contentStyle={{ borderRadius: 12, border: "1px solid #e1e0d9" }} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
