// Subscription tiers and what each unlocks. Keep in sync with server/src/lib/entitlements.ts.
export type Tier = "free" | "standard" | "professional";

export const TIER_RANK: Record<Tier, number> = { free: 0, standard: 1, professional: 2 };

export type Feature = "alerts" | "rich_dashboard" | "email_ingestion" | "messaging_ingestion";

export const FEATURE_MIN_TIER: Record<Feature, Tier> = {
  alerts: "standard",
  rich_dashboard: "standard",
  email_ingestion: "professional",
  messaging_ingestion: "professional",
};

export const FREE_LIMITS = { pennyMessagesPerDay: 15, activeBudgets: 3 };

export function hasFeature(tier: Tier, feature: Feature): boolean {
  return TIER_RANK[tier] >= TIER_RANK[FEATURE_MIN_TIER[feature]];
}

export function normalizeTier(t: unknown): Tier {
  return t === "standard" || t === "professional" ? t : "free";
}

// Marketing metadata for the pricing page.
export interface PlanInfo {
  tier: Tier;
  name: string;
  priceInr: number; // per month
  tagline: string;
  features: string[];
}

export const PLANS: PlanInfo[] = [
  {
    tier: "free",
    name: "Free",
    priceInr: 0,
    tagline: "Everything you need to start tracking.",
    features: [
      "Income, expense & budget tracking",
      "Voice, receipt-photo & paste capture",
      "Penny AI companion (up to 15 chats/day)",
      "Fund budgets from income",
      "Weekly wealth digest + Newsletter",
      "Up to 3 active budgets",
    ],
  },
  {
    tier: "standard",
    name: "Standard",
    priceInr: 199,
    tagline: "Smarter automation and insights.",
    features: [
      "Everything in Free",
      "Custom + EMI / upcoming-expense alerts",
      "Richer infographic dashboard",
      "Unlimited Penny chats",
      "Unlimited budgets",
    ],
  },
  {
    tier: "professional",
    name: "Professional",
    priceInr: 499,
    tagline: "Connect your inboxes and messengers.",
    features: [
      "Everything in Standard",
      "Email inbox monitoring (auto income/expense)",
      "WhatsApp & Telegram ingestion",
      "Multiple linked accounts",
      "Priority Penny wealth insights",
    ],
  },
];
