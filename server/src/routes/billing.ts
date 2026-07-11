import { Router, type Request, type Response } from "express";
import crypto from "node:crypto";
import { requireAuth } from "../middleware/auth.js";
import { env, razorpayConfigured } from "../env.js";
import { supabaseAdmin } from "../supabaseAdmin.js";
import { getTier } from "../lib/subscription.js";
import type { Tier } from "../lib/entitlements.js";

const PLAN_BY_TIER: Record<"standard" | "professional", () => string> = {
  standard: () => env.razorpayPlanStandard,
  professional: () => env.razorpayPlanProfessional,
};

function razorpayAuthHeader(): string {
  return "Basic " + Buffer.from(`${env.razorpayKeyId}:${env.razorpayKeySecret}`).toString("base64");
}

export const billingRouter = Router();
billingRouter.use(requireAuth);

/** GET /api/billing/status — current tier + latest subscription. */
billingRouter.get("/status", async (req, res) => {
  const tier = await getTier(req.db, req.userId);
  const { data: sub } = await req.db
    .from("subscriptions")
    .select("tier, status, current_period_end, provider")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  res.json({
    tier,
    subscription: sub ?? null,
    razorpayKeyId: env.razorpayKeyId || null,
    paymentLinks: {
      standard: env.razorpayPaymentUrlStandard || null,
      professional: env.razorpayPaymentUrlProfessional || null,
    },
  });
});

/** POST /api/billing/create-subscription { tier } — starts a Razorpay subscription for checkout. */
billingRouter.post("/create-subscription", async (req, res) => {
  const tier = req.body?.tier as "standard" | "professional";
  if (tier !== "standard" && tier !== "professional") {
    return res.status(400).json({ error: "tier must be 'standard' or 'professional'" });
  }
  if (!razorpayConfigured) {
    return res.status(503).json({
      error: "Payments aren't configured yet. Add your Razorpay keys to enable upgrades.",
      code: "billing_unconfigured",
    });
  }
  const planId = PLAN_BY_TIER[tier]();
  if (!planId) {
    return res.status(503).json({ error: `No Razorpay plan configured for ${tier}.`, code: "billing_unconfigured" });
  }

  try {
    const rp = await fetch("https://api.razorpay.com/v1/subscriptions", {
      method: "POST",
      headers: { Authorization: razorpayAuthHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ plan_id: planId, total_count: 12, customer_notify: 1, notes: { user_id: req.userId } }),
    });
    const sub: any = await rp.json();
    if (!rp.ok) {
      console.error("[billing] razorpay create failed", sub);
      return res.status(502).json({ error: sub?.error?.description ?? "Couldn't start checkout." });
    }

    await supabaseAdmin.from("subscriptions").insert({
      user_id: req.userId,
      tier,
      status: "pending",
      provider: "razorpay",
      provider_subscription_id: sub.id,
    });

    res.json({ subscriptionId: sub.id, keyId: env.razorpayKeyId });
  } catch (err: any) {
    console.error("[billing] create-subscription", err);
    res.status(502).json({ error: "Couldn't start checkout. Try again." });
  }
});

/**
 * POST /api/billing/webhook — Razorpay events (raw body). Mounted with express.raw in index.ts.
 * Verifies the HMAC signature, then activates/cancels the user's tier.
 */
export async function billingWebhookHandler(req: Request, res: Response) {
  const signature = req.header("x-razorpay-signature") ?? "";
  const raw = req.body as Buffer; // express.raw gives a Buffer
  if (!env.razorpayWebhookSecret) return res.status(503).end();

  const expected = crypto.createHmac("sha256", env.razorpayWebhookSecret).update(raw).digest("hex");
  if (
    signature.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return res.status(400).json({ error: "invalid signature" });
  }

  let event: any;
  try {
    event = JSON.parse(raw.toString("utf8"));
  } catch {
    return res.status(400).json({ error: "invalid payload" });
  }

  const subEntity = event?.payload?.subscription?.entity;
  const subId = subEntity?.id;
  if (!subId) return res.json({ ok: true }); // not a subscription event we track

  const { data: row } = await supabaseAdmin
    .from("subscriptions")
    .select("id, user_id, tier")
    .eq("provider_subscription_id", subId)
    .maybeSingle();
  if (!row) return res.json({ ok: true });

  const activate = ["subscription.activated", "subscription.charged", "subscription.resumed"];
  const deactivate = ["subscription.cancelled", "subscription.halted", "subscription.completed"];

  if (activate.includes(event.event)) {
    const periodEnd = subEntity.current_end ? new Date(subEntity.current_end * 1000).toISOString() : null;
    await supabaseAdmin.from("subscriptions").update({ status: "active", current_period_end: periodEnd, updated_at: new Date().toISOString() }).eq("id", row.id);
    await supabaseAdmin.from("profiles").update({ subscription_tier: row.tier as Tier }).eq("id", row.user_id);
  } else if (deactivate.includes(event.event)) {
    await supabaseAdmin.from("subscriptions").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", row.id);
    await supabaseAdmin.from("profiles").update({ subscription_tier: "free" }).eq("id", row.user_id);
  }

  res.json({ ok: true });
}
