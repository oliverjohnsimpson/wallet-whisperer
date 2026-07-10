import { useEffect, useRef, useState } from "react";
import { apiGet, apiSend, apiUpload } from "@/lib/api";
import type { Budget, Category, Expense, ExpenseDraft } from "@/types";
import Modal from "@/components/ui/Modal";
import { FormField, inputClass } from "@/components/ui/FormField";

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

function emptyDraft(defaultBudgetId?: string): DraftState {
  return {
    amount: "",
    currency: "INR",
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

export default function ExpenseModal({
  defaultBudgetId,
  onClose,
  onCreated,
}: {
  defaultBudgetId?: string;
  onClose: () => void;
  onCreated: (expense: Expense) => void;
}) {
  const [tab, setTab] = useState<Tab>("manual");
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [draft, setDraft] = useState<DraftState>(emptyDraft(defaultBudgetId));
  const [source, setSource] = useState<"manual" | "voice" | "receipt">("manual");
  const [rawInput, setRawInput] = useState<string | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingStarting, setRecordingStarting] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

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

  async function saveExpense(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const created = await apiSend("POST", "/api/expenses", {
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
      });
      onCreated(created);
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
    <Modal title="Add an expense" onClose={onClose} maxWidth="lg">
      <div className="mb-5 flex gap-2 rounded-full bg-forest-50 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id);
              setAiError(null);
            }}
            className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${
              tab === t.id ? "bg-forest text-cream shadow-card" : "text-forest-dark"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

        {tab === "voice" && (
          <div className="mb-5 rounded-xl2 bg-forest-50 p-4 text-center">
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
            {aiBusy && <p className="mt-2 text-sm text-forest-light">Penny is listening &amp; extracting details…</p>}
            {rawInput && <p className="mt-3 text-xs italic text-forest-light">"{rawInput}"</p>}
          </div>
        )}

        {tab === "receipt" && (
          <div className="mb-5 rounded-xl2 bg-forest-50 p-4 text-center">
            <label className="inline-block cursor-pointer rounded-full bg-forest px-6 py-3 font-semibold text-cream shadow-card">
              📷 Upload receipt photo
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && submitReceipt(e.target.files[0])}
              />
            </label>
            {aiBusy && <p className="mt-2 text-sm text-forest-light">Penny is reading your receipt…</p>}
            {receiptUrl && <img src={receiptUrl} alt="Receipt preview" className="mx-auto mt-3 max-h-40 rounded-lg shadow-card" />}
          </div>
        )}

        {aiError && <p className="mb-4 rounded-lg bg-coral/10 p-2 text-sm text-coral-dark">{aiError}</p>}

        <form onSubmit={saveExpense} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Amount">
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={draft.amount}
                onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                className={inputClass}
              />
            </FormField>
            <FormField label="Currency">
              <input
                required
                value={draft.currency}
                onChange={(e) => setDraft({ ...draft, currency: e.target.value.toUpperCase() })}
                maxLength={3}
                className={`${inputClass} uppercase`}
              />
            </FormField>
          </div>

          <FormField label="Category">
            <select
              required
              value={draft.category_id}
              onChange={(e) => setDraft({ ...draft, category_id: e.target.value })}
              className={inputClass}
            >
              <option value="" disabled>
                Select a category
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Budget (optional)">
            <select
              value={draft.budget_id}
              onChange={(e) => setDraft({ ...draft, budget_id: e.target.value })}
              className={inputClass}
            >
              <option value="">No budget</option>
              {budgets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.icon} {b.name}
                </option>
              ))}
            </select>
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
            {saving ? "Saving…" : "Save expense"}
          </button>
        </form>
    </Modal>
  );
}
