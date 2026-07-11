import { formatMoney } from "@/lib/format";

/**
 * Visualises the month's flow: total income as the full bar, with the expenses
 * portion carved out (coral) and the remaining savings (green). If expenses
 * exceed income, the whole bar is coral and an "over" note appears.
 */
export default function FlowBar({
  income,
  expenses,
  currency,
}: {
  income: number;
  expenses: number;
  currency: string;
}) {
  const savings = income - expenses;
  const over = savings < 0;
  // Bar segments as % of the larger of income vs expenses so overspend is visible.
  const scale = Math.max(income, expenses, 1);
  const expensePct = (Math.min(expenses, scale) / scale) * 100;
  const savingsPct = over ? 0 : (savings / scale) * 100;

  return (
    <div>
      <div className="mb-2 flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-forest-light dark:text-night-muted">Income</p>
          <p className="font-display text-xl font-extrabold text-forest-dark dark:text-night-ink">{formatMoney(income, currency)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-forest-light dark:text-night-muted">
            {over ? "Overspent" : "Savings"}
          </p>
          <p className={`font-display text-xl font-extrabold ${over ? "text-coral-dark dark:text-coral-light" : "text-forest dark:text-gold"}`}>
            {formatMoney(Math.abs(savings), currency)}
          </p>
        </div>
      </div>

      <div className="flex h-6 w-full overflow-hidden rounded-full bg-forest-50 dark:bg-white/10">
        <div
          className="h-full bg-coral transition-all"
          style={{ width: `${expensePct}%` }}
          title={`Expenses: ${formatMoney(expenses, currency)}`}
        />
        <div
          className="h-full bg-forest-light transition-all"
          style={{ width: `${savingsPct}%` }}
          title={`Savings: ${formatMoney(savings, currency)}`}
        />
      </div>

      <div className="mt-2 flex items-center gap-4 text-xs text-forest-light dark:text-night-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-coral" /> Expenses {formatMoney(expenses, currency)}
        </span>
        {!over && (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-forest-light" /> Savings {formatMoney(savings, currency)}
          </span>
        )}
      </div>
    </div>
  );
}
