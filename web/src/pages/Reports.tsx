import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiGet } from "@/lib/api";
import type { MonthlySummary } from "@/types";
import { formatCompactMoney, formatMoney, formatMonthLabel } from "@/lib/format";
import { CATEGORICAL_PALETTE, CHART_INK, OTHER_COLOR } from "@/lib/chartPalette";
import { monthsAgoStart, todayISO, type MonthPreset } from "@/lib/dateRange";
import type { Series3D } from "@/components/charts/Lines3D";

// three.js is heavy — load the 3D charts on their own so the 2D charts paint first.
const SavingsBars3D = lazy(() => import("@/components/charts/SavingsBars3D"));
const Lines3D = lazy(() => import("@/components/charts/Lines3D"));

interface CategoryTrends {
  primaryCurrency: string;
  months: string[];
  income: { key: string; label: string; color: string; values: number[] }[];
  expenses: { key: string; label: string; color: string; values: number[] }[];
}

const TOP_N = 6;

export default function Reports() {
  const [preset, setPreset] = useState<MonthPreset | "all" | null>(12);
  const [from, setFrom] = useState<string>(monthsAgoStart(12));
  const [to, setTo] = useState<string>(todayISO());
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [trends, setTrends] = useState<CategoryTrends | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    const qs = `from=${from}&to=${to}`;
    Promise.all([apiGet(`/api/reports/monthly-summary?${qs}`), apiGet(`/api/reports/category-trends?${qs}`)])
      .then(([s, t]) => {
        if (requestId !== requestIdRef.current) return;
        setSummary(s);
        setTrends(t);
      })
      .catch((err) => {
        if (requestId !== requestIdRef.current) return;
        setError(err?.message ?? "Couldn't load reports.");
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setLoading(false);
      });
  }, [from, to]);

  function applyPreset(p: MonthPreset | "all") {
    setPreset(p);
    setFrom(p === "all" ? "2000-01-01" : monthsAgoStart(p));
    setTo(todayISO());
  }

  const currency = summary?.primaryCurrency ?? "INR";
  const t = summary?.totals ?? { income: 0, expenses: 0, savings: 0, savingsRate: 0 };

  const monthData = useMemo(
    () => (summary?.months ?? []).map((m) => ({ ...m, label: formatMonthLabel(m.month, true) })),
    [summary]
  );

  const labels = useMemo(() => (trends?.months ?? []).map((m) => formatMonthLabel(m, true)), [trends]);

  // Fold a category-trends list into the top N series (+ an "Other" line).
  function topSeries(list: CategoryTrends["income"] | undefined): Series3D[] {
    if (!list || list.length === 0) return [];
    const top = list.slice(0, TOP_N).map((s, i) => ({
      name: s.label,
      color: CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length],
      values: s.values.map((v) => Math.round(v)),
    }));
    const rest = list.slice(TOP_N);
    if (rest.length) {
      const monthsLen = rest[0].values.length;
      const other = Array.from({ length: monthsLen }, (_, i) => rest.reduce((sum, s) => sum + (s.values[i] ?? 0), 0));
      if (other.some((v) => v > 0)) top.push({ name: "Other", color: OTHER_COLOR, values: other.map((v) => Math.round(v)) });
    }
    return top;
  }

  const incomeSeries = useMemo(() => topSeries(trends?.income), [trends]);
  const expenseSeries = useMemo(() => topSeries(trends?.expenses), [trends]);

  // 2D data for the expense-category line chart (item 13).
  const expense2D = useMemo(() => {
    return labels.map((label, i) => {
      const row: Record<string, number | string> = { label };
      expenseSeries.forEach((s) => (row[s.name] = s.values[i] ?? 0));
      return row;
    });
  }, [labels, expenseSeries]);

  const tooltipStyle = { borderRadius: 12, border: "1px solid #e1e0d9" } as const;
  const fmt = (v: number) => formatMoney(v, currency);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-extrabold text-forest-dark dark:text-night-ink">Reports</h1>
        <p className="text-forest-light dark:text-night-muted">Income, expenses, and savings — sliced any way you like.</p>
      </div>

      {/* Filters: quick presets + custom from/to (item 15) */}
      <div className="mb-6 rounded-xl2 bg-white p-4 shadow-card dark:bg-night-card">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {([1, 3, 6, 12] as MonthPreset[]).map((p) => (
            <button
              key={p}
              onClick={() => applyPreset(p)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                preset === p ? "bg-forest text-cream shadow-card" : "bg-forest-50 text-forest-dark dark:bg-white/5 dark:text-night-ink"
              }`}
            >
              {p === 1 ? "This month" : `${p} months`}
            </button>
          ))}
          <button
            onClick={() => applyPreset("all")}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
              preset === "all" ? "bg-forest text-cream shadow-card" : "bg-forest-50 text-forest-dark dark:bg-white/5 dark:text-night-ink"
            }`}
          >
            All time
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-md">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-forest-light dark:text-night-muted">From</span>
            <input type="date" value={from} max={to} onChange={(e) => { setFrom(e.target.value); setPreset(null); }} className="ww-input py-2" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-forest-light dark:text-night-muted">To</span>
            <input type="date" value={to} min={from} max={todayISO()} onChange={(e) => { setTo(e.target.value); setPreset(null); }} className="ww-input py-2" />
          </label>
        </div>
      </div>

      {loading && <p className="text-forest-light dark:text-night-muted">Crunching the numbers…</p>}

      {error && <div className="rounded-xl2 bg-coral/10 p-4 text-sm text-coral-dark">{error}</div>}

      {!loading && !error && summary && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Tile label="Income" value={fmt(t.income)} className="bg-forest text-cream" muted="text-cream/70" />
            <Tile label="Expenses" value={fmt(t.expenses)} className="bg-white text-forest-dark shadow-card dark:bg-night-card dark:text-night-ink" />
            <Tile label={t.savings >= 0 ? "Savings" : "Overspent"} value={fmt(Math.abs(t.savings))} className="bg-gold/15 text-forest-dark shadow-card dark:bg-gold/10 dark:text-night-ink" />
            <Tile label="Savings rate" value={`${Math.round(t.savingsRate * 100)}%`} className="bg-white text-forest-dark shadow-card dark:bg-night-card dark:text-night-ink" />
          </div>

          {/* 3D income vs expenses — kept as-is (item 13) */}
          <div className="rounded-xl2 bg-white p-6 shadow-card dark:bg-night-card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-forest-dark dark:text-night-ink">Income vs. expenses in 3D</h2>
              <span className="text-xs text-forest-light dark:text-night-muted">🖱️ drag to spin · scroll to zoom</span>
            </div>
            <Suspense fallback={<Chart3DFallback />}>
              <SavingsBars3D months={summary.months} currency={currency} />
            </Suspense>
          </div>

          {/* Expense categories over time — line graphs (item 13) */}
          <div className="rounded-xl2 bg-white p-6 shadow-card dark:bg-night-card">
            <h2 className="mb-4 font-display text-lg font-bold text-forest-dark dark:text-night-ink">Expense categories over time</h2>
            {expenseSeries.length === 0 || expense2D.length === 0 ? (
              <p className="py-8 text-center text-forest-light dark:text-night-muted">No expenses in this range yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={expense2D} margin={{ left: 8, right: 16 }}>
                  <CartesianGrid vertical={false} stroke={CHART_INK.grid} />
                  <XAxis dataKey="label" stroke={CHART_INK.muted} fontSize={12} />
                  <YAxis tickFormatter={(v) => formatCompactMoney(v, currency)} stroke={CHART_INK.muted} fontSize={12} width={64} />
                  <Tooltip formatter={fmt} contentStyle={tooltipStyle} />
                  <Legend />
                  {expenseSeries.map((s) => (
                    <Line key={s.name} type="monotone" dataKey={s.name} name={s.name} stroke={s.color} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Monthly income, expenses & savings (2D composed) */}
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

          {/* 3D line graphs replacing the old pie charts (item 14) */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card3D title="Income sources over time (3D)">
              {incomeSeries.length === 0 ? (
                <Empty3D label="No income in this range." />
              ) : (
                <Suspense fallback={<Chart3DFallback />}>
                  <Lines3D series={incomeSeries} labels={labels} currency={currency} />
                </Suspense>
              )}
            </Card3D>
            <Card3D title="Expense categories over time (3D)">
              {expenseSeries.length === 0 ? (
                <Empty3D label="No expenses in this range." />
              ) : (
                <Suspense fallback={<Chart3DFallback />}>
                  <Lines3D series={expenseSeries} labels={labels} currency={currency} />
                </Suspense>
              )}
            </Card3D>
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

function Card3D({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl2 bg-white p-6 shadow-card dark:bg-night-card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-forest-dark dark:text-night-ink">{title}</h2>
        <span className="text-xs text-forest-light dark:text-night-muted">🖱️ drag to spin</span>
      </div>
      {children}
    </div>
  );
}

function Chart3DFallback() {
  return (
    <div className="flex h-80 items-center justify-center rounded-xl2 bg-forest-50 text-forest-light dark:bg-white/5 dark:text-night-muted">
      Loading 3D view…
    </div>
  );
}

function Empty3D({ label }: { label: string }) {
  return <p className="py-16 text-center text-forest-light dark:text-night-muted">{label}</p>;
}

function Tile({ label, value, className, muted = "text-forest-light dark:text-night-muted" }: { label: string; value: string; className: string; muted?: string }) {
  return (
    <div className={`rounded-xl2 p-5 ${className}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${muted}`}>{label}</p>
      <p className="mt-1 font-display text-2xl font-extrabold">{value}</p>
    </div>
  );
}
