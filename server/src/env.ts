import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}. Copy server/.env.example to server/.env and fill it in.`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 8787),
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  supabaseUrl: required("SUPABASE_URL"),
  supabaseAnonKey: required("SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  openaiApiKey: required("OPENAI_API_KEY"),
  chatModel: process.env.OPENAI_CHAT_MODEL ?? "gpt-4o",
  visionModel: process.env.OPENAI_VISION_MODEL ?? "gpt-4o",
  transcribeModel: process.env.OPENAI_TRANSCRIBE_MODEL ?? "whisper-1",
  // Razorpay (optional until billing is wired up)
  razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? "",
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET ?? "",
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? "",
  razorpayPlanStandard: process.env.RAZORPAY_PLAN_STANDARD ?? "",
  razorpayPlanProfessional: process.env.RAZORPAY_PLAN_PROFESSIONAL ?? "",
  // Hosted Razorpay payment-page links (simplest option; no API keys needed to
  // collect payment, but tier activation is manual/webhook-based).
  razorpayPaymentUrlStandard: process.env.RAZORPAY_PAYMENT_URL_STANDARD ?? "",
  razorpayPaymentUrlProfessional: process.env.RAZORPAY_PAYMENT_URL_PROFESSIONAL ?? "",
  // Yearly (annual, 10% off) hosted links. Left blank until the annual plans are
  // set up in Razorpay — the yearly toggle stays hidden in production until then.
  razorpayPaymentUrlStandardYearly: process.env.RAZORPAY_PAYMENT_URL_STANDARD_YEARLY ?? "",
  razorpayPaymentUrlProfessionalYearly: process.env.RAZORPAY_PAYMENT_URL_PROFESSIONAL_YEARLY ?? "",
  // App-store listing URLs — used to deep-link happy users to leave a review.
  // Left blank until the apps are published; the store prompt stays hidden until set.
  playStoreUrl: process.env.PLAY_STORE_URL ?? "",
  appStoreUrl: process.env.APP_STORE_URL ?? "",
};

export const razorpayConfigured = Boolean(env.razorpayKeyId && env.razorpayKeySecret);

/** True once the annual plans have hosted links (or API keys) configured. */
export const yearlyBillingAvailable = Boolean(
  env.razorpayPaymentUrlStandardYearly || env.razorpayPaymentUrlProfessionalYearly || razorpayConfigured
);
