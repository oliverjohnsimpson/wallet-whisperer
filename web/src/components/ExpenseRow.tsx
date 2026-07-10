import type { Expense } from "@/types";
import { formatDate, formatMoney } from "@/lib/format";

export default function ExpenseRow({ expense, showMeta = false }: { expense: Expense; showMeta?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-forest/5 px-5 py-3 last:border-0">
      <div className="flex items-center gap-3">
        <span className="text-xl">{expense.categories?.icon ?? "🗂️"}</span>
        <div>
          <p className="font-semibold text-forest-dark">
            {expense.description || expense.merchant || expense.categories?.label}
          </p>
          <p className="text-xs text-forest-light">
            {formatDate(expense.expense_date)}
            {showMeta && expense.categories?.label && ` · ${expense.categories.label}`}
            {showMeta && expense.source !== "manual" && (
              <span className="ml-1 rounded-full bg-forest-50 px-1.5 py-0.5">via {expense.source}</span>
            )}
          </p>
        </div>
      </div>
      <p className="font-display font-bold text-forest-dark">{formatMoney(expense.amount, expense.currency)}</p>
    </div>
  );
}
