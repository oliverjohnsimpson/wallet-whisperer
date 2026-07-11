import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { type Feature, type Tier, hasFeature as tierHasFeature, normalizeTier } from "@/lib/entitlements";

interface PaymentLinks {
  standard: string | null;
  professional: string | null;
}

interface SubscriptionContextValue {
  tier: Tier;
  razorpayKeyId: string | null;
  paymentLinks: PaymentLinks;
  loading: boolean;
  has: (feature: Feature) => boolean;
  refresh: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [tier, setTier] = useState<Tier>("free");
  const [razorpayKeyId, setRazorpayKeyId] = useState<string | null>(null);
  const [paymentLinks, setPaymentLinks] = useState<PaymentLinks>({ standard: null, professional: null });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!session) {
      setTier("free");
      setLoading(false);
      return;
    }
    try {
      const data = await apiGet("/api/billing/status");
      setTier(normalizeTier(data?.tier));
      setRazorpayKeyId(data?.razorpayKeyId ?? null);
      setPaymentLinks(data?.paymentLinks ?? { standard: null, professional: null });
    } catch {
      setTier("free");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <SubscriptionContext.Provider
      value={{ tier, razorpayKeyId, paymentLinks, loading, has: (f) => tierHasFeature(tier, f), refresh }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useSubscription must be used within SubscriptionProvider");
  return ctx;
}
