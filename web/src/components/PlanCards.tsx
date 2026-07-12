import { useState } from "react";
import { apiSend, type ApiError } from "@/lib/api";
import { loadRazorpay } from "@/lib/razorpay";
import { PLANS, TIER_RANK, type Tier } from "@/lib/entitlements";
import { useSubscription } from "@/contexts/SubscriptionContext";

export default function PlanCards({ compact = false }: { compact?: boolean }) {
  const { tier: currentTier, razorpayKeyId, paymentLinks, refresh } = useSubscription();
  const [busy, setBusy] = useState<Tier | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function confirmPayment() {
    setRefreshing(true);
    try {
      await refresh();
      setNote("Refreshed! If your payment is confirmed, your new plan is now active.");
    } finally {
      setRefreshing(false);
    }
  }

  async function upgrade(tier: Tier) {
    if (tier === "free") return;
    setBusy(tier);
    setNote(null);
    setAwaitingConfirm(false);

    // If API-based subscriptions aren't configured but a hosted payment link is,
    // send the user straight to the Razorpay payment page.
    const link = tier === "professional" ? paymentLinks.professional : paymentLinks.standard;
    if (!razorpayKeyId && link) {
      window.open(link, "_blank", "noopener");
      setNote("Opened the secure Razorpay payment page in a new tab. Once your payment is confirmed, tap “I've completed payment” to refresh your plan.");
      setAwaitingConfirm(true);
      setBusy(null);
      return;
    }

    try {
      const { subscriptionId, keyId } = await apiSend("POST", "/api/billing/create-subscription", { tier });
      const ok = await loadRazorpay();
      if (!ok || !window.Razorpay) {
        setNote("Couldn't open the payment window. Please try again.");
        return;
      }
      const rzp = new window.Razorpay({
        key: keyId,
        subscription_id: subscriptionId,
        name: "Wallet Whisperer",
        description: `${tier[0].toUpperCase()}${tier.slice(1)} plan`,
        theme: { color: "#1B4332" },
        handler: () => {
          // Payment authorised — the tier is activated by the Razorpay webhook.
          setNote("Payment received! Your upgrade will activate momentarily.");
          setTimeout(refresh, 2500);
        },
      });
      rzp.open();
    } catch (err) {
      const e = err as ApiError;
      if (e.code === "billing_unconfigured") {
        setNote("Payments aren't set up yet — add your Razorpay keys to enable upgrades.");
      } else {
        setNote(e.message ?? "Something went wrong starting checkout.");
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className={`grid gap-4 ${compact ? "sm:grid-cols-3" : "md:grid-cols-3"}`}>
        {PLANS.map((plan) => {
          const isCurrent = plan.tier === currentTier;
          const isDowngrade = TIER_RANK[plan.tier] < TIER_RANK[currentTier];
          const highlight = plan.tier === "standard";
          return (
            <div
              key={plan.tier}
              className={`flex flex-col rounded-xl2 border p-5 shadow-card ${
                highlight
                  ? "border-gold bg-gold/5 dark:bg-gold/10"
                  : "border-forest/10 bg-white dark:border-white/10 dark:bg-night-card"
              }`}
            >
              <div className="mb-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-xl font-extrabold text-forest-dark dark:text-night-ink">
                    {plan.name}
                  </h3>
                  {highlight && (
                    <span className="rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold uppercase text-forest-dark">
                      Popular
                    </span>
                  )}
                </div>
                <p className="mt-1 font-display text-2xl font-extrabold text-forest dark:text-night-ink">
                  {plan.priceInr === 0 ? "Free" : `₹${plan.priceInr}`}
                  {plan.priceInr > 0 && <span className="text-sm font-semibold text-forest-light">/mo</span>}
                </p>
                <p className="mt-1 text-xs text-forest-light dark:text-night-muted">{plan.tagline}</p>
              </div>

              <ul className="mb-4 flex-1 space-y-1.5 text-sm text-forest-dark dark:text-night-ink">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-forest-light">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <span className="rounded-full bg-forest-50 py-2 text-center text-sm font-semibold text-forest-dark dark:bg-white/5 dark:text-night-ink">
                  Current plan
                </span>
              ) : isDowngrade ? (
                <span className="rounded-full py-2 text-center text-sm font-semibold text-forest-light">Included</span>
              ) : (
                <button
                  onClick={() => upgrade(plan.tier)}
                  disabled={busy === plan.tier}
                  className="rounded-full bg-forest py-2 text-sm font-semibold text-cream shadow-card transition hover:bg-forest-dark disabled:opacity-60"
                >
                  {busy === plan.tier ? "Starting…" : `Upgrade to ${plan.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {note && (
        <div className="mt-4 rounded-lg bg-gold/10 p-3 text-center text-sm text-forest-dark dark:text-night-ink">
          <p>{note}</p>
          {awaitingConfirm && (
            <button
              onClick={confirmPayment}
              disabled={refreshing}
              className="mt-2 rounded-full bg-forest px-4 py-1.5 text-xs font-semibold text-cream shadow-card transition hover:bg-forest-dark disabled:opacity-60"
            >
              {refreshing ? "Checking…" : "I've completed payment — refresh my plan"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
