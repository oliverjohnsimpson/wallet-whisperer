import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { sendIfError } from "../lib/respond.js";
import { getPrimaryCurrency } from "../lib/primaryCurrency.js";
import { convertToPrimary } from "../lib/fx.js";

export const profileRouter = Router();
profileRouter.use(requireAuth);

profileRouter.get("/", async (req, res) => {
  const { data, error } = await req.db
    .from("profiles")
    .select("id, display_name, avatar_url, default_currency, primary_currency")
    .eq("id", req.userId)
    .single();
  if (sendIfError(res, error, 404)) return;
  res.json(data);
});

const profileInput = z.object({
  display_name: z.string().optional().nullable(),
  default_currency: z.string().length(3).optional(),
  primary_currency: z.string().length(3).optional(),
});

profileRouter.patch("/", async (req, res) => {
  const parsed = profileInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { data, error } = await req.db
    .from("profiles")
    .update(parsed.data)
    .eq("id", req.userId)
    .select("id, display_name, avatar_url, default_currency, primary_currency")
    .single();
  if (sendIfError(res, error)) return;
  res.json(data);
});

/**
 * POST /api/profile/backfill-primary
 * One-shot repair: fills amount_primary/fx_rate on any income or expense row that
 * predates the primary-currency model (or whose primary currency later changed),
 * so historical entries are counted in the savings rollup. Safe to run repeatedly.
 */
profileRouter.post("/backfill-primary", async (req, res) => {
  const primary = await getPrimaryCurrency(req.db, req.userId);
  const result = { updated: 0, unconvertible: 0 };

  for (const table of ["incomes", "expenses"] as const) {
    const { data: rows, error } = await req.db
      .from(table)
      .select("id, amount, currency")
      .is("amount_primary", null);
    if (sendIfError(res, error)) return;

    for (const r of rows ?? []) {
      const { amountPrimary, fxRate } = await convertToPrimary(Number(r.amount), r.currency, primary);
      if (amountPrimary == null) {
        result.unconvertible++;
        continue;
      }
      await req.db.from(table).update({ amount_primary: amountPrimary, fx_rate: fxRate }).eq("id", r.id);
      result.updated++;
    }
  }

  res.json({ primaryCurrency: primary, ...result });
});
