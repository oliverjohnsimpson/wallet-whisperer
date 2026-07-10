import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiGet } from "@/lib/api";
import type { Budget, ReportSummary } from "@/types";
import { formatMoney } from "@/lib/format";
import { CATEGORICAL_PALETTE, CHART_INK, OTHER_COLOR } from "@/lib/chartPalette";

type RangePreset = "30d" | "90d" | "mtd" | "365d" | "all";

const PRESETS: { id: RangePreset; label: string }[] = [
  { id: "mtd", label: "Month to date" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
  { id: "365d", label: "Last 12 months" },
  { id: "all", label: "All time" },
];

function rangeFrom(preset: RangePreset): string | null {
  const now = new Date();
  if (preset === "mtd") return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  if (preset === "30d") return new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
  if (preset === "90d") return new Date(now.getTime() - 90 * 86400000).toISOString().slice(0, 10);
  if (preset === "365d") return new Date(now.getTime() - 365 * 86400000).toISOString().slice(0, 10);
  return null;
}

const MAX_CATEGORY_SLOTS = 7;

export default function Reports() {
  const [preset, setPreset] = useState<RangePreset>("mtd");
  const [budgetFilter, setBudgetFilter] = useState<string>("");
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const requestIdRef = useRef(0);

  useEffect(() => {
    apiGet("/api/budgets").then((data) => setBudgets(data ?? []));
  }, []);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    const from = rangeFrom(preset);
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (budgetFilter) params.set("budget_id", budgetFilter);
    apiGet(`/api/reports/summary?${params.toString()}`).then((data) => {
      if (requestId !== requestIdRef.current) return; // a newer filter change superseded this response
      setSummary(data);
      setLoading(false);
    });
  }, [preset, budgetFilter]);

  const categoryData = useMemo(() => {
    if (!summary) return [];
    const sorted = [...summary.byCategory].sort((a, b) => b.total - a.total);
    const top = sorted.slice(0, MAX_CATEGORY_SLOTS).map((c, i) => ({
      name: `${c.icon} ${c.label}`,
      total: c.total,
      fill: CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length],
    }));
    const rest = sorted.slice(MAX_CATEGORY_SLOTS);
    if (rest.length > 0) {
      top.push({ name: "Other", total: rest.reduce((s, c) => s + c.total, 0), fill: OTHER_COLOR });
    }
    return top;
  }, [summary]);

  const monthData = useMemo(
    () => (summary?.byMonth ?? []).map((m) => ({ ...m, label: m.month })),
    [summary]
  );

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-extrabold text-forest-dark">Reports</h1>
        <p className="text-forest-light">Slice your spending by time, category, and budget.</p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPreset(p.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              preset === p.id ? "bg-forest text-cream shadow-card" : "bg-white text-forest-dark shadow-card"
            }`}
          >
            {p.label}
          </button>
        ))}
        <select
          value={budgetFilter}
          onChange={(e) => setBudgetFilter(e.target.value)}
          className="rounded-full border border-forest/15 bg-white px-4 py-1.5 text-sm font-semibold text-forest-dark"
        >
          <option value="">All budgets</option>
          {budgets.map((b) => (
            <option key={b.id} value={b.id}>
              {b.icon} {b.name}
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="text-forest-light">Crunching the numbers…</p>}

      {!loading && summary && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl2 bg-forest p-5 text-cream shadow-soft">
              <p className="text-xs font-semibold uppercase tracking-wide text-cream/70">Total spent</p>
              <p className="mt-1 font-display text-3xl font-extrabold">{formatMoney(summary.totalSpent)}</p>
            </div>
            <div className="rounded-xl2 bg-white p-5 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-wide text-forest-light">Transactions</p>
              <p className="mt-1 font-display text-3xl font-extrabold text-forest-dark">{summary.transactionCount}</p>
            </div>
            <div className="rounded-xl2 bg-white p-5 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-wide text-forest-light">Avg. transaction</p>
              <p className="mt-1 font-display text-3xl font-extrabold text-forest-dark">
                {formatMoney(summary.transactionCount ? summary.totalSpent / summary.transactionCount : 0)}
              </p>
            </div>
          </div>

          <div className="rounded-xl2 bg-white p-6 shadow-card">
            <h2 className="mb-4 font-display text-lg font-bold text-forest-dark">Spend by category</h2>
            {categoryData.length === 0 ? (
              <p className="text-forest-light">No expenses in this range yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(220, categoryData.length * 44)}>
                <BarChart data={categoryData} layout="vertical" margin={{ left: 24, right: 24 }}>
                  <CartesianGrid horizontal={false} stroke={CHART_INK.grid} />
                  <XAxis type="number" tickFormatter={(v) => formatMoney(v)} stroke={CHART_INK.muted} fontSize={12} />
                  <YAxis type="category" dataKey="name" width={160} stroke={CHART_INK.secondary} fontSize={13} />
                  <Tooltip
                    formatter={(v: number) => formatMoney(v)}
                    contentStyle={{ borderRadius: 12, border: "1px solid #e1e0d9" }}
                  />
                  <Bar dataKey="total" radius={[0, 6, 6, 0]} barSize={20}>
                    {categoryData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="rounded-xl2 bg-white p-6 shadow-card">
            <h2 className="mb-4 font-display text-lg font-bold text-forest-dark">Spend over time</h2>
            {monthData.length === 0 ? (
              <p className="text-forest-light">No expenses in this range yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={monthData} margin={{ left: 8, right: 16 }}>
                  <defs>
                    <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CATEGORICAL_PALETTE[0]} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={CATEGORICAL_PALETTE[0]} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={CHART_INK.grid} />
                  <XAxis dataKey="label" stroke={CHART_INK.muted} fontSize={12} />
                  <YAxis tickFormatter={(v) => formatMoney(v)} stroke={CHART_INK.muted} fontSize={12} width={80} />
                  <Tooltip formatter={(v: number) => formatMoney(v)} contentStyle={{ borderRadius: 12, border: "1px solid #e1e0d9" }} />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke={CATEGORICAL_PALETTE[0]}
                    strokeWidth={2}
                    fill="url(#spendFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {summary.byBudget.length > 0 && (
            <div className="rounded-xl2 bg-white p-6 shadow-card">
              <h2 className="mb-4 font-display text-lg font-bold text-forest-dark">Spend by budget</h2>
              <div className="space-y-3">
                {summary.byBudget.map((b, i) => (
                  <div key={b.budget_id} className="flex items-center gap-3">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length] }}
                    />
                    <span className="flex-1 font-semibold text-forest-dark">{b.name}</span>
                    <span className="font-display font-bold text-forest-dark">{formatMoney(b.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
