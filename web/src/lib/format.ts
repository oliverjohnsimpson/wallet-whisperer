import { findCurrency, numberLocale, usesIndianGrouping } from "./currencies";

export function formatMoney(amount: number | string, currency = "INR") {
  // Supabase/PostgREST serialize Postgres `numeric` columns as strings, so
  // callers passing a raw API value (rather than a JS-computed total) may
  // hand us a string — coerce so toLocaleString actually formats it.
  const numeric = typeof amount === "string" ? Number(amount) : amount;
  const symbol = findCurrency(currency)?.symbol ?? currency + " ";
  if (!Number.isFinite(numeric)) return `${symbol}0`;
  // ISO-4217 grouping: Indian currencies group 2-2-3 (₹90,12,34,56,789),
  // everyone else groups 3-3-3 ($100,067,891,234). The locale drives this.
  return `${symbol}${numeric.toLocaleString(numberLocale(currency), { maximumFractionDigits: 2 })}`;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// Compact scale steps, largest-first, for each grouping convention.
const INDIAN_SCALE: { value: number; suffix: string }[] = [
  { value: 1e19, suffix: "Shankh" },
  { value: 1e17, suffix: "Padma" },
  { value: 1e15, suffix: "Neel" },
  { value: 1e13, suffix: "Kharab" },
  { value: 1e11, suffix: "Arab" },
  { value: 1e7, suffix: "Cr" },
  { value: 1e5, suffix: "L" },
  { value: 1e3, suffix: "K" },
];
const WESTERN_SCALE: { value: number; suffix: string }[] = [
  { value: 1e12, suffix: "T" },
  { value: 1e9, suffix: "B" },
  { value: 1e6, suffix: "M" },
  { value: 1e3, suffix: "K" },
];

/**
 * Compact money for chart axes/labels, using the currency's own scale names:
 * Indian lakh/crore/arab (₹1.2L, ₹3.4Cr, ₹5Arab) or Western K/M/B/T ($1.2M, $3.4B).
 */
export function formatCompactMoney(amount: number | string, currency = "INR") {
  const n = typeof amount === "string" ? Number(amount) : amount;
  const symbol = findCurrency(currency)?.symbol ?? currency + " ";
  if (!Number.isFinite(n)) return `${symbol}0`;
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  const scale = usesIndianGrouping(currency) ? INDIAN_SCALE : WESTERN_SCALE;
  for (const { value, suffix } of scale) {
    if (abs >= value) {
      const scaled = abs / value;
      return `${sign}${symbol}${scaled.toFixed(scaled >= 100 ? 0 : 1)}${suffix}`;
    }
  }
  return `${sign}${symbol}${Math.round(abs)}`;
}

/** First day of the current month as YYYY-MM-DD in the user's *local* timezone (not UTC). */
export function currentMonthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** "2026-07" -> "Jul" (or "Jul '26" with year). */
export function formatMonthLabel(month: string, withYear = false) {
  const [y, m] = month.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  const mon = d.toLocaleDateString("en-IN", { month: "short" });
  return withYear ? `${mon} '${y.slice(2)}` : mon;
}

/**
 * Progress bar % and over-budget flag for a budget with an optional target.
 * Treats an explicit target of 0 as "any spend is over" rather than "no target"
 * (a plain truthy check on target_amount would hide the bar for a 0 target).
 */
export function getBudgetProgress(budget: { target_amount: number | null; spent: number }) {
  if (budget.target_amount == null) return { pct: null as number | null, over: false };
  if (budget.target_amount === 0) return { pct: budget.spent > 0 ? 100 : 0, over: budget.spent > 0 };
  return {
    pct: Math.min(100, (budget.spent / budget.target_amount) * 100),
    over: budget.spent > budget.target_amount,
  };
}
