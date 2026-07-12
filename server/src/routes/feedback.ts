import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { env } from "../env.js";
import { sendIfError } from "../lib/respond.js";

export const feedbackRouter = Router();
feedbackRouter.use(requireAuth);

const feedbackInput = z.object({
  rating: z.number().int().min(1).max(5),
  reasons: z.array(z.string().max(120)).max(12).default([]),
  comment: z.string().max(2000).optional().nullable(),
  shared_to_store: z.boolean().optional(),
});

/** POST /api/feedback — record a star rating with reasons and an optional comment. */
feedbackRouter.post("/", async (req, res) => {
  const parsed = feedbackInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { data, error } = await req.db
    .from("app_feedback")
    .insert({ ...parsed.data, user_id: req.userId })
    .select("id")
    .single();
  if (sendIfError(res, error)) return;
  res.status(201).json({ id: data?.id ?? null });
});

/**
 * GET /api/feedback/store-links — app-store review URLs, if configured.
 * Returns nulls until PLAY_STORE_URL / APP_STORE_URL are set, which keeps the
 * "share your rating on the app store" prompt dormant until the apps are live.
 */
feedbackRouter.get("/store-links", async (_req, res) => {
  res.json({
    playStoreUrl: env.playStoreUrl || null,
    appStoreUrl: env.appStoreUrl || null,
  });
});
