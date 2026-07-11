import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiSend, apiUpload } from "@/lib/api";
import type { Budget, BudgetType, Category, Expense, ExpenseDraft } from "@/types";
import { BUDGET_TYPE_META } from "@/types";
import Modal from "@/components/ui/Modal";
import { FormField, inputClass } from "@/components/ui/FormField";
import CurrencySelect from "@/components/ui/CurrencySelect";
import SearchableSelect from "@/components/ui/SearchableSelect";
import AmountSlider from "@/components/ui/AmountSlider";

type Tab = "manual" | "voice" | "receipt";

interface DraftState {
  amount: string;
  currency: string;
  category_id: string;
  merchant: string;
  description: string;
  expense_date: string;
  budget_id: string;
}

function emptyDraft(defaultBudgetId?: string, defaultCurrency = "INR"): DraftState {
  return {
    amount: "",
    currency: defaultCurrency,
    category_id: "",
    merchant: "",
    description: "",
    expense_date: new Date().toISOString().slice(0, 10),
    budget_id: defaultBudgetId ?? "",
  };
}

function fromAiDraft(d: ExpenseDraft, defaultBudgetId?: string): DraftState {
  return {
    amount: String(d.amount ?? ""),
    currency: d.currency || "INR",
    category_id: d.category_id || "",
    merchant: d.merchant || "",
    description: d.description || "",
    expense_date: d.expense_date || new Date().toISOString().slice(0, 10),
    budget_id: defaultBudgetId ?? "",
  };
}

function fromExpense(e: Expense): DraftState {
  return {
    amount: String(e.amount ?? ""),
    currency: e.currency || "INR",
    category_id: e.category_id || "",
    merchant: e.merchant || "",
    description: e.description || "",
    expense_date: e.expense_date || new Date().toISOString().slice(0, 10),
    budget_id: e.budget_id || "",
  };
}

export default function ExpenseModal({
  defaultBudgetId,
  defaultCurrency = "INR",
  expense,
  onClose,
  onCreated,
}: {
  defaultBudgetId?: string;
  defaultCurrency?: string;
  /** When provided, the modal edits this expense instead of creating a new one. */
  expense?: Expense;
  onClose: () => void;
  onCreated: (expense: Expense) => void;
}) {
  const editing = !!expense;
  const [tab, setTab] = useState<Tab>("manual");
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [draft, setDraft] = useState<DraftState>(
    expense ? fromExpense(expense) : emptyDraft(defaultBudgetId, defaultCurrency)
  );
  const [source, setSource] = useState<"manual" | "voice" | "receipt" | "penny">(
    expense?.source ?? "manual"
  );
  const [rawInput, setRawInput] = useState<string | null>(expense?.raw_input ?? null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(expense?.receipt_url ?? null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingStarting, setRecordingStarting] = useState(false);

  // Inline "create a new budget" flow, so a budget can be made without leaving
  // the expense form. Triggered by the "+ New budget…" option in the dropdown.
  const [creatingBudget, setCreatingBudget] = useState(false);
  const [newBudgetName, setNewBudgetName] = useState("");
  const [newBudgetType, setNewBudgetType] = useState<BudgetType>("monthly_expenditure");
  const [newBudgetTarget, setNewBudgetTarget] = useState("");
  const [budgetSaving, setBudgetSaving] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.label.localeCompare(b.label)),
    [categories]
  );

  useEffect(() => {
    apiGet("/api/categories").then(setCategories).catch(() => {});
    apiGet("/api/budgets").then(setBudgets).catch(() => {});
  }, []);

  function applyAiDraft(d: ExpenseDraft, kind: "voice" | "receipt") {
    setDraft((prev) => ({ ...fromAiDraft(d), budget_id: prev.budget_id || defaultBudgetId || "" }));
    setSource(kind);
  }

  async function startRecording() {
    if (recordingStarting || recording) return; // guard against double-click before the permission prompt resolves
    setAiError(null);
    setRecordingStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await submitVoice(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (err: any) {
      setAiError(
        err?.name === "NotAllowedError"
          ? "Microphone access was denied — allow it in your browser settings to record."
          : "Couldn't access your microphone. Try again?"
      );
    } finally {
      setRecordingStarting(false);
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  async function submitVoice(blob: Blob) {
    setAiBusy(true);
    setAiError(null);
    try {
      const formData = new FormData();
      formData.append("audio", blob, "expense.webm");
      const { transcript, draft: aiDraft } = await apiUpload("/api/ai/voice-expense", formData);
      setRawInput(transcript);
      applyAiDraft(aiDraft, "voice");
    } catch (err: any) {
      setAiError(err.message ?? "Couldn't process that recording.");
    } finally {
      setAiBusy(false);
    }
  }

  async function submitReceipt(file: File) {
    setAiBusy(true);
    setAiError(null);
    try {
      const formData = new FormData();
      formData.append("receipt", file);
      const { draft: aiDraft, receipt_url } = await apiUpload("/api/ai/receipt-expense", formData);
      setReceiptUrl(receipt_url);
      applyAiDraft(aiDraft, "receipt");
    } catch (err: any) {
      setAiError(err.message ?? "Couldn't read that receipt.");
    } finally {
      setAiBusy(false);
    }
  }

  async function createBudgetInline() {
    if (!newBudgetName.trim()) return;
    setBudgetSaving(true);
    setAiError(null);
    try {
      const created: Budget = await apiSend("POST", "/api/budgets", {
        name: newBudgetName.trim(),
        type: newBudgetType,
        currency: draft.currency,
        target_amount: newBudgetTarget ? Number(newBudgetTarget) : null,
        icon: BUDGET_TYPE_META[newBudgetType].icon,
      });
      // Add to the list and select it for the expense being entered.
      setBudgets((prev) => [created, ...prev]);
      setDraft((prev) => ({ ...prev, budget_id: created.id }));
      setCreatingBudget(false);
      setNewBudgetName("");
      setNewBudgetTarget("");
      setNewBudgetType("monthly_expenditure");
    } catch (err: any) {
      setAiError(err.message ?? "Couldn't create that budget.");
    } finally {
      setBudgetSaving(false);
    }
  }

  async function saveExpense(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        budget_id: draft.budget_id || null,
        category_id: draft.category_id,
        amount: Number(draft.amount),
        currency: draft.currency,
        merchant: draft.merchant || null,
        description: draft.description || null,
        expense_date: draft.expense_date,
        source,
        receipt_url: receiptUrl,
        raw_input: rawInput,
      };
      const saved = editing
        ? await apiSend("PATCH", `/api/expenses/${expense!.id}`, payload)
        : await apiSend("POST", "/api/expenses", payload);
      onCreated(saved);
      onClose();
    } catch (err: any) {
      setAiError(err.message ?? "Couldn't save that expense.");
    } finally {
      setSaving(false);
    }
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "manual", label: "Manual", icon: "⌨️" },
    { id: "voice", label: "Voice", icon: "🎙️" },
    { id: "receipt", label: "Receipt", icon: "🧾" },
  ];

  return (
    <Modal title={editing ? "Edit expense" : "Add an expense"} onClose={onClose} maxWidth="lg">
      {!editing && (
      <div className="mb-5 flex gap-2 rounded-full bg-forest-50 p-1 dark:bg-white/5">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id);
              setAiError(null);
              // Reset capture provenance so the saved expense reflects the tab actually used.
              setSource("manual");
              setReceiptUrl(null);
              setRawInput(null);
            }}
            className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${
              tab === t.id ? "bg-forest text-cream shadow-card" : "text-forest-dark dark:text-night-ink"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      )}

        {tab === "voice" && (
          <div className="mb-5 rounded-xl2 bg-forest-50 p-4 text-center dark:bg-white/5">
            {!recording ? (
              <button
                onClick={startRecording}
                disabled={aiBusy || recordingStarting}
                className="rounded-full bg-coral px-6 py-3 font-semibold text-white shadow-card disabled:opacity-60"
              >
                {recordingStarting ? "Requesting mic access…" : "🎙️ Start recording"}
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="animate-pulse rounded-full bg-coral-dark px-6 py-3 font-semibold text-white shadow-card"
              >
                ⏹ Stop recording
              </button>
            )}
            {aiBusy && <p className="mt-2 text-sm text-forest-light dark:text-night-muted">Penny is listening &amp; extracting details…</p>}
            {rawInput && <p className="mt-3 text-xs italic text-forest-light dark:text-night-muted">"{rawInput}"</p>}
          </div>
        )}

        {tab === "receipt" && (
          <div className="mb-5 rounded-xl2 bg-forest-50 p-4 text-center dark:bg-white/5">
            <label className="inline-block cursor-pointer rounded-full bg-forest px-6 py-3 font-semibold text-cream shadow-card">
              📷 Upload receipt photo
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && submitReceipt(e.target.files[0])}
              />
            </label>
            {aiBusy && <p className="mt-2 text-sm text-forest-light dark:text-night-muted">Penny is reading your receipt…</p>}
            {receiptUrl && <img src={receiptUrl} alt="Receipt preview" className="mx-auto mt-3 max-h-40 rounded-lg shadow-card" />}
          </div>
        )}

        {aiError && <p className="mb-4 rounded-lg bg-coral/10 p-2 text-sm text-coral-dark">{aiError}</p>}

        <form onSubmit={saveExpense} className="space-y-3">
          <FormField label="Amount">
            <AmountSlider
              value={draft.amount}
              currency={draft.currency}
              onChange={(v) => setDraft({ ...draft, amount: v })}
            />
          </FormField>

          <FormField label="Currency">
            <CurrencySelect value={draft.currency} onChange={(code) => setDraft({ ...draft, currency: code })} />
          </FormField>

          <FormField label="Category">
            <SearchableSelect
              value={draft.category_id}
              onChange={(id) => setDraft({ ...draft, category_id: id })}
              options={sortedCategories}
              getValue={(c) => c.id}
              getSearchText={(c) => c.label}
              getDisplayValue={(c) => `${c.icon} ${c.label}`}
              placeholder="Search category…"
              emptyLabel="No matching category"
              renderOption={(c) => (
                <>
                  <span className="w-6 shrink-0">{c.icon}</span>
                  <span className="text-forest-dark dark:text-night-ink">{c.label}</span>
                </>
              )}
            />
          </FormField>

          <FormField label="Budget (optional)">
            <select
              value={creatingBudget ? "__new__" : draft.budget_id}
              onChange={(e) => {
                if (e.target.value === "__new__") {
                  setCreatingBudget(true);
                  setDraft({ ...draft, budget_id: "" });
                } else {
                  setCreatingBudget(false);
                  setDraft({ ...draft, budget_id: e.target.value });
                }
              }}
              className={inputClass}
            >
              <option value="">No budget</option>
              {budgets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.icon} {b.name}
                </option>
              ))}
              <option value="__new__">➕ New budget…</option>
            </select>

            {creatingBudget && (
              <div className="mt-2 space-y-2 rounded-lg border border-forest/15 bg-forest-50 p-3 dark:border-white/10 dark:bg-white/5">
                <input
                  autoFocus
                  value={newBudgetName}
                  onChange={(e) => setNewBudgetName(e.target.value)}
                  placeholder="New budget name (e.g. Goa trip)"
                  className={inputClass}
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={newBudgetType}
                    onChange={(e) => setNewBudgetType(e.target.value as BudgetType)}
                    className={inputClass}
                  >
                    {(Object.keys(BUDGET_TYPE_META) as BudgetType[]).map((t) => (
                      <option key={t} value={t}>
                        {BUDGET_TYPE_META[t].icon} {BUDGET_TYPE_META[t].label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newBudgetTarget}
                    onChange={(e) => setNewBudgetTarget(e.target.value)}
                    placeholder="Target (optional)"
                    className={inputClass}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={createBudgetInline}
                    disabled={budgetSaving || !newBudgetName.trim()}
                    className="flex-1 rounded-full bg-forest py-2 text-sm font-semibold text-cream shadow-card disabled:opacity-60"
                  >
                    {budgetSaving ? "Creating…" : "Create & select"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCreatingBudget(false);
                      setNewBudgetName("");
                      setNewBudgetTarget("");
                    }}
                    className="rounded-full px-3 py-2 text-sm font-semibold text-forest-light hover:bg-forest-50 dark:text-night-muted dark:hover:bg-white/5"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Merchant">
              <input
                value={draft.merchant}
                onChange={(e) => setDraft({ ...draft, merchant: e.target.value })}
                className={inputClass}
              />
            </FormField>
            <FormField label="Date">
              <input
                type="date"
                required
                value={draft.expense_date}
                onChange={(e) => setDraft({ ...draft, expense_date: e.target.value })}
                className={inputClass}
              />
            </FormField>
          </div>

          <FormField label="Description">
            <textarea
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              rows={2}
              className={inputClass}
            />
          </FormField>

          <button
            type="submit"
            disabled={saving || !draft.amount || !draft.category_id}
            className="w-full rounded-full bg-forest py-3 font-semibold text-cream shadow-card disabled:opacity-60"
          >
            {saving ? "Saving…" : editing ? "Save changes" : "Save expense"}
          </button>
        </form>
    </Modal>
  );
}
