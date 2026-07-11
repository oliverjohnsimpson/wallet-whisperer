import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { sendIfError } from "../lib/respond.js";
import { getTier } from "../lib/subscription.js";
import { FREE_LIMITS } from "../lib/entitlements.js";

export const budgetsRouter = Router();
budgetsRouter.use(requireAuth);

const budgetInput = z.object({
  name: z.string().min(1),
  type: z.enum(["monthly_expenditure", "trip", "goal", "purchase", "custom"]),
  target_amount: z.number().nonnegative().optional().nullable(),
  currency: z.string().length(3).default("INR"),
  start_date: z.string().optional(),
  end_date: z.string().optional().nullable(),
  icon: z.string().optional(),
  color: z.string().optional(),
});

budgetsRouter.get("/", async (req, res) => {
  const { data, error } = await req.db
    .from("budgets")
    .select("*, expenses(amount)")
    .order("created_at", { ascending: false });

  if (sendIfError(res, error)) return;

  const withTotals = (data ?? []).map((b: any) => {
    const spent = (b.expenses ?? []).reduce((sum: number, e: any) => sum + Number(e.amount), 0);
    const { expenses, ...rest } = b;
    return { ...rest, spent };
  });

  res.json(withTotals);
});

budgetsRouter.get("/:id", async (req, res) => {
  const { data, error } = await req.db.from("budgets").select("*").eq("id", req.params.id).single();
  if (sendIfError(res, error, 404)) return;
  res.json(data);
});

budgetsRouter.post("/", async (req, res) => {
  const parsed = budgetInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  // Free tier is capped to a handful of active budgets.
  const tier = await getTier(req.db, req.userId);
  if (tier === "free") {
    const { count } = await req.db
      .from("budgets")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");
    if ((count ?? 0) >= FREE_LIMITS.activeBudgets) {
      return res.status(403).json({
        error: `Free plan is limited to ${FREE_LIMITS.activeBudgets} active budgets. Upgrade for unlimited.`,
        code: "upgrade_required",
        requiredTier: "standard",
        currentTier: tier,
      });
    }
  }

  const { data, error } = await req.db
    .from("budgets")
    .insert({ ...parsed.data, user_id: req.userId })
    .select()
    .single();

  if (sendIfError(res, error)) return;
  res.status(201).json(data);
});

budgetsRouter.patch("/:id", async (req, res) => {
  const parsed = budgetInput.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { data, error } = await req.db
    .from("budgets")
    .update(parsed.data)
    .eq("id", req.params.id)
    .select()
    .single();

  if (sendIfError(res, error)) return;
  res.json(data);
});

budgetsRouter.delete("/:id", async (req, res) => {
  const { error } = await req.db.from("budgets").delete().eq("id", req.params.id);
  if (sendIfError(res, error)) return;
  res.status(204).end();
});
