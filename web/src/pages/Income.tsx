import { useEffect, useMemo, useState } from "react";
import { apiGet, apiSend } from "@/lib/api";
import type { Category, Income, MonthlySummary } from "@/types";
import { currentMonthStart, formatMoney } from "@/lib/format";
import { currencyNoun, findCurrency } from "@/lib/currencies";
import { monthsAgoStart, todayISO, type MonthPreset } from "@/lib/dateRange";
import { FilterSelect, FilterText, PresetButtons } from "@/components/ui/FilterControls";
import IncomeRow from "@/components/IncomeRow";
import IncomeModal from "@/components/IncomeModal";
import CategoryBars from "@/components/infographics/CategoryBars";

const ENTRY_TYPES = ["manual", "voice", "receipt", "penny", "email", "sms"] as const;

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
    const onChange = () => load();
    window.addEventListener("ww:data-changed", onChange);
    return () => window.removeEventListener("ww:data-changed", onChange);
  }, []);

  async function handleDelete(income: Income) {
    if (!confirm("Delete this income entry? This can't be undone.")) return;
    await apiSend("DELETE", `/api/incomes/${income.id}`);
    load();
  }

  const currency = monthSummary?.primaryCurrency ?? "INR";
  const thisMonthTotal = monthSummary?.totals.income ?? 0;
  const txnCount = incomes.filter((i) => i.received_date >= currentMonthStart()).length;

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

  const filteredTotal = useMemo(
    () => filtered.reduce((s, i) => s + (i.amount_primary != null ? Number(i.amount_primary) : i.currency === currency ? Number(i.amount) : 0), 0),
    [filtered, currency]
  );

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

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl2 bg-forest p-5 text-cream shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-cream/70">Income this month</p>
          <p className="mt-1 font-display text-3xl font-extrabold">{formatMoney(thisMonthTotal, currency)}</p>
          <p className="mt-1 text-xs text-cream/70">{txnCount} entries</p>
        </div>
        <div className="rounded-xl2 bg-white p-5 shadow-card dark:bg-night-card sm:col-span-2">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-forest-light dark:text-night-muted">Top income sources this month</p>
          <CategoryBars items={monthSummary?.byIncomeCategory ?? []} currency={currency} limit={4} emptyLabel="No income logged this month yet." />
        </div>
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

      <h2 className="mb-4 font-display text-xl font-bold text-forest-dark dark:text-night-ink">All income</h2>
      {!loading && filtered.length === 0 && (
        <p className="rounded-xl2 bg-white p-8 text-center text-forest-light shadow-card dark:bg-night-card dark:text-night-muted">
          {incomes.length === 0
            ? "No income logged yet. Add your salary, a dividend credit, or interest — by voice, payslip photo, or pasting a bank alert."
            : "No income matches these filters. Try widening the date range or clearing a filter."}
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
