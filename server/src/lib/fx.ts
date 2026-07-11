// Currency conversion into a user's primary currency.
//
// A live all-currencies USD table is fetched once and cached (the free
// open.er-api.com endpoint, no API key). Whatever the live provider doesn't
// cover — or if the network is unavailable — falls back to the static
// reference table in rates.ts, so a conversion is ALWAYS produced for any
// supported currency. Previously, currencies the provider didn't cover (e.g.
// NGN) returned null and were silently dropped from the monthly totals.

import { USD_RATES, staticRate } from "./rates.js";

interface UsdTable {
  rates: Record<string, number>; // units of currency per 1 USD
  fetchedAt: number;
}

let usdTable: UsdTable | null = null;
let inFlight: Promise<UsdTable> | null = null;
const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export interface Conversion {
  amountPrimary: number | null;
  fxRate: number | null;
}

async function loadUsdTable(): Promise<UsdTable> {
  if (usdTable && Date.now() - usdTable.fetchedAt < TTL_MS) return usdTable;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/USD");
      if (res.ok) {
        const body: any = await res.json();
        const rates = body?.rates;
        if (rates && typeof rates === "object") {
          // Merge over the static defaults so we keep coverage for any code the
          // live provider omits, while preferring live values where present.
          usdTable = { rates: { ...USD_RATES, ...rates }, fetchedAt: Date.now() };
          return usdTable;
        }
      }
    } catch (err) {
      console.error("[fx] live rate fetch failed, using static table", err);
    }
    // Fall back to the static table (still cached so we don't retry every call).
    usdTable = { rates: { ...USD_RATES }, fetchedAt: Date.now() };
    return usdTable;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

/** Cross-rate: how many units of `to` equal 1 unit of `from`. */
async function crossRate(from: string, to: string): Promise<number | null> {
  const table = await loadUsdTable();
  const f = table.rates[from];
  const t = table.rates[to];
  if (typeof f === "number" && typeof t === "number" && f > 0) return t / f;
  // Last resort: static-only cross rate.
  return staticRate(from, to);
}

/** Convert `amount` from `from` currency into `to` (the user's primary currency). */
export async function convertToPrimary(amount: number, from: string, to: string): Promise<Conversion> {
  const src = (from || "").toUpperCase();
  const dst = (to || "").toUpperCase();
  if (!src || !dst || src === dst) {
    return { amountPrimary: round2(amount), fxRate: 1 };
  }
  const rate = await crossRate(src, dst);
  if (rate == null) return { amountPrimary: null, fxRate: null };
  return { amountPrimary: round2(amount * rate), fxRate: rate };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
