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
  const max = sliderMax(numeric);
  const step = Math.max(1, Math.round(max / 1000));
  const symbol = findCurrency(currency)?.symbol ?? "";

  const chips = [100, 500, 1000, 5000];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <span className="shrink-0 text-lg font-semibold text-forest-light">{symbol}</span>
        <input
          required
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass} font-display text-lg`}
        />
      </div>
      <input
        type="range"
        min="0"
        max={max}
        step={step}
        value={Math.min(numeric, max)}
        onChange={(e) => onChange(e.target.value)}
        className="ww-range w-full"
        aria-label="Amount slider"
      />
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(String(Math.round((numeric + c) * 100) / 100))}
            className="rounded-full bg-forest-50 px-2.5 py-1 text-xs font-semibold text-forest-dark transition hover:bg-gold/20"
          >
            +{symbol}
            {c.toLocaleString("en-IN")}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange("")}
          className="rounded-full px-2.5 py-1 text-xs font-semibold text-coral hover:underline"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
