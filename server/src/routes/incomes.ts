import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { sendIfError } from "../lib/respond.js";
import { INCOME_CATEGORY_IDS } from "../incomeCategories.js";
import { getPrimaryCurrency } from "../lib/primaryCurrency.js";
import { convertToPrimary } from "../lib/fx.js";

export const incomesRouter = Router();
incomesRouter.use(requireAuth);

const incomeInput = z.object({
  category_id: z.enum(INCOME_CATEGORY_IDS),
  amount: z.number().nonnegative(),
  currency: z.string().length(3).default("INR"),
  description: z.string().optional().nullable(),
  source_name: z.string().optional().nullable(),
  received_date: z.string().optional(),
  entry_source: z.enum(["manual", "voice", "receipt", "email", "sms", "penny"]).default("manual"),
  receipt_url: z.string().optional().nullable(),
  raw_input: z.string().optional().nullable(),
});

incomesRouter.get("/", async (req, res) => {
  const { category_id, from, to, limit } = req.query;

  let query = req.db
    .from("incomes")
    .select("*, income_categories(label, icon, color)")
    .order("received_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (category_id) query = query.eq("category_id", String(category_id));
  if (from) query = query.gte("received_date", String(from));
  if (to) query = query.lte("received_date", String(to));
  if (limit !== undefined) query = query.limit(Number(limit));

  const { data, error } = await query;
  if (sendIfError(res, error)) return;
  res.json(data);
});

incomesRouter.post("/", async (req, res) => {
  const parsed = incomeInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const primary = await getPrimaryCurrency(req.db, req.userId);
  const { amountPrimary, fxRate } = await convertToPrimary(parsed.data.amount, parsed.data.currency, primary);

  const { data, error } = await req.db
    .from("incomes")
    .insert({ ...parsed.data, user_id: req.userId, amount_primary: amountPrimary, fx_rate: fxRate })
    .select("*, income_categories(label, icon, color)")
    .single();

  if (sendIfError(res, error)) return;
  res.status(201).json(data);
});

incomesRouter.patch("/:id", async (req, res) => {
  const parsed = incomeInput.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const update: Record<string, unknown> = { ...parsed.data };
  // Recompute the primary-currency amount if amount or currency changed.
  if (parsed.data.amount !== undefined || parsed.data.currency !== undefined) {
    const { data: existing } = await req.db
      .from("incomes")
      .select("amount, currency")
      .eq("id", req.params.id)
      .single();
    const amount = parsed.data.amount ?? Number(existing?.amount ?? 0);
    const currency = parsed.data.currency ?? existing?.currency ?? "INR";
    const primary = await getPrimaryCurrency(req.db, req.userId);
    const { amountPrimary, fxRate } = await convertToPrimary(amount, currency, primary);
    update.amount_primary = amountPrimary;
    update.fx_rate = fxRate;
  }

  const { data, error } = await req.db
    .from("incomes")
    .update(update)
    .eq("id", req.params.id)
    .select("*, income_categories(label, icon, color)")
    .single();

  if (sendIfError(res, error)) return;
  res.json(data);
});

incomesRouter.delete("/:id", async (req, res) => {
  const { error } = await req.db.from("incomes").delete().eq("id", req.params.id);
  if (sendIfError(res, error)) return;
  res.status(204).end();
});
