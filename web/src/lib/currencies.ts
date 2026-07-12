export interface Currency {
  code: string;
  symbol: string;
  name: string;
  /** Singular noun for one unit of the currency, used in prose (e.g. "every dollar coming in"). */
  noun: string;
}

// Currencies that group digits the South-Asian way (2-2-3, lakh/crore/arab…)
// instead of the international 3-3-3 (thousand/million/billion…). Per ISO-4217
// usage conventions the app follows for number formatting (item 6).
export const INDIAN_GROUPING_CODES = new Set(["INR", "PKR", "NPR", "LKR", "BDT"]);

/** True when a currency uses the Indian lakh/crore grouping and scale names. */
export function usesIndianGrouping(code: string): boolean {
  return INDIAN_GROUPING_CODES.has(code);
}

/** BCP-47 locale whose digit grouping matches the currency (Indian vs. Western). */
export function numberLocale(code: string): string {
  return usesIndianGrouping(code) ? "en-IN" : "en-US";
}

/** Singular unit noun for a currency, e.g. "dollar", "rupee". Falls back to "unit". */
export function currencyNoun(code: string): string {
  return findCurrency(code)?.noun ?? "unit";
}

// Currency symbols follow the reference list at https://www.xe.com/symbols/.
// This is a broad, practical subset of ISO 4217 (not the full ~180) that covers
// every region the app is used in — every code here has a matching conversion
// rate on the server (see server/src/lib/rates.ts), so any of them can be picked
// as the dashboard's default currency and converted into.
export const CURRENCIES: Currency[] = [
  { code: "INR", symbol: "₹", name: "Indian Rupee", noun: "rupee" },
  { code: "USD", symbol: "$", name: "US Dollar", noun: "dollar" },
  { code: "EUR", symbol: "€", name: "Euro", noun: "euro" },
  { code: "GBP", symbol: "£", name: "British Pound", noun: "pound" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", noun: "yen" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan Renminbi", noun: "yuan" },
  { code: "AUD", symbol: "$", name: "Australian Dollar", noun: "dollar" },
  { code: "CAD", symbol: "$", name: "Canadian Dollar", noun: "dollar" },
  { code: "CHF", symbol: "CHF", name: "Swiss Franc", noun: "franc" },
  { code: "SGD", symbol: "$", name: "Singapore Dollar", noun: "dollar" },
  { code: "HKD", symbol: "$", name: "Hong Kong Dollar", noun: "dollar" },
  { code: "NZD", symbol: "$", name: "New Zealand Dollar", noun: "dollar" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham", noun: "dirham" },
  { code: "SAR", symbol: "﷼", name: "Saudi Riyal", noun: "riyal" },
  { code: "QAR", symbol: "﷼", name: "Qatari Riyal", noun: "riyal" },
  { code: "KWD", symbol: "د.ك", name: "Kuwaiti Dinar", noun: "dinar" },
  { code: "BHD", symbol: ".د.ب", name: "Bahraini Dinar", noun: "dinar" },
  { code: "OMR", symbol: "﷼", name: "Omani Rial", noun: "rial" },
  { code: "JOD", symbol: "د.ا", name: "Jordanian Dinar", noun: "dinar" },
  { code: "ZAR", symbol: "R", name: "South African Rand", noun: "rand" },
  { code: "SEK", symbol: "kr", name: "Swedish Krona", noun: "krona" },
  { code: "NOK", symbol: "kr", name: "Norwegian Krone", noun: "krone" },
  { code: "DKK", symbol: "kr", name: "Danish Krone", noun: "krone" },
  { code: "ISK", symbol: "kr", name: "Icelandic Króna", noun: "króna" },
  { code: "PLN", symbol: "zł", name: "Polish Zloty", noun: "zloty" },
  { code: "CZK", symbol: "Kč", name: "Czech Koruna", noun: "koruna" },
  { code: "HUF", symbol: "Ft", name: "Hungarian Forint", noun: "forint" },
  { code: "RON", symbol: "lei", name: "Romanian Leu", noun: "leu" },
  { code: "UAH", symbol: "₴", name: "Ukrainian Hryvnia", noun: "hryvnia" },
  { code: "RUB", symbol: "₽", name: "Russian Ruble", noun: "ruble" },
  { code: "TRY", symbol: "₺", name: "Turkish Lira", noun: "lira" },
  { code: "ILS", symbol: "₪", name: "Israeli Shekel", noun: "shekel" },
  { code: "THB", symbol: "฿", name: "Thai Baht", noun: "baht" },
  { code: "MYR", symbol: "RM", name: "Malaysian Ringgit", noun: "ringgit" },
  { code: "IDR", symbol: "Rp", name: "Indonesian Rupiah", noun: "rupiah" },
  { code: "PHP", symbol: "₱", name: "Philippine Peso", noun: "peso" },
  { code: "VND", symbol: "₫", name: "Vietnamese Dong", noun: "dong" },
  { code: "KRW", symbol: "₩", name: "South Korean Won", noun: "won" },
  { code: "TWD", symbol: "NT$", name: "Taiwan New Dollar", noun: "dollar" },
  { code: "KZT", symbol: "₸", name: "Kazakhstani Tenge", noun: "tenge" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real", noun: "real" },
  { code: "MXN", symbol: "$", name: "Mexican Peso", noun: "peso" },
  { code: "ARS", symbol: "$", name: "Argentine Peso", noun: "peso" },
  { code: "CLP", symbol: "$", name: "Chilean Peso", noun: "peso" },
  { code: "COP", symbol: "$", name: "Colombian Peso", noun: "peso" },
  { code: "PEN", symbol: "S/.", name: "Peruvian Sol", noun: "sol" },
  { code: "EGP", symbol: "£", name: "Egyptian Pound", noun: "pound" },
  { code: "NGN", symbol: "₦", name: "Nigerian Naira", noun: "naira" },
  { code: "KES", symbol: "KSh", name: "Kenyan Shilling", noun: "shilling" },
  { code: "GHS", symbol: "₵", name: "Ghanaian Cedi", noun: "cedi" },
  { code: "MAD", symbol: "د.م.", name: "Moroccan Dirham", noun: "dirham" },
  { code: "PKR", symbol: "₨", name: "Pakistani Rupee", noun: "rupee" },
  { code: "BDT", symbol: "৳", name: "Bangladeshi Taka", noun: "taka" },
  { code: "LKR", symbol: "Rs", name: "Sri Lankan Rupee", noun: "rupee" },
  { code: "NPR", symbol: "Rs", name: "Nepalese Rupee", noun: "rupee" },
];

export function findCurrency(code: string): Currency | undefined {
  return CURRENCIES.find((c) => c.code === code);
}
