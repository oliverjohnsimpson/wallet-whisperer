import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "@/lib/api";
import type { Budget, Expense, ReportSummary } from "@/types";
import { formatMoney } from "@/lib/format";
import BudgetCard from "@/components/BudgetCard";
import ExpenseModal from "@/components/ExpenseModal";
import ExpenseRow from "@/components/ExpenseRow";

export default function Dashboard() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartStr = monthStart.toISOString().slice(0, 10);

  async function loadAll() {
    setLoading(true);
    const [b, e, s] = await Promise.all([
      apiGet("/api/budgets"),
      apiGet("/api/expenses?limit=8"),
      apiGet(`/api/reports/summary?from=${monthStartStr}`),
    ]);
    setBudgets(b ?? []);
    setExpenses(e ?? []);
    setSummary(s);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleExpenseCreated(expense: Expense) {
    setExpenses((prev) => [expense, ...prev].slice(0, 8));
    if (expense.budget_id) {
      setBudgets((prev) =>
        prev.map((b) => (b.id === expense.budget_id ? { ...b, spent: b.spent + Number(expense.amount) } : b))
      );
    }
    // The aggregate summary (top category, totals) isn't safe to derive client-side —
    // refetch just that one cheap endpoint instead of re-loading budgets/expenses too.
    apiGet(`/api/reports/summary?from=${monthStartStr}`).then(setSummary);
  }

  const topCategory = summary?.byCategory[0];

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-forest-dark">Dashboard</h1>
          <p className="text-forest-light">Here's how your money's been talking this month.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="rounded-full bg-coral px-5 py-2.5 font-semibold text-white shadow-card transition hover:bg-coral-dark"
        >
          + Add expense
        </button>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl2 bg-forest p-5 text-cream shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-cream/70">Spent this month</p>
          <p className="mt-1 font-display text-3xl font-extrabold">{formatMoney(summary?.totalSpent ?? 0)}</p>
          <p className="mt-1 text-xs text-cream/70">{summary?.transactionCount ?? 0} transactions</p>
        </div>
        <div className="rounded-xl2 bg-white p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-forest-light">Top category</p>
          <p className="mt-1 font-display text-2xl font-extrabold text-forest-dark">
            {topCategory ? `${topCategory.icon} ${topCategory.label}` : "—"}
          </p>
          <p className="mt-1 text-xs text-forest-light">{topCategory ? formatMoney(topCategory.total) : "No spend yet"}</p>
        </div>
        <div className="rounded-xl2 bg-gold/15 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-forest-light">Active budgets</p>
          <p className="mt-1 font-display text-2xl font-extrabold text-forest-dark">
            {budgets.filter((b) => b.status === "active").length}
          </p>
          <Link to="/budgets" className="mt-1 inline-block text-xs font-semibold text-coral hover:underline">
            View all budgets →
          </Link>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-forest-dark">Your budgets</h2>
        <Link to="/budgets" className="text-sm font-semibold text-coral hover:underline">
          See all
        </Link>
      </div>
      {!loading && budgets.length === 0 && (
        <p className="mb-8 rounded-xl2 bg-white p-6 text-center text-forest-light shadow-card">
          No budgets yet — head to Budgets to create your first one (monthly expenses, a trip, a goal, or a purchase).
        </p>
      )}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {budgets.slice(0, 3).map((b) => (
          <BudgetCard key={b.id} budget={b} />
        ))}
      </div>

      <h2 className="mb-4 font-display text-xl font-bold text-forest-dark">Recent expenses</h2>
      <div className="overflow-hidden rounded-xl2 bg-white shadow-card">
        {expenses.length === 0 && <p className="p-6 text-center text-forest-light">No expenses logged yet.</p>}
        {expenses.map((e) => (
          <ExpenseRow key={e.id} expense={e} />
        ))}
      </div>

      {showModal && <ExpenseModal onClose={() => setShowModal(false)} onCreated={handleExpenseCreated} />}
    </div>
  );
}
