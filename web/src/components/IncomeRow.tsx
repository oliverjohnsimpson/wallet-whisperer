import type { Income } from "@/types";
import { formatDate, formatMoney } from "@/lib/format";

export default function IncomeRow({ income, showMeta = false }: { income: Income; showMeta?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-forest/5 px-5 py-3 last:border-0">
      <div className="flex items-center gap-3">
        <span className="text-xl">{income.income_categories?.icon ?? "🪙"}</span>
        <div>
          <p className="font-semibold text-forest-dark">
            {income.description || income.source_name || income.income_categories?.label}
          </p>
          <p className="text-xs text-forest-light">
            {formatDate(income.received_date)}
            {showMeta && income.income_categories?.label && ` · ${income.income_categories.label}`}
            {showMeta && income.entry_source !== "manual" && (
              <span className="ml-1 rounded-full bg-forest-50 px-1.5 py-0.5">via {income.entry_source}</span>
            )}
          </p>
        </div>
      </div>
      <p className="font-display font-bold text-forest-light">+{formatMoney(income.amount, income.currency)}</p>
    </div>
  );
}
