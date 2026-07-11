import { useEffect, useState } from "react";
import { findCurrency } from "@/lib/currencies";
import { inputClass } from "@/components/ui/FormField";

/** A range slider whose max auto-scales to the entered amount, paired with a precise number input. */
function sliderMax(v: number): number {
  const n = Math.max(v, 1);
  const mag = Math.pow(10, Math.floor(Math.log10(n)));
  const stepped = Math.ceil(n / mag) * mag; // round up to one significant figure
  return Math.max(10000, stepped * 2);
}

export default function AmountSlider({
  value,
  onChange,
  currency,
}: {
  value: string;
  onChange: (value: string) => void;
  currency: string;
}) {
  const numeric = Number(value) || 0;
  // The slider ceiling is kept in state and only recomputed on typed/chip changes
  // (not while dragging), otherwise the max would rescale every tick and re-centre
  // the thumb, making it impossible to drag toward larger amounts.
  const [ceiling, setCeiling] = useState(() => sliderMax(numeric));

  // Grow the ceiling if the amount is set externally (e.g. an AI draft) above it.
  useEffect(() => {
    if (numeric > ceiling) setCeiling(sliderMax(numeric));
  }, [numeric, ceiling]);

  const step = Math.max(1, Math.round(ceiling / 1000));
  const symbol = findCurrency(currency)?.symbol ?? "";
  const chips = [100, 500, 1000, 5000];

  function setTyped(v: string) {
    onChange(v);
    setCeiling(sliderMax(Number(v) || 0));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <span className="shrink-0 text-lg font-semibold text-forest-light dark:text-night-muted">{symbol}</span>
        <input
          required
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          value={value}
          onChange={(e) => setTyped(e.target.value)}
          className={`${inputClass} font-display text-lg`}
        />
      </div>
      <input
        type="range"
        min="0"
        max={ceiling}
        step={step}
        value={Math.min(numeric, ceiling)}
        onChange={(e) => onChange(e.target.value)}
        className="ww-range w-full"
        aria-label="Amount slider"
      />
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setTyped(String(Math.round((numeric + c) * 100) / 100))}
            className="rounded-full bg-forest-50 px-2.5 py-1 text-xs font-semibold text-forest-dark transition hover:bg-gold/20 dark:bg-white/10 dark:text-night-ink dark:hover:bg-gold/20"
          >
            +{symbol}
            {c.toLocaleString("en-IN")}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setTyped("")}
          className="rounded-full px-2.5 py-1 text-xs font-semibold text-coral hover:underline"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
