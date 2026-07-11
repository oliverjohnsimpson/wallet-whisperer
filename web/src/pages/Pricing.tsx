import PlanCards from "@/components/PlanCards";
import { useSubscription } from "@/contexts/SubscriptionContext";

export default function Pricing() {
  const { tier } = useSubscription();
  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-extrabold text-forest-dark dark:text-night-ink">Plans &amp; upgrade</h1>
        <p className="text-forest-light dark:text-night-muted">
          You're on the <span className="font-semibold capitalize">{tier}</span> plan. Upgrade anytime — cancel anytime.
        </p>
      </div>
      <PlanCards />
      <p className="mt-6 text-xs text-forest-light dark:text-night-muted">
        Payments are processed securely by Razorpay. Prices are per month in INR.
      </p>
    </div>
  );
}
