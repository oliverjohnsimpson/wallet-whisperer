import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiSend, apiUpload } from "@/lib/api";
import type { Category, Income, IncomeDraft } from "@/types";
import Modal from "@/components/ui/Modal";
import { FormField, inputClass } from "@/components/ui/FormField";
import CurrencySelect from "@/components/ui/CurrencySelect";
import SearchableSelect from "@/components/ui/SearchableSelect";
import AmountSlider from "@/components/ui/AmountSlider";

type Tab = "manual" | "voice" | "receipt" | "paste";

interface DraftState {
  amount: string;
  currency: string;
  category_id: string;
  source_name: string;
  description: string;
  received_date: string;
}

function emptyDraft(): DraftState {
  return {
    amount: "",
    currency: "INR",
    category_id: "",
    source_name: "",
    description: "",
    received_date: new Date().toISOString().slice(0, 10),
  };
}

function fromAiDraft(d: IncomeDraft): DraftState {
  return {
    amount: String(d.amount ?? ""),
    currency: d.currency || "INR",
    category_id: d.category_id || "",
    source_name: d.source_name || "",
    description: d.description || "",
    received_date: d.received_date || new Date().toISOString().slice(0, 10),
  };
}

export default function IncomeModal({
  onClose,
  onCreated,
  defaultCurrency = "INR",
}: {
  onClose: () => void;
  onCreated: (income: Income) => void;
  defaultCurrency?: string;
}) {
  const [tab, setTab] = useState<Tab>("manual");
  const [categories, setCategories] = useState<Category[]>([]);
  const [draft, setDraft] = useState<DraftState>({ ...emptyDraft(), currency: defaultCurrency });
  const [entrySource, setEntrySource] = useState<"manual" | "voice" | "receipt" | "penny">("manual");
  const [rawInput, setRawInput] = useState<string | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingStarting, setRecordingStarting] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.sort_order - b.sort_order),
    [categories]
  );

  useEffect(() => {
    apiGet("/api/income-categories").then(setCategories).catch(() => {});
  }, []);

  function applyAiDraft(d: IncomeDraft, kind: "voice" | "receipt" | "penny") {
    setDraft(fromAiDraft(d));
    setEntrySource(kind);
  }

  async function startRecording() {
    if (recordingStarting || recording) return;
    setAiError(null);
    setRecordingStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        await submitVoice(new Blob(chunksRef.current, { type: "audio/webm" }));
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
      formData.append("audio", blob, "income.webm");
      const { transcript, draft: aiDraft } = await apiUpload("/api/ai/voice-income", formData);
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
      const { draft: aiDraft, receipt_url } = await apiUpload("/api/ai/receipt-income", formData);
      setReceiptUrl(receipt_url);
      applyAiDraft(aiDraft, "receipt");
    } catch (err: any) {
      setAiError(err.message ?? "Couldn't read that document.");
    } finally {
      setAiBusy(false);
    }
  }

  async function submitPaste() {
    const text = pasteText.trim();
    if (!text) return;
    setAiBusy(true);
    setAiError(null);
    try {
      const { draft: aiDraft } = await apiSend("POST", "/api/ai/parse-text", { text, kind: "income" });
      setRawInput(text);
      applyAiDraft(aiDraft, "penny");
    } catch (err: any) {
      setAiError(err.message ?? "Couldn't parse that text.");
    } finally {
      setAiBusy(false);
    }
  }

  async function saveIncome(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const created = await apiSend("POST", "/api/incomes", {
        category_id: draft.category_id,
        amount: Number(draft.amount),
        currency: draft.currency,
        source_name: draft.source_name || null,
        description: draft.description || null,
        received_date: draft.received_date,
        entry_source: entrySource,
        receipt_url: receiptUrl,
        raw_input: rawInput,
      });
      onCreated(created);
      onClose();
    } catch (err: any) {
      setAiError(err.message ?? "Couldn't save that income.");
    } finally {
      setSaving(false);
    }
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "manual", label: "Manual", icon: "⌨️" },
    { id: "voice", label: "Voice", icon: "🎙️" },
    { id: "receipt", label: "Payslip", icon: "🧾" },
    { id: "paste", label: "Paste", icon: "📋" },
  ];

  return (
    <Modal title="Add income" onClose={onClose} maxWidth="lg">
      <div className="mb-5 flex gap-2 rounded-full bg-forest-50 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id);
              setAiError(null);
              // Reset capture provenance so the saved entry reflects the tab actually used.
              setEntrySource("manual");
              setReceiptUrl(null);
              setRawInput(null);
            }}
            className={`flex-1 rounded-full py-2 text-xs font-semibold transition sm:text-sm ${
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
              className="rounded-full bg-forest px-6 py-3 font-semibold text-cream shadow-card disabled:opacity-60"
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
          <p className="mt-2 text-xs text-forest-light">e.g. "Got my salary of 85,000 from Acme on the 1st"</p>
          {aiBusy && <p className="mt-2 text-sm text-forest-light">Penny is listening &amp; extracting…</p>}
          {rawInput && <p className="mt-3 text-xs italic text-forest-light">"{rawInput}"</p>}
        </div>
      )}

      {tab === "receipt" && (
        <div className="mb-5 rounded-xl2 bg-forest-50 p-4 text-center">
          <label className="inline-block cursor-pointer rounded-full bg-forest px-6 py-3 font-semibold text-cream shadow-card">
            📷 Upload payslip / dividend note
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && submitReceipt(e.target.files[0])}
            />
          </label>
          {aiBusy && <p className="mt-2 text-sm text-forest-light">Penny is reading your document…</p>}
          {receiptUrl && <img src={receiptUrl} alt="Preview" className="mx-auto mt-3 max-h-40 rounded-lg shadow-card" />}
        </div>
      )}

      {tab === "paste" && (
        <div className="mb-5 rounded-xl2 bg-forest-50 p-4">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={3}
            placeholder="Paste a bank SMS, dividend email, or credit alert…"
            className={inputClass}
          />
          <button
            type="button"
            onClick={submitPaste}
            disabled={aiBusy || !pasteText.trim()}
            className="mt-2 w-full rounded-full bg-forest py-2 text-sm font-semibold text-cream shadow-card disabled:opacity-60"
          >
            {aiBusy ? "Penny is parsing…" : "✨ Extract with Penny"}
          </button>
        </div>
      )}

      {aiError && <p className="mb-4 rounded-lg bg-coral/10 p-2 text-sm text-coral-dark">{aiError}</p>}

      <form onSubmit={saveIncome} className="space-y-3">
        <FormField label="Amount">
          <AmountSlider value={draft.amount} currency={draft.currency} onChange={(v) => setDraft({ ...draft, amount: v })} />
        </FormField>

        <FormField label="Currency">
          <CurrencySelect value={draft.currency} onChange={(code) => setDraft({ ...draft, currency: code })} />
        </FormField>

        <FormField label="Source type">
          <SearchableSelect
            value={draft.category_id}
            onChange={(id) => setDraft({ ...draft, category_id: id })}
            options={sortedCategories}
            getValue={(c) => c.id}
            getSearchText={(c) => c.label}
            getDisplayValue={(c) => `${c.icon} ${c.label}`}
            placeholder="Search source type…"
            emptyLabel="No matching source"
            renderOption={(c) => (
              <>
                <span className="w-6 shrink-0">{c.icon}</span>
                <span className="text-forest-dark">{c.label}</span>
              </>
            )}
          />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Source name">
            <input
              value={draft.source_name}
              onChange={(e) => setDraft({ ...draft, source_name: e.target.value })}
              placeholder="Employer, brokerage…"
              className={inputClass}
            />
          </FormField>
          <FormField label="Date received">
            <input
              type="date"
              required
              value={draft.received_date}
              onChange={(e) => setDraft({ ...draft, received_date: e.target.value })}
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
          className="w-full rounded-full bg-gold py-3 font-semibold text-forest-dark shadow-card transition hover:bg-gold-light disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save income"}
        </button>
      </form>
    </Modal>
  );
}
