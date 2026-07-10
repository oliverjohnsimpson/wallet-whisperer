// Currency conversion into a user's primary currency, using the free
// Frankfurter API (European Central Bank reference rates, no API key).
// Not every currency is covered by the ECB set — when a rate is unavailable
// we return nulls and the caller stores the entry as un-converted.

interface CacheEntry {
  rate: number;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();
const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours — ECB rates update at most daily

export interface Conversion {
  amountPrimary: number | null;
  fxRate: number | null;
}

async function fetchRate(from: string, to: string): Promise<number | null> {
  const key = `${from}->${to}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached.rate;

  try {
    const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${from}&symbols=${to}`);
    if (!res.ok) return null;
    const body: any = await res.json();
    const rate = body?.rates?.[to];
    if (typeof rate !== "number") return null;
    cache.set(key, { rate, fetchedAt: Date.now() });
    return rate;
  } catch (err) {
    console.error("[fx] rate fetch failed", from, to, err);
    return null;
  }
}

/** Convert `amount` from `from` currency into `to` (the user's primary currency). */
export async function convertToPrimary(amount: number, from: string, to: string): Promise<Conversion> {
  if (!from || !to || from === to) {
    return { amountPrimary: round2(amount), fxRate: 1 };
  }
  const rate = await fetchRate(from, to);
  if (rate == null) return { amountPrimary: null, fxRate: null };
  return { amountPrimary: round2(amount * rate), fxRate: rate };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
