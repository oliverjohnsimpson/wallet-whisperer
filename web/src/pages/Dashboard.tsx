import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "@/lib/api";
import type { Expense, Income, MonthlySummary } from "@/types";
import { currentMonthStart, formatMoney } from "@/lib/format";
import ExpenseModal from "@/components/ExpenseModal";
import IncomeModal from "@/components/IncomeModal";
import ExpenseRow from "@/components/ExpenseRow";
import IncomeRow from "@/components/IncomeRow";
import SavingsGauge from "@/components/infographics/SavingsGauge";
import FlowBar from "@/components/infographics/FlowBar";
import CategoryBars from "@/components/infographics/CategoryBars";
import MonthlyBars from "@/components/infographics/MonthlyBars";

export default function Dashboard() {
  const [monthSummary, setMonthSummary] = useState<MonthlySummary | null>(null);
  const [yearSummary, setYearSummary] = useState<MonthlySummary | null>(null);
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([]);
  const [recentIncomes, setRecentIncomes] = useState<Income[]>([]);
  const [showExpense, setShowExpense] = useState(false);
  const [showIncome, setShowIncome] = useState(false);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [m, y, e, i] = await Promise.all([
        apiGet(`/api/reports/monthly-summary?from=${currentMonthStart()}`),
        apiGet(`/api/reports/monthly-summary`),
        apiGet("/api/expenses?limit=6"),
        apiGet("/api/incomes?limit=6"),
      ]);
      setMonthSummary(m);
      setYearSummary(y);
      setRecentExpenses(e ?? []);
      setRecentIncomes(i ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Couldn't load your dashboard. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currency = monthSummary?.primaryCurrency ?? "INR";
  const t = monthSummary?.totals ?? { income: 0, expenses: 0, savings: 0, savingsRate: 0 };

  const recentActivity = [
    ...recentIncomes.map((i) => ({ kind: "income" as const, date: i.received_date, income: i })),
    ...recentExpenses.map((e) => ({ kind: "expense" as const, date: e.expense_date, expense: e })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);

  const monthLabel = new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-forest-dark">Dashboard</h1>
          <p className="text-forest-light">Your money for {monthLabel}, at a glance.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowIncome(true)}
            className="rounded-full bg-gold px-5 py-2.5 font-semibold text-forest-dark shadow-card transition hover:bg-gold-light"
          >
            + Income
          </button>
          <button
            onClick={() => setShowExpense(true)}
            className="rounded-full bg-coral px-5 py-2.5 font-semibold text-white shadow-card transition hover:bg-coral-dark"
          >
            + Expense
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-center justify-between rounded-xl2 bg-coral/10 p-4 text-sm text-coral-dark">
          <span>{error}</span>
          <button onClick={loadAll} className="font-semibold underline">
            Retry
          </button>
        </div>
      )}

      {/* Hero: this month's income -> expenses -> savings */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl2 bg-white p-6 shadow-card lg:col-span-2">
          <h2 className="mb-4 font-display text-lg font-bold text-forest-dark">This month's flow</h2>
          <FlowBar income={t.income} expenses={t.expenses} currency={currency} />
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl2 bg-forest p-6 text-cream shadow-soft">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-cream/70">Savings rate</p>
          <div className="rounded-full bg-cream/95 p-1">
            <SavingsGauge rate={t.savingsRate} />
          </div>
          <p className="mt-3 font-display text-2xl font-extrabold">{formatMoney(t.savings, currency)}</p>
          <p className="text-xs text-cream/70">saved this month</p>
        </div>
      </div>

      {/* Stat strip */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Income" value={formatMoney(t.income, currency)} tone="income" />
        <StatTile label="Expenses" value={formatMoney(t.expenses, currency)} tone="expense" />
        <StatTile
          label={t.savings >= 0 ? "Savings" : "Overspent"}
          value={formatMoney(Math.abs(t.savings), currency)}
          tone={t.savings >= 0 ? "savings" : "over"}
        />
      </div>

      {/* Category infographics */}
      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl2 bg-white p-6 shadow-card">
          <h2 className="mb-4 font-display text-lg font-bold text-forest-dark">Where income came from</h2>
          <CategoryBars
            items={monthSummary?.byIncomeCategory ?? []}
            currency={currency}
            emptyLabel="No income logged this month yet."
          />
        </div>
        <div className="rounded-xl2 bg-white p-6 shadow-card">
          <h2 className="mb-4 font-display text-lg font-bold text-forest-dark">Where money went</h2>
          <CategoryBars
            items={monthSummary?.byExpenseCategory ?? []}
            currency={currency}
            emptyLabel="No expenses logged this month yet."
          />
        </div>
      </div>

      {/* Savings trend */}
      <div className="mb-8 rounded-xl2 bg-white p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-forest-dark">Income vs. expenses over time</h2>
          <Link to="/reports" className="text-sm font-semibold text-coral hover:underline">
            Full reports →
          </Link>
        </div>
        <MonthlyBars months={yearSummary?.months ?? []} currency={currency} />
      </div>

      {/* Recent activity */}
      <h2 className="mb-4 font-display text-xl font-bold text-forest-dark">Recent activity</h2>
      <div className="overflow-hidden rounded-xl2 bg-white shadow-card">
        {!loading && recentActivity.length === 0 && (
          <p className="p-6 text-center text-forest-light">Nothing logged yet — add some income or an expense.</p>
        )}
        {recentActivity.map((a) =>
          a.kind === "income" ? (
            <IncomeRow key={`i-${a.income.id}`} income={a.income} />
          ) : (
            <ExpenseRow key={`e-${a.expense.id}`} expense={a.expense} />
          )
        )}
      </div>

      {showExpense && <ExpenseModal onClose={() => setShowExpense(false)} onCreated={() => loadAll()} />}
      {showIncome && (
        <IncomeModal defaultCurrency={currency} onClose={() => setShowIncome(false)} onCreated={() => loadAll()} />
      )}
    </div>
  );
}

function StatTile({ label, value, tone }: { label: string; value: string; tone: "income" | "expense" | "savings" | "over" }) {
  const styles: Record<string, string> = {
    income: "bg-forest text-cream",
    expense: "bg-white text-forest-dark shadow-card",
    savings: "bg-gold/15 text-forest-dark shadow-card",
    over: "bg-coral/15 text-coral-dark shadow-card",
  };
  const labelColor = tone === "income" ? "text-cream/70" : "text-forest-light";
  return (
    <div className={`rounded-xl2 p-5 ${styles[tone]}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${labelColor}`}>{label}</p>
      <p className="mt-1 font-display text-3xl font-extrabold">{value}</p>
    </div>
  );
}
