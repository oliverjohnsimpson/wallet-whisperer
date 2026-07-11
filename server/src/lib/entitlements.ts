// Subscription tiers and what each unlocks. Keep in sync with web/src/lib/entitlements.ts.
export type Tier = "free" | "standard" | "professional";

export const TIER_RANK: Record<Tier, number> = { free: 0, standard: 1, professional: 2 };

// Gated (non-grandfathered) features and the minimum tier that unlocks them.
export type Feature = "alerts" | "rich_dashboard" | "email_ingestion" | "messaging_ingestion";

export const FEATURE_MIN_TIER: Record<Feature, Tier> = {
  alerts: "standard",
  rich_dashboard: "standard",
  email_ingestion: "professional",
  messaging_ingestion: "professional",
};

// Free-tier usage caps (paid tiers are unlimited).
export const FREE_LIMITS = { pennyMessagesPerDay: 15, activeBudgets: 3 };

export function hasFeature(tier: Tier, feature: Feature): boolean {
  return TIER_RANK[tier] >= TIER_RANK[FEATURE_MIN_TIER[feature]];
}

export function normalizeTier(t: unknown): Tier {
  return t === "standard" || t === "professional" ? t : "free";
}
