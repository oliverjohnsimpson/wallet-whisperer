import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { CATEGORY_IDS } from "../categories.js";
import { sendIfError } from "../lib/respond.js";
import { getPrimaryCurrency } from "../lib/primaryCurrency.js";
import { convertToPrimary } from "../lib/fx.js";

export const expensesRouter = Router();
expensesRouter.use(requireAuth);

const expenseInput = z.object({
  budget_id: z.string().uuid().optional().nullable(),
  category_id: z.enum(CATEGORY_IDS),
  amount: z.number().nonnegative(),
  currency: z.string().length(3).default("INR"),
  description: z.string().optional().nullable(),
  merchant: z.string().optional().nullable(),
  expense_date: z.string().optional(),
  source: z.enum(["manual", "voice", "receipt", "penny"]).default("manual"),
  receipt_url: z.string().optional().nullable(),
  raw_input: z.string().optional().nullable(),
});

expensesRouter.get("/", async (req, res) => {
  const { budget_id, category_id, from, to, limit } = req.query;

  let query = req.db
    .from("expenses")
    .select("*, categories(label, icon, color)")
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (budget_id) query = query.eq("budget_id", String(budget_id));
  if (category_id) query = query.eq("category_id", String(category_id));
  if (from) query = query.gte("expense_date", String(from));
  if (to) query = query.lte("expense_date", String(to));
  if (limit !== undefined) query = query.limit(Number(limit));

  const { data, error } = await query;
  if (sendIfError(res, error)) return;
  res.json(data);
});

expensesRouter.post("/", async (req, res) => {
  const parsed = expenseInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const currency = parsed.data.currency.toUpperCase();
  const primary = await getPrimaryCurrency(req.db, req.userId);
  const { amountPrimary, fxRate } = await convertToPrimary(parsed.data.amount, currency, primary);

  const { data, error } = await req.db
    .from("expenses")
    .insert({ ...parsed.data, currency, user_id: req.userId, amount_primary: amountPrimary, fx_rate: fxRate })
    .select("*, categories(label, icon, color)")
    .single();

  if (sendIfError(res, error)) return;
  res.status(201).json(data);
});

expensesRouter.patch("/:id", async (req, res) => {
  const parsed = expenseInput.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const update: Record<string, unknown> = { ...parsed.data };
  // Recompute the primary-currency amount if amount or currency changed.
  if (parsed.data.amount !== undefined || parsed.data.currency !== undefined) {
    const { data: existing } = await req.db
      .from("expenses")
      .select("amount, currency")
      .eq("id", req.params.id)
      .single();
    const amount = parsed.data.amount ?? Number(existing?.amount ?? 0);
    const currency = (parsed.data.currency ?? existing?.currency ?? "INR").toUpperCase();
    update.currency = currency;
    const primary = await getPrimaryCurrency(req.db, req.userId);
    const { amountPrimary, fxRate } = await convertToPrimary(amount, currency, primary);
    update.amount_primary = amountPrimary;
    update.fx_rate = fxRate;
  }

  const { data, error } = await req.db
    .from("expenses")
    .update(update)
    .eq("id", req.params.id)
    .select("*, categories(label, icon, color)")
    .single();

  if (sendIfError(res, error)) return;
  res.json(data);
});

expensesRouter.delete("/:id", async (req, res) => {
  const { error } = await req.db.from("expenses").delete().eq("id", req.params.id);
  if (sendIfError(res, error)) return;
  res.status(204).end();
});
