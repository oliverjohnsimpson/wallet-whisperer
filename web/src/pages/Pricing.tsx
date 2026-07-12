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
      <p className="mt-6 text-xs leading-relaxed text-forest-light dark:text-night-muted">
        Payments are securely processed by Razorpay. All prices are exclusive of Goods and Services Tax (GST)
        and any other applicable taxes or levies, which will be added at checkout as required by law. Amounts
        shown in currencies other than the Indian Rupee (INR) are indicative estimates provided for convenience
        only; the final amount is charged in INR, and your bank or card issuer's prevailing exchange rate and
        any foreign-transaction fees may apply. By subscribing, you authorise the recurring charge for your
        selected plan until you cancel.
      </p>
    </div>
  );
}
