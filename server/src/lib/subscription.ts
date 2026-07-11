import type { NextFunction, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type Feature, type Tier, FEATURE_MIN_TIER, hasFeature, normalizeTier } from "./entitlements.js";

export async function getTier(db: SupabaseClient, userId: string): Promise<Tier> {
  const { data } = await db.from("profiles").select("subscription_tier").eq("id", userId).single();
  return normalizeTier(data?.subscription_tier);
}

/** Express middleware that blocks a route unless the caller's tier unlocks `feature`. */
export function requireFeature(feature: Feature) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const tier = await getTier(req.db, req.userId);
    if (hasFeature(tier, feature)) return next();
    return res.status(403).json({
      error: "This feature needs an upgrade.",
      code: "upgrade_required",
      feature,
      requiredTier: FEATURE_MIN_TIER[feature],
      currentTier: tier,
    });
  };
}
