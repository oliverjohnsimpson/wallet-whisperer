import { Link } from "react-router-dom";
import type { Budget } from "@/types";
import { BUDGET_TYPE_META } from "@/types";
import { formatMoney, getBudgetProgress } from "@/lib/format";

export default function BudgetCard({ budget }: { budget: Budget }) {
  const { pct, over } = getBudgetProgress(budget);

  return (
    <Link
      to={`/budgets/${budget.id}`}
      className="block rounded-xl2 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-soft dark:bg-night-card"
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{budget.icon || BUDGET_TYPE_META[budget.type].icon}</span>
          <div>
            <p className="font-display font-bold text-forest-dark dark:text-night-ink">{budget.name}</p>
            <p className="text-xs text-forest-light dark:text-night-muted">{BUDGET_TYPE_META[budget.type].label}</p>
          </div>
        </div>
        {budget.status !== "active" && (
          <span className="rounded-full bg-forest-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-forest-light dark:bg-white/10 dark:text-night-muted">
            {budget.status}
          </span>
        )}
      </div>

      <p className="font-display text-2xl font-extrabold text-forest-dark dark:text-night-ink">
        {formatMoney(budget.spent, budget.currency)}
        {budget.target_amount != null && (
          <span className="ml-1 text-sm font-semibold text-forest-light dark:text-night-muted">
            / {formatMoney(budget.target_amount, budget.currency)}
          </span>
        )}
      </p>

      {pct != null && (
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-forest-50 dark:bg-white/10">
          <div
            className={`h-full rounded-full ${over ? "bg-coral" : "bg-gold"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </Link>
  );
}
