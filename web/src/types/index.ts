export type BudgetType = "monthly_expenditure" | "trip" | "goal" | "purchase" | "custom";
export type BudgetStatus = "active" | "completed" | "archived";
export type ExpenseSource = "manual" | "voice" | "receipt" | "penny";

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

export interface ReportSummary {
  totalSpent: number;
  transactionCount: number;
  byCategory: { category_id: string; label: string; icon: string; color: string; total: number }[];
  byMonth: { month: string; total: number }[];
  byBudget: { budget_id: string; name: string; total: number }[];
}

export const BUDGET_TYPE_META: Record<BudgetType, { label: string; icon: string }> = {
  monthly_expenditure: { label: "Monthly Expenditure", icon: "📅" },
  trip: { label: "Trip", icon: "🧳" },
  goal: { label: "Goal", icon: "🎯" },
  purchase: { label: "Commodity Purchase", icon: "🛒" },
  custom: { label: "Custom", icon: "✨" },
};
