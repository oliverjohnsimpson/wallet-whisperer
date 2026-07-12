/** Shared date-range helpers for the Income and Reports filters. */

export type MonthPreset = 1 | 3 | 6 | 12;

/** Today as YYYY-MM-DD in local time. */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** First day of the month `n-1` months back (so n=1 → this month), as YYYY-MM-DD. */
export function monthsAgoStart(n: MonthPreset): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - (n - 1), 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Inclusive list of "YYYY-MM" month keys spanning [from, to]. */
export function monthKeysBetween(from: string, to: string): string[] {
  const [fy, fm] = from.slice(0, 7).split("-").map(Number);
  const [ty, tm] = to.slice(0, 7).split("-").map(Number);
  const keys: string[] = [];
  let y = fy;
  let m = fm;
  // Cap to a sane number of months to avoid runaway loops on bad input.
  for (let i = 0; i < 600 && (y < ty || (y === ty && m <= tm)); i++) {
    keys.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return keys;
}
