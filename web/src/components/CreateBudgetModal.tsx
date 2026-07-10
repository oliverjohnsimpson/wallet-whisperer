import { useState } from "react";
import { apiSend } from "@/lib/api";
import type { Budget, BudgetType } from "@/types";
import { BUDGET_TYPE_META } from "@/types";
import Modal from "@/components/ui/Modal";
import { FormField, inputClass } from "@/components/ui/FormField";

export default function CreateBudgetModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (budget: Budget) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<BudgetType>("monthly_expenditure");
  const [targetAmount, setTargetAmount] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await apiSend("POST", "/api/budgets", {
        name,
        type,
        currency,
        target_amount: targetAmount ? Number(targetAmount) : null,
        end_date: endDate || null,
        icon: BUDGET_TYPE_META[type].icon,
      });
      onCreated({ ...created, spent: 0 });
      onClose();
    } catch (err: any) {
      setError(err.message ?? "Couldn't create that budget.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="New budget" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <FormField label="Name">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. July groceries, Goa trip, New laptop"
            className={inputClass}
          />
        </FormField>

        <FormField label="Type">
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(BUDGET_TYPE_META) as BudgetType[]).map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => setType(t)}
                className={`rounded-lg border px-3 py-2 text-left text-sm font-semibold transition ${
                  type === t ? "border-gold bg-gold/10 text-forest-dark" : "border-forest/15 text-forest-light"
                }`}
              >
                {BUDGET_TYPE_META[t].icon} {BUDGET_TYPE_META[t].label}
              </button>
            ))}
          </div>
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Target amount">
            <input
              type="number"
              min="0"
              step="0.01"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              placeholder="Optional"
              className={inputClass}
            />
          </FormField>
          <FormField label="Currency">
            <input
              required
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              maxLength={3}
              className={`${inputClass} uppercase`}
            />
          </FormField>
        </div>

        <FormField label="Target date (optional)">
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
        </FormField>

        {error && <p className="rounded-lg bg-coral/10 p-2 text-sm text-coral-dark">{error}</p>}

        <button
          type="submit"
          disabled={saving || !name}
          className="w-full rounded-full bg-forest py-3 font-semibold text-cream shadow-card disabled:opacity-60"
        >
          {saving ? "Creating…" : "Create budget"}
        </button>
      </form>
    </Modal>
  );
}
