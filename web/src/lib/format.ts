import { findCurrency } from "./currencies";

export function formatMoney(amount: number | string, currency = "INR") {
  // Supabase/PostgREST serialize Postgres `numeric` columns as strings, so
  // callers passing a raw API value (rather than a JS-computed total) may
  // hand us a string — coerce so toLocaleString actually formats it.
  const numeric = typeof amount === "string" ? Number(amount) : amount;
  const symbol = findCurrency(currency)?.symbol ?? currency + " ";
  if (!Number.isFinite(numeric)) return `${symbol}0`;
  return `${symbol}${numeric.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** Compact money for chart axes/labels using Indian lakh/crore units (e.g. ₹1.2L, ₹3.4Cr). */
export function formatCompactMoney(amount: number | string, currency = "INR") {
  const n = typeof amount === "string" ? Number(amount) : amount;
  const symbol = findCurrency(currency)?.symbol ?? currency + " ";
  if (!Number.isFinite(n)) return `${symbol}0`;
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e7) return `${sign}${symbol}${(abs / 1e7).toFixed(abs >= 1e8 ? 0 : 1)}Cr`;
  if (abs >= 1e5) return `${sign}${symbol}${(abs / 1e5).toFixed(abs >= 1e6 ? 0 : 1)}L`;
  if (abs >= 1e3) return `${sign}${symbol}${(abs / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}k`;
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
