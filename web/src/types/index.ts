export type BudgetType = "monthly_expenditure" | "trip" | "goal" | "purchase" | "custom";
export type BudgetStatus = "active" | "completed" | "archived";
export type ExpenseSource = "manual" | "voice" | "receipt" | "penny";
export type IncomeSource = "manual" | "voice" | "receipt" | "email" | "sms" | "penny";

export interface Category {
  id: string;
  label: string;
  icon: string;
  color: string;
  sort_order: number;
}

export interface Budget {
  id: string;
  user_id: string;
  name: string;
  type: BudgetType;
  target_amount: number | null;
  currency: string;
  start_date: string;
  end_date: string | null;
  icon: string;
  color: string;
  status: BudgetStatus;
  created_at: string;
  spent: number;
}

export interface Expense {
  id: string;
  user_id: string;
  budget_id: string | null;
  category_id: string;
  amount: number;
  currency: string;
  description: string | null;
  merchant: string | null;
  expense_date: string;
  source: ExpenseSource;
  receipt_url: string | null;
  raw_input: string | null;
  created_at: string;
  categories?: { label: string; icon: string; color: string };
}

export interface Income {
  id: string;
  user_id: string;
  category_id: string;
  amount: number;
  currency: string;
  amount_primary: number | null;
  fx_rate: number | null;
  description: string | null;
  source_name: string | null;
  received_date: string;
  entry_source: IncomeSource;
  receipt_url: string | null;
  raw_input: string | null;
  created_at: string;
  income_categories?: { label: string; icon: string; color: string };
}

export interface Profile {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  photo_url: string | null;
  avatar_url: string | null;
  default_currency: string;
  primary_currency: string;
  subscription_tier?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface ExpenseDraft {
  amount: number;
  currency: string;
  category_id: string;
  merchant: string | null;
  description: string;
  expense_date: string;
  confidence: number;
}

export interface IncomeDraft {
  amount: number;
  currency: string;
  category_id: string;
  source_name: string | null;
  description: string;
  received_date: string;
  confidence: number;
}

export interface ReportSummary {
  totalSpent: number;
  transactionCount: number;
  byCategory: { category_id: string; label: string; icon: string; color: string; total: number }[];
  byMonth: { month: string; total: number }[];
  byBudget: { budget_id: string; name: string; total: number }[];
}

export interface CategoryTotal {
  category_id: string;
  label: string;
  icon: string;
  color: string;
  total: number;
}

export interface MonthlyPoint {
  month: string;
  income: number;
  expenses: number;
  savings: number;
}

export interface MonthlySummary {
  primaryCurrency: string;
  range: { from: string; to: string | null };
  totals: { income: number; expenses: number; savings: number; savingsRate: number };
  months: MonthlyPoint[];
  byIncomeCategory: CategoryTotal[];
  byExpenseCategory: CategoryTotal[];
  unconverted: { incomes: number; expenses: number };
}

export const BUDGET_TYPE_META: Record<BudgetType, { label: string; icon: string }> = {
  monthly_expenditure: { label: "Monthly Expenditure", icon: "📅" },
  trip: { label: "Trip", icon: "🧳" },
  goal: { label: "Goal", icon: "🎯" },
  purchase: { label: "Commodity Purchase", icon: "🛒" },
  custom: { label: "Custom", icon: "✨" },
};
