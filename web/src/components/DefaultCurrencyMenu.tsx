import { useEffect, useRef, useState } from "react";
import { apiSend } from "@/lib/api";
import { findCurrency } from "@/lib/currencies";
import CurrencySelect from "@/components/ui/CurrencySelect";

/**
 * Dashboard control for the account's default (primary) currency. Every monthly
 * total is computed and displayed in this currency; changing it re-converts all
 * existing income/expense entries into the new currency on the server.
 */
export default function DefaultCurrencyMenu({
  value,
  onChanged,
}: {
  value: string;
  onChanged: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const current = findCurrency(value);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function pick(code: string) {
    if (code === value) {
      setOpen(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiSend("PATCH", "/api/profile", { primary_currency: code, default_currency: code });
      // Re-convert every existing entry into the newly chosen currency so the
      // month totals stay correct rather than mixing old conversions.
      await apiSend("POST", "/api/profile/backfill-primary", { recomputeAll: true });
      setOpen(false);
      onChanged(code);
    } catch (err: any) {
      setError(err?.message ?? "Couldn't update your default currency.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={saving}
        title="Change your default currency"
        className="flex items-center gap-2 rounded-full border border-forest/15 bg-white px-4 py-2.5 text-sm font-semibold text-forest-dark shadow-card transition hover:bg-forest-50 disabled:opacity-60 dark:border-white/10 dark:bg-night-card dark:text-night-ink dark:hover:bg-white/5"
      >
        <span className="text-forest-light dark:text-night-muted">Currency</span>
        <span>
          {current ? `${current.symbol} ${current.code}` : value}
        </span>
        <span className="text-xs text-forest-light dark:text-night-muted">{saving ? "…" : "▾"}</span>
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl2 border border-forest/10 bg-white p-3 shadow-soft dark:border-white/10 dark:bg-night-card">
          <p className="mb-2 text-xs font-semibold text-forest-light dark:text-night-muted">
            Default currency for all totals
          </p>
          <CurrencySelect value={value} onChange={pick} />
          {error && <p className="mt-2 text-xs text-coral-dark">{error}</p>}
        </div>
      )}
    </div>
  );
}
