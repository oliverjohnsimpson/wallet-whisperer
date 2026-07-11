// Static USD-based reference rates (units of the currency per 1 USD), in the
// spirit of the mid-market values published at https://tradingeconomics.com/currencies.
// These are a resilient fallback: convertToPrimary() prefers a live rate when the
// network is available (see fx.ts) and only falls back to this table so that a
// conversion is ALWAYS possible for any supported currency. Without this, foreign
// entries in currencies the live provider doesn't cover (e.g. NGN) were dropped
// from the monthly totals entirely.

export const USD_RATES: Record<string, number> = {
  USD: 1,
  INR: 83.3,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 157,
  CNY: 7.25,
  AUD: 1.52,
  CAD: 1.37,
  CHF: 0.89,
  SGD: 1.35,
  HKD: 7.81,
  NZD: 1.64,
  AED: 3.67,
  SAR: 3.75,
  QAR: 3.64,
  KWD: 0.307,
  BHD: 0.376,
  OMR: 0.385,
  JOD: 0.709,
  ZAR: 18.5,
  SEK: 10.6,
  NOK: 10.7,
  DKK: 6.87,
  ISK: 138,
  PLN: 3.95,
  CZK: 23.2,
  HUF: 360,
  RON: 4.57,
  UAH: 41,
  RUB: 89,
  TRY: 32.5,
  ILS: 3.7,
  THB: 36.5,
  MYR: 4.7,
  IDR: 16200,
  PHP: 58.5,
  VND: 25400,
  KRW: 1380,
  TWD: 32.4,
  KZT: 470,
  BRL: 5.45,
  MXN: 18.2,
  ARS: 900,
  CLP: 940,
  COP: 3950,
  PEN: 3.75,
  EGP: 48,
  NGN: 1550,
  KES: 129,
  GHS: 15,
  MAD: 9.9,
  PKR: 278,
  BDT: 118,
  LKR: 300,
  NPR: 133,
};

/** Static cross-rate: how many units of `to` equal 1 unit of `from`, via USD. */
export function staticRate(from: string, to: string): number | null {
  const f = USD_RATES[from];
  const t = USD_RATES[to];
  if (f == null || t == null) return null;
  return t / f;
}
