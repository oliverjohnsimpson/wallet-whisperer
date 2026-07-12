import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { sendIfError } from "../lib/respond.js";
import { getPrimaryCurrency } from "../lib/primaryCurrency.js";

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

/** Best-effort value of a row in the user's primary currency, or null if it can't be converted. */
function primaryValue(row: any, primary: string): number | null {
  if (row.amount_primary != null) return Number(row.amount_primary);
  if (row.currency === primary) return Number(row.amount);
  return null; // foreign-currency row with no stored conversion
}

/**
 * GET /api/reports/summary?from=&to=&budget_id=
 * Expense-only breakdown (category / month / budget). Kept for the budget views.
 */
reportsRouter.get("/summary", async (req, res) => {
  const { from, to, budget_id } = req.query;

  let query = req.db
    .from("expenses")
    .select("amount, currency, expense_date, category_id, budget_id, categories(label, icon, color), budgets(name)");

  if (from) query = query.gte("expense_date", String(from));
  if (to) query = query.lte("expense_date", String(to));
  if (budget_id) query = query.eq("budget_id", String(budget_id));

  const { data, error } = await query;
  if (sendIfError(res, error)) return;

  const rows = data ?? [];
  const totalSpent = rows.reduce((sum: number, r: any) => sum + Number(r.amount), 0);

  const byCategory = new Map<string, { category_id: string; label: string; icon: string; color: string; total: number }>();
  const byMonth = new Map<string, number>();
  const byBudget = new Map<string, { budget_id: string; name: string; total: number }>();

  for (const r of rows as any[]) {
    const cat = byCategory.get(r.category_id) ?? {
      category_id: r.category_id,
      label: r.categories?.label ?? r.category_id,
      icon: r.categories?.icon ?? "🗂️",
      color: r.categories?.color ?? "#7A7A7A",
      total: 0,
    };
    cat.total += Number(r.amount);
    byCategory.set(r.category_id, cat);

    const month = String(r.expense_date).slice(0, 7); // YYYY-MM
    byMonth.set(month, (byMonth.get(month) ?? 0) + Number(r.amount));

    if (r.budget_id) {
      const b = byBudget.get(r.budget_id) ?? { budget_id: r.budget_id, name: r.budgets?.name ?? "Untitled", total: 0 };
      b.total += Number(r.amount);
      byBudget.set(r.budget_id, b);
    }
  }

  res.json({
    totalSpent,
    transactionCount: rows.length,
    byCategory: [...byCategory.values()].sort((a, b) => b.total - a.total),
    byMonth: [...byMonth.entries()].map(([month, total]) => ({ month, total })).sort((a, b) => a.month.localeCompare(b.month)),
    byBudget: [...byBudget.values()].sort((a, b) => b.total - a.total),
  });
});

interface CatBucket {
  category_id: string;
  label: string;
  icon: string;
  color: string;
  total: number;
}

/** Inclusive list of "YYYY-MM" keys spanning [from, to]. */
function monthKeys(from: string, to: string): string[] {
  const [fy, fm] = from.slice(0, 7).split("-").map(Number);
  const [ty, tm] = to.slice(0, 7).split("-").map(Number);
  const keys: string[] = [];
  let y = fy;
  let m = fm;
  for (let i = 0; i < 600 && (y < ty || (y === ty && m <= tm)); i++) {
    keys.push(`${y}-${String(m).padStart(2, "0")}`);
    if (++m > 12) {
      m = 1;
      y++;
    }
  }
  return keys;
}

/**
 * GET /api/reports/category-trends?from=&to=
 * Per-month totals for each income category and each expense category, in the
 * user's primary currency. Powers the Reports line graphs (income sources &
 * expense categories over time).
 */
reportsRouter.get("/category-trends", async (req, res) => {
  const primary = await getPrimaryCurrency(req.db, req.userId);

  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().slice(0, 10);
  const from = req.query.from ? String(req.query.from) : defaultFrom;
  const to = req.query.to ? String(req.query.to) : now.toISOString().slice(0, 10);

  let incomeQuery = req.db
    .from("incomes")
    .select("amount, amount_primary, currency, received_date, category_id, income_categories(label, icon, color)")
    .gte("received_date", from)
    .lte("received_date", to);
  let expenseQuery = req.db
    .from("expenses")
    .select("amount, amount_primary, currency, expense_date, category_id, categories(label, icon, color)")
    .gte("expense_date", from)
    .lte("expense_date", to);

  const [{ data: incomes, error: incErr }, { data: expenses, error: expErr }] = await Promise.all([
    incomeQuery,
    expenseQuery,
  ]);
  if (sendIfError(res, incErr)) return;
  if (sendIfError(res, expErr)) return;

  const months = monthKeys(from, to);
  const monthIndex = new Map(months.map((m, i) => [m, i]));

  function build(rows: any[], dateField: string, catRel: string) {
    // key -> { label, color, values[] }
    const series = new Map<string, { key: string; label: string; color: string; values: number[] }>();
    for (const r of rows) {
      const val = primaryValue(r, primary);
      if (val == null) continue;
      const idx = monthIndex.get(String(r[dateField]).slice(0, 7));
      if (idx == null) continue;
      const rel = r[catRel];
      const key = r.category_id;
      let s = series.get(key);
      if (!s) {
        s = { key, label: rel?.label ?? key, color: rel?.color ?? "#7A7A7A", values: months.map(() => 0) };
        series.set(key, s);
      }
      s.values[idx] += val;
    }
    return [...series.values()].sort((a, b) => b.values.reduce((x, y) => x + y, 0) - a.values.reduce((x, y) => x + y, 0));
  }

  res.json({
    primaryCurrency: primary,
    months,
    income: build((incomes ?? []) as any[], "received_date", "income_categories"),
    expenses: build((expenses ?? []) as any[], "expense_date", "categories"),
  });
});

/**
 * GET /api/reports/monthly-summary?from=&to=
 * The income -> expenses -> savings rollup, all in the user's primary currency.
 * Defaults to the last 12 months.
 */
reportsRouter.get("/monthly-summary", async (req, res) => {
  const primary = await getPrimaryCurrency(req.db, req.userId);

  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().slice(0, 10);
  const from = req.query.from ? String(req.query.from) : defaultFrom;
  const to = req.query.to ? String(req.query.to) : null;

  let incomeQuery = req.db
    .from("incomes")
    .select("amount, amount_primary, currency, received_date, category_id, income_categories(label, icon, color)")
    .gte("received_date", from);
  if (to) incomeQuery = incomeQuery.lte("received_date", to);

  let expenseQuery = req.db
    .from("expenses")
    .select("amount, amount_primary, currency, expense_date, category_id, categories(label, icon, color)")
    .gte("expense_date", from);
  if (to) expenseQuery = expenseQuery.lte("expense_date", to);

  const [{ data: incomes, error: incErr }, { data: expenses, error: expErr }] = await Promise.all([
    incomeQuery,
    expenseQuery,
  ]);
  if (sendIfError(res, incErr)) return;
  if (sendIfError(res, expErr)) return;

  const byMonth = new Map<string, { month: string; income: number; expenses: number }>();
  const byIncomeCategory = new Map<string, CatBucket>();
  const byExpenseCategory = new Map<string, CatBucket>();
  const unconverted = { incomes: 0, expenses: 0 };

  function ensureMonth(month: string) {
    let m = byMonth.get(month);
    if (!m) {
      m = { month, income: 0, expenses: 0 };
      byMonth.set(month, m);
    }
    return m;
  }

  for (const r of (incomes ?? []) as any[]) {
    const val = primaryValue(r, primary);
    if (val == null) {
      unconverted.incomes++;
      continue;
    }
    ensureMonth(String(r.received_date).slice(0, 7)).income += val;
    const cat = byIncomeCategory.get(r.category_id) ?? {
      category_id: r.category_id,
      label: r.income_categories?.label ?? r.category_id,
      icon: r.income_categories?.icon ?? "🪙",
      color: r.income_categories?.color ?? "#7A7A7A",
      total: 0,
    };
    cat.total += val;
    byIncomeCategory.set(r.category_id, cat);
  }

  for (const r of (expenses ?? []) as any[]) {
    const val = primaryValue(r, primary);
    if (val == null) {
      unconverted.expenses++;
      continue;
    }
    ensureMonth(String(r.expense_date).slice(0, 7)).expenses += val;
    const cat = byExpenseCategory.get(r.category_id) ?? {
      category_id: r.category_id,
      label: r.categories?.label ?? r.category_id,
      icon: r.categories?.icon ?? "🗂️",
      color: r.categories?.color ?? "#7A7A7A",
      total: 0,
    };
    cat.total += val;
    byExpenseCategory.set(r.category_id, cat);
  }

  const months = [...byMonth.values()]
    .map((m) => ({ ...m, savings: m.income - m.expenses }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const totalIncome = months.reduce((s, m) => s + m.income, 0);
  const totalExpenses = months.reduce((s, m) => s + m.expenses, 0);
  const totalSavings = totalIncome - totalExpenses;

  res.json({
    primaryCurrency: primary,
    range: { from, to },
    totals: {
      income: totalIncome,
      expenses: totalExpenses,
      savings: totalSavings,
      savingsRate: totalIncome > 0 ? totalSavings / totalIncome : 0,
    },
    months,
    byIncomeCategory: [...byIncomeCategory.values()].sort((a, b) => b.total - a.total),
    byExpenseCategory: [...byExpenseCategory.values()].sort((a, b) => b.total - a.total),
    unconverted,
  });
});
