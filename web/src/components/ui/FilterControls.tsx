import type { MonthPreset } from "@/lib/dateRange";

/** Labeled <select> used across the Income/Expenses filter bars. */
export function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-forest-light dark:text-night-muted">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="ww-input py-2">
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Labeled text input used for keyword filters (merchant, description). */
export function FilterText({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-forest-light dark:text-night-muted">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="ww-input py-2" />
    </label>
  );
}

/** 1 / 3 / 6 / 12-month quick-range buttons. */
export function PresetButtons({
  active,
  onPick,
}: {
  active: MonthPreset | null;
  onPick: (p: MonthPreset) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {([1, 3, 6, 12] as MonthPreset[]).map((p) => (
        <button
          key={p}
          onClick={() => onPick(p)}
          className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
            active === p ? "bg-forest text-cream shadow-card" : "bg-forest-50 text-forest-dark dark:bg-white/5 dark:text-night-ink"
          }`}
        >
          {p === 1 ? "This month" : `${p} months`}
        </button>
      ))}
    </div>
  );
}
