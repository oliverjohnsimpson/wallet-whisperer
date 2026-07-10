// Mirrors supabase/migrations/0002_income_and_savings.sql — keep in sync.
export const INCOME_CATEGORY_IDS = [
  "salary",
  "freelance",
  "business",
  "dividends",
  "interest",
  "capital_gains",
  "rental",
  "bonus",
  "pension",
  "royalty",
  "refund",
  "gift",
  "other_income",
] as const;

export type IncomeCategoryId = (typeof INCOME_CATEGORY_IDS)[number];
