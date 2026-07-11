import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import type { Budget } from "@/types";
import BudgetCard from "@/components/BudgetCard";
import CreateBudgetModal from "@/components/CreateBudgetModal";

export default function Budgets() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    apiGet("/api/budgets")
      .then((data) => setBudgets(data ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-forest-dark dark:text-night-ink">Budgets</h1>
          <p className="text-forest-light dark:text-night-muted">
            Monthly spends, trips, goals, purchases — track it all in one place.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-full bg-forest px-5 py-2.5 font-semibold text-cream shadow-card transition hover:bg-forest-dark"
        >
          + New budget
        </button>
      </div>

      {!loading && budgets.length === 0 && (
        <p className="rounded-xl2 bg-white p-8 text-center text-forest-light shadow-card dark:bg-night-card dark:text-night-muted">
          You haven't created any budgets yet. Try "Monthly Expenditure", "Goa Trip", "Emergency Fund Goal", or "New
          Laptop".
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {budgets.map((b) => (
          <BudgetCard key={b.id} budget={b} />
        ))}
      </div>

      {showCreate && (
        <CreateBudgetModal onClose={() => setShowCreate(false)} onCreated={(b) => setBudgets((prev) => [b, ...prev])} />
      )}
    </div>
  );
}
