import type { Expense } from "@/types";
import { formatDate, formatMoney } from "@/lib/format";

export default function ExpenseRow({
  expense,
  showMeta = false,
  onEdit,
  onDelete,
}: {
  expense: Expense;
  showMeta?: boolean;
  onEdit?: (expense: Expense) => void;
  onDelete?: (expense: Expense) => void;
}) {
  return (
    <div className="group flex items-center justify-between border-b border-forest/5 px-5 py-3 last:border-0 dark:border-white/5">
      <div className="flex items-center gap-3">
        <span className="text-xl">{expense.categories?.icon ?? "🗂️"}</span>
        <div>
          <p className="font-semibold text-forest-dark dark:text-night-ink">
            {expense.description || expense.merchant || expense.categories?.label}
          </p>
          <p className="text-xs text-forest-light dark:text-night-muted">
            {formatDate(expense.expense_date)}
            {showMeta && expense.categories?.label && ` · ${expense.categories.label}`}
            {showMeta && expense.source !== "manual" && (
              <span className="ml-1 rounded-full bg-forest-50 px-1.5 py-0.5 dark:bg-white/10">via {expense.source}</span>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <p className="font-display font-bold text-forest-dark dark:text-night-ink">
          {formatMoney(expense.amount, expense.currency)}
        </p>
        {(onEdit || onDelete) && (
          <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
            {onEdit && (
              <button
                onClick={() => onEdit(expense)}
                aria-label="Edit expense"
                title="Edit"
                className="rounded-full p-1.5 text-forest-light hover:bg-forest-50 dark:text-night-muted dark:hover:bg-white/10"
              >
                ✏️
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(expense)}
                aria-label="Delete expense"
                title="Delete"
                className="rounded-full p-1.5 text-coral hover:bg-coral/10"
              >
                🗑️
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
