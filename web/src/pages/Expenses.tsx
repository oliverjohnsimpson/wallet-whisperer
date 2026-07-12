import { useEffect, useMemo, useState } from "react";
import { apiGet, apiSend } from "@/lib/api";
import type { Budget, Category, Expense, MonthlySummary } from "@/types";
import { currentMonthStart, formatMoney } from "@/lib/format";
import { findCurrency } from "@/lib/currencies";
import { monthsAgoStart, todayISO, type MonthPreset } from "@/lib/dateRange";
import { FilterSelect, FilterText, PresetButtons } from "@/components/ui/FilterControls";
import ExpenseRow from "@/components/ExpenseRow";
import ExpenseModal from "@/components/ExpenseModal";
import CategoryBars from "@/components/infographics/CategoryBars";

const SOURCE_TYPES = ["manual", "voice", "receipt", "penny"] as const;

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [monthSummary, setMonthSummary] = useState<MonthlySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  // Filters (item 2)
  const [from, setFrom] = useState<string>(monthsAgoStart(12));
  const [to, setTo] = useState<string>(todayISO());
  const [preset, setPreset] = useState<MonthPreset | null>(12);
  const [sourceType, setSourceType] = useState("all");
  const [currencyFilter, setCurrencyFilter] = useState("all");
  const [category, setCategory] = useState("all");
  const [budget, setBudget] = useState("all");
  const [merchant, setMerchant] = useState("");
  const [keyword, setKeyword] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [list, summary, cats, buds] = await Promise.all([
        apiGet("/api/expenses?limit=1000"),
        apiGet(`/api/reports/monthly-summary?from=${currentMonthStart()}`),
        apiGet("/api/categories"),
        apiGet("/api/budgets"),
      ]);
      setExpenses(list ?? []);
      setMonthSummary(summary);
      setCategories(cats ?? []);
      setBudgets(buds ?? []);
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

  async function handleDelete(expense: Expense) {
    if (!confirm("Delete this expense? This can't be undone.")) return;
    await apiSend("DELETE", `/api/expenses/${expense.id}`);
    load();
  }

  const currency = monthSummary?.primaryCurrency ?? "INR";
  const thisMonthTotal = monthSummary?.totals.expenses ?? 0;
  const txnCount = expenses.filter((e) => e.expense_date >= currentMonthStart()).length;

  function applyPreset(p: MonthPreset) {
    setPreset(p);
    setFrom(monthsAgoStart(p));
    setTo(todayISO());
  }

  const currencyOptions = useMemo(() => [...new Set(expenses.map((e) => e.currency))].sort(), [expenses]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    const mq = merchant.trim().toLowerCase();
    return expenses.filter((e) => {
      if (from && e.expense_date < from) return false;
      if (to && e.expense_date > to) return false;
      if (sourceType !== "all" && e.source !== sourceType) return false;
      if (currencyFilter !== "all" && e.currency !== currencyFilter) return false;
      if (category !== "all" && e.category_id !== category) return false;
      if (budget !== "all") {
        if (budget === "none" ? e.budget_id != null : e.budget_id !== budget) return false;
      }
      if (mq && !(e.merchant ?? "").toLowerCase().includes(mq)) return false;
      if (kw && !(e.description ?? "").toLowerCase().includes(kw)) return false;
      return true;
    });
  }, [expenses, from, to, sourceType, currencyFilter, category, budget, merchant, keyword]);

  const filteredTotal = useMemo(
    () => filtered.reduce((s, e) => s + ((e as any).amount_primary != null ? Number((e as any).amount_primary) : e.currency === currency ? Number(e.amount) : 0), 0),
    [filtered, currency]
  );

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-forest-dark dark:text-night-ink">Expenses</h1>
          <p className="text-forest-light dark:text-night-muted">
            Log what you spend — by voice, receipt photo, paste, or a quick slider.
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowModal(true);
          }}
          className="rounded-full bg-coral px-5 py-2.5 font-semibold text-white shadow-card transition hover:bg-coral-dark"
        >
          + Add expense
        </button>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl2 bg-coral/15 p-5 shadow-card dark:bg-coral/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-forest-light dark:text-night-muted">Spent this month</p>
          <p className="mt-1 font-display text-3xl font-extrabold text-forest-dark dark:text-night-ink">{formatMoney(thisMonthTotal, currency)}</p>
          <p className="mt-1 text-xs text-forest-light dark:text-night-muted">{txnCount} transactions</p>
        </div>
        <div className="rounded-xl2 bg-white p-5 shadow-card dark:bg-night-card sm:col-span-2">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-forest-light dark:text-night-muted">Top categories this month</p>
          <CategoryBars items={monthSummary?.byExpenseCategory ?? []} currency={currency} limit={4} emptyLabel="No expenses logged this month yet." />
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
          <FilterSelect label="Category" value={category} onChange={setCategory} options={[["all", "All categories"], ...categories.map((c) => [c.id, `${c.icon} ${c.label}`] as [string, string])]} />
          <FilterSelect label="Budget" value={budget} onChange={setBudget} options={[["all", "All budgets"], ["none", "No budget"], ...budgets.map((b) => [b.id, `${b.icon} ${b.name}`] as [string, string])]} />
          <FilterSelect label="Input type" value={sourceType} onChange={setSourceType} options={[["all", "All types"], ...SOURCE_TYPES.map((t) => [t, t[0].toUpperCase() + t.slice(1)] as [string, string])]} />
          <FilterSelect label="Currency" value={currencyFilter} onChange={setCurrencyFilter} options={[["all", "All currencies"], ...currencyOptions.map((c) => [c, `${findCurrency(c)?.symbol ?? ""} ${c}`.trim()] as [string, string])]} />
          <FilterText label="Merchant" value={merchant} onChange={setMerchant} placeholder="e.g. Amazon" />
          <FilterText label="Description keyword" value={keyword} onChange={setKeyword} placeholder="e.g. groceries" />
        </div>
        <p className="mt-3 text-xs text-forest-light dark:text-night-muted">
          {filtered.length} transaction{filtered.length === 1 ? "" : "s"} · {formatMoney(filteredTotal, currency)} in range
        </p>
      </div>

      <h2 className="mb-4 font-display text-xl font-bold text-forest-dark dark:text-night-ink">All expenses</h2>
      {!loading && filtered.length === 0 && (
        <p className="rounded-xl2 bg-white p-8 text-center text-forest-light shadow-card dark:bg-night-card dark:text-night-muted">
          {expenses.length === 0
            ? 'No expenses logged yet. Tap "Add expense" to record your first — Penny can categorise it for you.'
            : "No expenses match these filters. Try widening the date range or clearing a filter."}
        </p>
      )}
      <div className="overflow-hidden rounded-xl2 bg-white shadow-card dark:bg-night-card">
        {filtered.map((e) => (
          <ExpenseRow
            key={e.id}
            expense={e}
            showMeta
            onEdit={(exp) => {
              setEditing(exp);
              setShowModal(true);
            }}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {showModal && (
        <ExpenseModal
          defaultCurrency={currency}
          expense={editing ?? undefined}
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
