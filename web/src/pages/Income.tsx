import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiGet, apiSend } from "@/lib/api";
import type { Category, Income, MonthlySummary } from "@/types";
import { currentMonthStart, formatCompactMoney, formatMoney, formatMonthLabel } from "@/lib/format";
import { currencyNoun, findCurrency } from "@/lib/currencies";
import { monthKeysBetween, monthsAgoStart, todayISO, type MonthPreset } from "@/lib/dateRange";
import { CATEGORICAL_PALETTE, CHART_INK, OTHER_COLOR } from "@/lib/chartPalette";
import { FilterSelect, FilterText, PresetButtons } from "@/components/ui/FilterControls";
import IncomeRow from "@/components/IncomeRow";
import IncomeModal from "@/components/IncomeModal";

const ENTRY_TYPES = ["manual", "voice", "receipt", "penny", "email", "sms"] as const;
const TOP_N = 5;

/** A stable label for an income's "source" — the named source, else its category. */
function sourceKey(i: Income): string {
  return (i.source_name || i.income_categories?.label || "Other").trim() || "Other";
}

export default function IncomePage() {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [monthSummary, setMonthSummary] = useState<MonthlySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Income | null>(null);

  // Filters (item 4)
  const [from, setFrom] = useState<string>(monthsAgoStart(12));
  const [to, setTo] = useState<string>(todayISO());
  const [preset, setPreset] = useState<MonthPreset | null>(12);
  const [entryType, setEntryType] = useState("all");
  const [currencyFilter, setCurrencyFilter] = useState("all");
  const [sourceType, setSourceType] = useState("all"); // income category
  const [sourceName, setSourceName] = useState("all"); // source_name value
  const [keyword, setKeyword] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [list, summary, cats] = await Promise.all([
        apiGet("/api/incomes"),
        apiGet(`/api/reports/monthly-summary?from=${currentMonthStart()}`),
        apiGet("/api/income-categories"),
      ]);
      setIncomes(list ?? []);
      setMonthSummary(summary);
      setCategories(cats ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(income: Income) {
    if (!confirm("Delete this income entry? This can't be undone.")) return;
    await apiSend("DELETE", `/api/incomes/${income.id}`);
    load();
  }

  const currency = monthSummary?.primaryCurrency ?? "INR";
  const thisMonthTotal = monthSummary?.totals.income ?? 0;

  function applyPreset(p: MonthPreset) {
    setPreset(p);
    setFrom(monthsAgoStart(p));
    setTo(todayISO());
  }

  const sourceNameOptions = useMemo(() => {
    const set = new Set<string>();
    incomes.forEach((i) => i.source_name && set.add(i.source_name));
    return [...set].sort();
  }, [incomes]);

  const currencyOptions = useMemo(() => [...new Set(incomes.map((i) => i.currency))].sort(), [incomes]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return incomes.filter((i) => {
      if (from && i.received_date < from) return false;
      if (to && i.received_date > to) return false;
      if (entryType !== "all" && i.entry_source !== entryType) return false;
      if (currencyFilter !== "all" && i.currency !== currencyFilter) return false;
      if (sourceType !== "all" && i.category_id !== sourceType) return false;
      if (sourceName !== "all" && (i.source_name ?? "") !== sourceName) return false;
      if (kw && !(i.description ?? "").toLowerCase().includes(kw)) return false;
      return true;
    });
  }, [incomes, from, to, entryType, currencyFilter, sourceType, sourceName, keyword]);

  const val = (i: Income) => (i.amount_primary != null ? Number(i.amount_primary) : i.currency === currency ? Number(i.amount) : 0);

  const filteredTotal = useMemo(() => filtered.reduce((s, i) => s + val(i), 0), [filtered, currency]);

  // Top Income Sources line chart (item 9): one line per top source over months.
  const { chartData, topSources } = useMemo(() => {
    const totalBySource = new Map<string, number>();
    filtered.forEach((i) => totalBySource.set(sourceKey(i), (totalBySource.get(sourceKey(i)) ?? 0) + val(i)));
    const ranked = [...totalBySource.entries()].sort((a, b) => b[1] - a[1]);
    const top = ranked.slice(0, TOP_N).map(([name]) => name);
    const hasOther = ranked.length > TOP_N;
    const series = hasOther ? [...top, "Other"] : top;

    const months = from && to ? monthKeysBetween(from, to) : [];
    const byMonth = new Map<string, Record<string, number>>();
    months.forEach((m) => byMonth.set(m, {}));
    filtered.forEach((i) => {
      const m = i.received_date.slice(0, 7);
      const bucket = byMonth.get(m);
      if (!bucket) return;
      const key = top.includes(sourceKey(i)) ? sourceKey(i) : "Other";
      bucket[key] = (bucket[key] ?? 0) + val(i);
    });

    const data = months.map((m) => {
      const bucket = byMonth.get(m) ?? {};
      const row: Record<string, number | string> = { label: formatMonthLabel(m, true) };
      series.forEach((s) => (row[s] = Math.round(bucket[s] ?? 0)));
      return row;
    });

    return { chartData: data, topSources: series };
  }, [filtered, from, to, currency]);

  const symbol = findCurrency(currency)?.symbol ?? currency;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-forest-dark dark:text-night-ink">Income</h1>
          <p className="text-forest-light dark:text-night-muted">
            Salary, dividends, interest, rental — every {currencyNoun(currency)} coming in.
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowModal(true);
          }}
          className="rounded-full bg-gold px-5 py-2.5 font-semibold text-forest-dark shadow-card transition hover:bg-gold-light"
        >
          + Add income
        </button>
      </div>

      <div className="mb-6 rounded-xl2 bg-forest p-5 text-cream shadow-soft sm:max-w-xs">
        <p className="text-xs font-semibold uppercase tracking-wide text-cream/70">Income this month</p>
        <p className="mt-1 font-display text-3xl font-extrabold">{formatMoney(thisMonthTotal, currency)}</p>
        <p className="mt-1 text-xs text-cream/70">Converted to your {currency} default currency</p>
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-xl2 bg-white p-4 shadow-card dark:bg-night-card">
        <div className="mb-3">
          <PresetButtons active={preset} onPick={applyPreset} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-forest-light dark:text-night-muted">From</span>
            <input type="date" value={from} max={to} onChange={(e) => { setFrom(e.target.value); setPreset(null); }} className="ww-input py-2" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-forest-light dark:text-night-muted">To</span>
            <input type="date" value={to} min={from} max={todayISO()} onChange={(e) => { setTo(e.target.value); setPreset(null); }} className="ww-input py-2" />
          </label>
          <FilterSelect label="Source type" value={sourceType} onChange={setSourceType} options={[["all", "All source types"], ...categories.map((c) => [c.id, `${c.icon} ${c.label}`] as [string, string])]} />
          <FilterSelect label="Source name" value={sourceName} onChange={setSourceName} options={[["all", "All source names"], ...sourceNameOptions.map((s) => [s, s] as [string, string])]} />
          <FilterSelect label="Input type" value={entryType} onChange={setEntryType} options={[["all", "All types"], ...ENTRY_TYPES.map((t) => [t, t[0].toUpperCase() + t.slice(1)] as [string, string])]} />
          <FilterSelect label="Currency" value={currencyFilter} onChange={setCurrencyFilter} options={[["all", "All currencies"], ...currencyOptions.map((c) => [c, `${findCurrency(c)?.symbol ?? ""} ${c}`.trim()] as [string, string])]} />
          <FilterText label="Description keyword" value={keyword} onChange={setKeyword} placeholder="e.g. bonus" />
        </div>
        <p className="mt-3 text-xs text-forest-light dark:text-night-muted">
          {filtered.length} entr{filtered.length === 1 ? "y" : "ies"} · {formatMoney(filteredTotal, currency)} in range
        </p>
      </div>

      {/* Top Income Sources chart (item 9) */}
      <div className="mb-8 rounded-xl2 bg-white p-6 shadow-card dark:bg-night-card">
        <h2 className="mb-4 font-display text-lg font-bold text-forest-dark dark:text-night-ink">Top Income Sources</h2>
        {topSources.length === 0 || chartData.length === 0 ? (
          <p className="py-8 text-center text-forest-light dark:text-night-muted">No income in this range to chart yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData} margin={{ left: 8, right: 16 }}>
              <CartesianGrid vertical={false} stroke={CHART_INK.grid} />
              <XAxis dataKey="label" stroke={CHART_INK.muted} fontSize={12} />
              <YAxis tickFormatter={(v) => formatCompactMoney(v, currency)} stroke={CHART_INK.muted} fontSize={12} width={64} />
              <Tooltip formatter={(v: number) => formatMoney(v, currency)} contentStyle={{ borderRadius: 12, border: "1px solid #e1e0d9" }} />
              <Legend />
              {topSources.map((s, idx) => (
                <Line
                  key={s}
                  type="monotone"
                  dataKey={s}
                  name={s}
                  stroke={s === "Other" ? OTHER_COLOR : CATEGORICAL_PALETTE[idx % CATEGORICAL_PALETTE.length]}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
        <p className="mt-1 text-xs text-forest-light dark:text-night-muted">Amounts shown in {symbol} {currency}.</p>
      </div>

      {!loading && filtered.length === 0 && (
        <p className="rounded-xl2 bg-white p-8 text-center text-forest-light shadow-card dark:bg-night-card dark:text-night-muted">
          No income matches these filters. Try widening the date range or clearing a filter.
        </p>
      )}

      <div className="overflow-hidden rounded-xl2 bg-white shadow-card dark:bg-night-card">
        {filtered.map((i) => (
          <IncomeRow
            key={i.id}
            income={i}
            showMeta
            onEdit={(inc) => {
              setEditing(inc);
              setShowModal(true);
            }}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {showModal && (
        <IncomeModal
          defaultCurrency={currency}
          income={editing ?? undefined}
          onClose={() => {
            setShowModal(false);
            setEditing(null);
          }}
          onCreated={() => load()}
        />
      )}
    </div>
  );
}
