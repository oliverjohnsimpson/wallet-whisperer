import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import type { Income } from "@/types";
import { formatMoney } from "@/lib/format";
import IncomeRow from "@/components/IncomeRow";
import IncomeModal from "@/components/IncomeModal";

export default function IncomePage() {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartStr = monthStart.toISOString().slice(0, 10);

  useEffect(() => {
    apiGet("/api/incomes")
      .then((data) => setIncomes(data ?? []))
      .finally(() => setLoading(false));
  }, []);

  const thisMonth = incomes.filter((i) => i.received_date >= monthStartStr);
  const thisMonthTotal = thisMonth.reduce((sum, i) => sum + Number(i.amount_primary ?? i.amount), 0);

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-forest-dark">Income</h1>
          <p className="text-forest-light">Salary, dividends, interest, rental — every rupee coming in.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="rounded-full bg-gold px-5 py-2.5 font-semibold text-forest-dark shadow-card transition hover:bg-gold-light"
        >
          + Add income
        </button>
      </div>

      <div className="mb-8 rounded-xl2 bg-forest p-5 text-cream shadow-soft sm:max-w-xs">
        <p className="text-xs font-semibold uppercase tracking-wide text-cream/70">Income this month</p>
        <p className="mt-1 font-display text-3xl font-extrabold">{formatMoney(thisMonthTotal)}</p>
        <p className="mt-1 text-xs text-cream/70">{thisMonth.length} entries</p>
      </div>

      {!loading && incomes.length === 0 && (
        <p className="rounded-xl2 bg-white p-8 text-center text-forest-light shadow-card">
          No income logged yet. Add your salary, a dividend credit, or interest — by voice, payslip photo, or pasting a
          bank alert.
        </p>
      )}

      <div className="overflow-hidden rounded-xl2 bg-white shadow-card">
        {incomes.map((i) => (
          <IncomeRow key={i.id} income={i} showMeta />
        ))}
      </div>

      {showModal && (
        <IncomeModal onClose={() => setShowModal(false)} onCreated={(i) => setIncomes((prev) => [i, ...prev])} />
      )}
    </div>
  );
}
