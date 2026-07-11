import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import type { Expense, MonthlySummary } from "@/types";
import { currentMonthStart, formatMoney } from "@/lib/format";
import ExpenseRow from "@/components/ExpenseRow";
import ExpenseModal from "@/components/ExpenseModal";
import CategoryBars from "@/components/infographics/CategoryBars";

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [monthSummary, setMonthSummary] = useState<MonthlySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [list, summary] = await Promise.all([
        apiGet("/api/expenses?limit=100"),
        apiGet(`/api/reports/monthly-summary?from=${currentMonthStart()}`),
      ]);
      setExpenses(list ?? []);
      setMonthSummary(summary);
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

  const currency = monthSummary?.primaryCurrency ?? "INR";
  const thisMonthTotal = monthSummary?.totals.expenses ?? 0;
  const txnCount = expenses.filter((e) => e.expense_date >= currentMonthStart()).length;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-forest-dark dark:text-night-ink">Expenses</h1>
          <p className="text-forest-light dark:text-night-muted">
            Log what you spend — by voice, receipt photo, or a quick slider.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="rounded-full bg-coral px-5 py-2.5 font-semibold text-white shadow-card transition hover:bg-coral-dark"
        >
          + Add expense
        </button>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl2 bg-coral/15 p-5 shadow-card dark:bg-coral/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-forest-light dark:text-night-muted">
            Spent this month
          </p>
          <p className="mt-1 font-display text-3xl font-extrabold text-forest-dark dark:text-night-ink">
            {formatMoney(thisMonthTotal, currency)}
          </p>
          <p className="mt-1 text-xs text-forest-light dark:text-night-muted">{txnCount} transactions</p>
        </div>
        <div className="rounded-xl2 bg-white p-5 shadow-card dark:bg-night-card sm:col-span-2">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-forest-light dark:text-night-muted">
            Top categories this month
          </p>
          <CategoryBars
            items={monthSummary?.byExpenseCategory ?? []}
            currency={currency}
            limit={4}
            emptyLabel="No expenses logged this month yet."
          />
        </div>
      </div>

      <h2 className="mb-4 font-display text-xl font-bold text-forest-dark dark:text-night-ink">All expenses</h2>
      {!loading && expenses.length === 0 && (
        <p className="rounded-xl2 bg-white p-8 text-center text-forest-light shadow-card dark:bg-night-card dark:text-night-muted">
          No expenses logged yet. Tap "Add expense" to record your first — Penny can categorise it for you.
        </p>
      )}
      <div className="overflow-hidden rounded-xl2 bg-white shadow-card dark:bg-night-card">
        {expenses.map((e) => (
          <ExpenseRow key={e.id} expense={e} showMeta />
        ))}
      </div>

      {showModal && <ExpenseModal onClose={() => setShowModal(false)} onCreated={() => load()} />}
    </div>
  );
}
