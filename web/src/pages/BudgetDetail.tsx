import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiGet, apiSend } from "@/lib/api";
import type { Budget, Expense } from "@/types";
import { BUDGET_TYPE_META } from "@/types";
import { formatDate, formatMoney, getBudgetProgress } from "@/lib/format";
import ExpenseModal from "@/components/ExpenseModal";
import ExpenseRow from "@/components/ExpenseRow";

export default function BudgetDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [budget, setBudget] = useState<Budget | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);
  const requestIdRef = useRef(0);

  async function load() {
    if (!id) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    const [b, e] = await Promise.all([apiGet(`/api/budgets/${id}`), apiGet(`/api/expenses?budget_id=${id}`)]);
    if (requestId !== requestIdRef.current) return; // a newer request (e.g. a fast id change) superseded this one
    const spent = (e ?? []).reduce((sum: number, x: Expense) => sum + Number(x.amount), 0);
    setBudget({ ...b, spent });
    setExpenses(e ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function handleExpenseCreated(expense: Expense) {
    setExpenses((prev) => [expense, ...prev]);
    setBudget((prev) => (prev ? { ...prev, spent: prev.spent + Number(expense.amount) } : prev));
  }

  async function deleteBudget() {
    if (!id || !confirm("Delete this budget? Its expenses will be kept but unlinked.")) return;
    await apiSend("DELETE", `/api/budgets/${id}`);
    navigate("/budgets");
  }

  async function deleteExpense(expense: Expense) {
    if (!confirm("Delete this expense? This can't be undone.")) return;
    await apiSend("DELETE", `/api/expenses/${expense.id}`);
    load();
  }

  if (loading || !budget) {
    return <div className="p-8 text-forest-light dark:text-night-muted">Loading budget…</div>;
  }

  const { pct, over } = getBudgetProgress(budget);

  return (
    <div className="p-8">
      <Link to="/budgets" className="mb-4 inline-block text-sm font-semibold text-coral hover:underline">
        ← Back to budgets
      </Link>

      <div className="mb-8 flex flex-col items-start justify-between gap-4 rounded-xl2 bg-white p-6 shadow-card dark:bg-night-card sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="text-4xl">{budget.icon || BUDGET_TYPE_META[budget.type].icon}</span>
          <div>
            <h1 className="font-display text-2xl font-extrabold text-forest-dark dark:text-night-ink">{budget.name}</h1>
            <p className="text-sm text-forest-light dark:text-night-muted">
              {BUDGET_TYPE_META[budget.type].label}
              {budget.end_date && <span> · 🎯 Target date: {formatDate(budget.end_date)}</span>}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-display text-3xl font-extrabold text-forest-dark dark:text-night-ink">
            {formatMoney(budget.spent, budget.currency)}
            {budget.target_amount != null && (
              <span className="ml-1 text-base font-semibold text-forest-light dark:text-night-muted">
                / {formatMoney(budget.target_amount, budget.currency)}
              </span>
            )}
          </p>
          {pct != null && (
            <div className="mt-2 h-2 w-40 overflow-hidden rounded-full bg-forest-50 dark:bg-white/10">
              <div className={`h-full rounded-full ${over ? "bg-coral" : "bg-gold"}`} style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
      </div>

      <div className="mb-6 flex gap-3">
        <button
          onClick={() => setShowModal(true)}
          className="rounded-full bg-coral px-5 py-2.5 font-semibold text-white shadow-card transition hover:bg-coral-dark"
        >
          + Add expense
        </button>
        <button
          onClick={deleteBudget}
          className="rounded-full border border-coral/30 px-5 py-2.5 font-semibold text-coral-dark transition hover:bg-coral/10"
        >
          Delete budget
        </button>
      </div>

      <h2 className="mb-4 font-display text-xl font-bold text-forest-dark dark:text-night-ink">Expenses</h2>
      <div className="overflow-hidden rounded-xl2 bg-white shadow-card dark:bg-night-card">
        {expenses.length === 0 && <p className="p-6 text-center text-forest-light dark:text-night-muted">No expenses logged against this budget yet.</p>}
        {expenses.map((e) => (
          <ExpenseRow
            key={e.id}
            expense={e}
            showMeta
            onEdit={(exp) => {
              setEditing(exp);
              setShowModal(true);
            }}
            onDelete={deleteExpense}
          />
        ))}
      </div>

      {showModal && (
        <ExpenseModal
          defaultBudgetId={budget.id}
          defaultCurrency={budget.currency}
          expense={editing ?? undefined}
          onClose={() => {
            setShowModal(false);
            setEditing(null);
          }}
          onCreated={editing ? () => load() : handleExpenseCreated}
        />
      )}
    </div>
  );
}
