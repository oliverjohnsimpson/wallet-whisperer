import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { sendIfError } from "../lib/respond.js";

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

/**
 * GET /api/reports/summary?from=&to=&budget_id=
 * Returns totals sliceable by category, by month, and by budget —
 * the frontend charts pivot this client-side.
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
