import { useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/api";
import type { Income, MonthlySummary } from "@/types";
import { currentMonthStart, formatMoney } from "@/lib/format";
import IncomeRow from "@/components/IncomeRow";
import IncomeModal from "@/components/IncomeModal";

export default function IncomePage() {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [monthSummary, setMonthSummary] = useState<MonthlySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Income | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [list, summary] = await Promise.all([
        apiGet("/api/incomes"),
        apiGet(`/api/reports/monthly-summary?from=${currentMonthStart()}`),
      ]);
      setIncomes(list ?? []);
      setMonthSummary(summary);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(income: Income) {
    if (!confirm("Delete this income entry? This can't be undone.")) return;
    await apiSend("DELETE", `/api/incomes/${income.id}`);
    load();
  }

  const currency = monthSummary?.primaryCurrency ?? "INR";
  const thisMonthTotal = monthSummary?.totals.income ?? 0;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-forest-dark dark:text-night-ink">Income</h1>
          <p className="text-forest-light dark:text-night-muted">
            Salary, dividends, interest, rental — every rupee coming in.
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowModal(true);
          }}
          className="rounded-full bg-gold px-5 py-2.5 font-semibold text-forest-dark shadow-card transition hover:bg-gold-light"
        >
          + Add income
        </button>
      </div>

      <div className="mb-8 rounded-xl2 bg-forest p-5 text-cream shadow-soft sm:max-w-xs">
        <p className="text-xs font-semibold uppercase tracking-wide text-cream/70">Income this month</p>
        <p className="mt-1 font-display text-3xl font-extrabold">{formatMoney(thisMonthTotal, currency)}</p>
        <p className="mt-1 text-xs text-cream/70">Converted to your {currency} default currency</p>
      </div>

      {!loading && incomes.length === 0 && (
        <p className="rounded-xl2 bg-white p-8 text-center text-forest-light shadow-card dark:bg-night-card dark:text-night-muted">
          No income logged yet. Add your salary, a dividend credit, or interest — by voice, payslip photo, or pasting a
          bank alert.
        </p>
      )}

      <div className="overflow-hidden rounded-xl2 bg-white shadow-card dark:bg-night-card">
        {incomes.map((i) => (
          <IncomeRow
            key={i.id}
            income={i}
            showMeta
            onEdit={(inc) => {
              setEditing(inc);
              setShowModal(true);
            }}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {showModal && (
        <IncomeModal
          defaultCurrency={currency}
          income={editing ?? undefined}
          onClose={() => {
            setShowModal(false);
            setEditing(null);
          }}
          onCreated={() => load()}
        />
      )}
    </div>
  );
}
