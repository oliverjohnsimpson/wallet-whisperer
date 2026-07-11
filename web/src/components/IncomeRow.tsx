import type { Income } from "@/types";
import { formatDate, formatMoney } from "@/lib/format";

export default function IncomeRow({
  income,
  showMeta = false,
  onEdit,
  onDelete,
}: {
  income: Income;
  showMeta?: boolean;
  onEdit?: (income: Income) => void;
  onDelete?: (income: Income) => void;
}) {
  return (
    <div className="group flex items-center justify-between border-b border-forest/5 px-5 py-3 last:border-0 dark:border-white/5">
      <div className="flex items-center gap-3">
        <span className="text-xl">{income.income_categories?.icon ?? "🪙"}</span>
        <div>
          <p className="font-semibold text-forest-dark dark:text-night-ink">
            {income.description || income.source_name || income.income_categories?.label}
          </p>
          <p className="text-xs text-forest-light dark:text-night-muted">
            {formatDate(income.received_date)}
            {showMeta && income.income_categories?.label && ` · ${income.income_categories.label}`}
            {showMeta && income.entry_source !== "manual" && (
              <span className="ml-1 rounded-full bg-forest-50 px-1.5 py-0.5 dark:bg-white/10">via {income.entry_source}</span>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <p className="font-display font-bold text-forest-light dark:text-gold">
          +{formatMoney(income.amount, income.currency)}
        </p>
        {(onEdit || onDelete) && (
          <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
            {onEdit && (
              <button
                onClick={() => onEdit(income)}
                aria-label="Edit income"
                title="Edit"
                className="rounded-full p-1.5 text-forest-light hover:bg-forest-50 dark:text-night-muted dark:hover:bg-white/10"
              >
                ✏️
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(income)}
                aria-label="Delete income"
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
