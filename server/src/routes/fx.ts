import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { convertToPrimary } from "../lib/fx.js";

export const fxRouter = Router();
fxRouter.use(requireAuth);

/**
 * GET /api/fx/rate?from=INR&to=USD
 * Cross-rate: how many units of `to` equal 1 unit of `from`. Used to show plan
 * prices (defined in INR) in the user's dashboard currency.
 */
fxRouter.get("/rate", async (req, res) => {
  const from = String(req.query.from ?? "INR").toUpperCase();
  const to = String(req.query.to ?? "INR").toUpperCase();
  const { fxRate } = await convertToPrimary(1, from, to);
  res.json({ from, to, rate: fxRate ?? 1 });
});
