import { useEffect, useState } from "react";
import { apiGet, apiSend, type ApiError } from "@/lib/api";
import { loadRazorpay } from "@/lib/razorpay";
import { PLANS, TIER_RANK, type Tier } from "@/lib/entitlements";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { formatMoney } from "@/lib/format";

type Interval = "monthly" | "yearly";
const YEARLY_DISCOUNT = 0.1; // 10% off annual billing

export default function PlanCards({ compact = false }: { compact?: boolean }) {
  const { tier: currentTier, razorpayKeyId, paymentLinks, yearlyAvailable, refresh } = useSubscription();
  const [busy, setBusy] = useState<Tier | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [interval, setInterval] = useState<Interval>("monthly");
  const [currency, setCurrency] = useState("INR");
  const [rate, setRate] = useState(1); // INR -> dashboard currency

  // Yearly billing is fully built but stays hidden (monthly only) until the yearly
  // Razorpay plans are configured, at which point the server reports it available.
  const showYearly = yearlyAvailable;

  // Show plan prices in the user's dashboard currency (prices are defined in INR).
  useEffect(() => {
    apiGet("/api/profile")
      .then(async (p) => {
        const cur = p?.primary_currency || p?.default_currency || "INR";
        setCurrency(cur);
        if (cur !== "INR") {
          const r = await apiGet(`/api/fx/rate?from=INR&to=${cur}`);
          setRate(typeof r?.rate === "number" ? r.rate : 1);
        } else {
          setRate(1);
        }
      })
      .catch(() => {});
  }, []);

  function priceFor(priceInr: number): { amount: number; perMonth: number } {
    if (interval === "yearly") {
      const yearly = priceInr * 12 * (1 - YEARLY_DISCOUNT) * rate;
      return { amount: yearly, perMonth: yearly / 12 };
    }
    const monthly = priceInr * rate;
    return { amount: monthly, perMonth: monthly };
  }

  async function confirmPayment() {
    setRefreshing(true);
    try {
      await refresh();
      setNote("Refreshed! If your payment is confirmed, your new plan is now active.");
    } finally {
      setRefreshing(false);
    }
  }

  function linkFor(tier: Tier): string | null {
    if (tier === "professional") return interval === "yearly" ? paymentLinks.professionalYearly : paymentLinks.professional;
    if (tier === "standard") return interval === "yearly" ? paymentLinks.standardYearly : paymentLinks.standard;
    return null;
  }

  async function upgrade(tier: Tier) {
    if (tier === "free") return;
    setBusy(tier);
    setNote(null);
    setAwaitingConfirm(false);

    if (interval === "yearly" && !yearlyAvailable) {
      setNote("Annual billing is coming soon — it'll be enabled here as soon as the yearly plans go live.");
      setBusy(null);
      return;
    }

    // Hosted payment-page path (no API keys): open Razorpay's secure page.
    const link = linkFor(tier);
    if (!razorpayKeyId && link) {
      window.open(link, "_blank", "noopener");
      setNote("Opened the secure Razorpay payment page in a new tab. Once your payment is confirmed, tap “I've completed payment” to refresh your plan.");
      setAwaitingConfirm(true);
      setBusy(null);
      return;
    }

    try {
      const { subscriptionId, keyId } = await apiSend("POST", "/api/billing/create-subscription", { tier, interval });
      const ok = await loadRazorpay();
      if (!ok || !window.Razorpay) {
        setNote("Couldn't open the payment window. Please try again.");
        return;
      }
      const rzp = new window.Razorpay({
        key: keyId,
        subscription_id: subscriptionId,
        name: "Wallet Whisperer",
        description: `${tier[0].toUpperCase()}${tier.slice(1)} plan (${interval})`,
        theme: { color: "#1B4332" },
        handler: () => {
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
      {showYearly && (
        <div className="mb-5 flex items-center justify-center">
          <div className="inline-flex items-center gap-1 rounded-full bg-forest-50 p-1 dark:bg-white/5">
            {(["monthly", "yearly"] as Interval[]).map((iv) => (
              <button
                key={iv}
                onClick={() => setInterval(iv)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold capitalize transition ${
                  interval === iv ? "bg-forest text-cream shadow-card" : "text-forest-dark dark:text-night-ink"
                }`}
              >
                {iv}
                {iv === "yearly" && (
                  <span className="ml-1.5 rounded-full bg-gold px-1.5 py-0.5 text-[10px] font-bold uppercase text-forest-dark">
                    Save 10%
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={`grid gap-4 ${compact ? "sm:grid-cols-3" : "md:grid-cols-3"}`}>
        {PLANS.map((plan) => {
          const isCurrent = plan.tier === currentTier;
          const isDowngrade = TIER_RANK[plan.tier] < TIER_RANK[currentTier];
          const highlight = plan.tier === "standard";
          const price = priceFor(plan.priceInr);
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
                  <h3 className="font-display text-xl font-extrabold text-forest-dark dark:text-night-ink">{plan.name}</h3>
                  {highlight && (
                    <span className="rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold uppercase text-forest-dark">Popular</span>
                  )}
                </div>
                {plan.priceInr === 0 ? (
                  <p className="mt-1 font-display text-2xl font-extrabold text-forest dark:text-night-ink">Free</p>
                ) : (
                  <>
                    <p className="mt-1 font-display text-2xl font-extrabold text-forest dark:text-night-ink">
                      {formatMoney(Math.round(price.amount), currency)}
                      <span className="text-sm font-semibold text-forest-light">/{interval === "yearly" ? "yr" : "mo"}</span>
                    </p>
                    {interval === "yearly" && (
                      <p className="text-xs text-forest-light dark:text-night-muted">
                        ≈ {formatMoney(Math.round(price.perMonth), currency)}/mo · 2 months free
                      </p>
                    )}
                  </>
                )}
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
