import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { sendIfError } from "../lib/respond.js";

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
