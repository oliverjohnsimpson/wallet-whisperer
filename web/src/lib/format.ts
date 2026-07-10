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
