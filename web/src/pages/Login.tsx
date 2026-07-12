import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import FinanceBackground from "@/components/FinanceBackground";

/** Google "G" logo (four-colour). Decorative — brand identity only. */
function GoogleIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden focusable="false">
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7A21.99 21.99 0 0 0 24 46z" />
      <path fill="#FBBC05" d="M11.69 28.18a13.2 13.2 0 0 1 0-8.36v-5.7H4.34a22 22 0 0 0 0 19.76l7.35-5.7z" />
      <path fill="#EA4335" d="M24 9.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 3.02 29.93 1 24 1 15.4 1 7.96 5.94 4.34 13.12l7.35 5.7C13.42 13.62 18.27 9.75 24 9.75z" />
    </svg>
  );
}

/** Microsoft logo (four-colour squares) — the mark used on "Sign in with Microsoft" buttons. */
function MicrosoftIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 23 23" className={className} aria-hidden focusable="false">
      <path fill="#F25022" d="M1 1h10v10H1z" />
      <path fill="#7FBA00" d="M12 1h10v10H12z" />
      <path fill="#00A4EF" d="M1 12h10v10H1z" />
      <path fill="#FFB900" d="M12 12h10v10H12z" />
    </svg>
  );
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [logoError, setLogoError] = useState(false);

  async function signInWithProvider(provider: "google" | "azure") {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin + "/dashboard",
        // Azure's default scope is just "openid", which doesn't include an email claim —
        // request it explicitly so Microsoft accounts (personal or work/school) return one.
        ...(provider === "azure" ? { scopes: "openid email profile" } : {}),
      },
    });
    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
    }
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + "/dashboard" },
    });
    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
    } else {
      setStatus("sent");
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0f2942] p-4">
      <FinanceBackground />

      <div className="relative w-full max-w-md rounded-xl2 bg-cream p-8 shadow-soft">
        <div className="mb-6 text-center">
          {!logoError ? (
            <img
              src="/wallet-whisperer-logo.png"
              alt="Wallet Whisperer — Listen to your money talk"
              className="mx-auto h-28 w-auto"
              onError={() => setLogoError(true)}
            />
          ) : (
            <>
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-forest text-3xl shadow-card">
                👛
              </div>
              <h1 className="font-display text-4xl font-extrabold">
                <span className="text-forest">Wallet</span> <span className="text-gold">Whisperer</span>
              </h1>
            </>
          )}
          <p className="mt-1 text-sm text-forest-light">
            <span className="italic">Listen to your</span> <span className="font-semibold text-coral">money</span>{" "}
            <span className="italic">talk</span>
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => signInWithProvider("google")}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-forest/15 bg-white px-4 py-2.5 font-semibold text-forest-dark shadow-card transition hover:shadow-soft"
          >
            <GoogleIcon /> Sign-in with Google
          </button>
          <button
            onClick={() => signInWithProvider("azure")}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-forest/15 bg-white px-4 py-2.5 font-semibold text-forest-dark shadow-card transition hover:shadow-soft"
          >
            <MicrosoftIcon /> Sign-in with Microsoft
          </button>
          <button
            disabled
            title="Coming soon — requires SMS OTP provider setup"
            className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-full border border-forest/10 bg-white/60 px-4 py-2.5 font-semibold text-forest-dark/40"
          >
            <span aria-hidden>📱</span> Continue with phone number (soon)
          </button>
        </div>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-forest/10" />
          <span className="text-xs font-semibold uppercase tracking-wide text-forest-light">or</span>
          <div className="h-px flex-1 bg-forest/10" />
        </div>

        {status === "sent" ? (
          <p className="rounded-lg bg-forest-50 p-3 text-center text-sm text-forest">
            ✨ Magic link sent to <strong>{email}</strong>. Check your inbox!
          </p>
        ) : (
          <form onSubmit={sendMagicLink} className="space-y-3">
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-full border border-forest/15 bg-white px-4 py-2.5 text-forest-dark outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full rounded-full bg-forest px-4 py-2.5 font-semibold text-cream shadow-card transition hover:bg-forest-dark disabled:opacity-60"
            >
              {status === "sending" ? "Sending…" : "Continue with email"}
            </button>
          </form>
        )}

        {status === "error" && <p className="mt-3 text-center text-sm text-coral-dark">{errorMsg}</p>}

        <p className="mt-6 text-center text-xs text-forest-light">
          Meet <strong>Penny</strong>, your AI money companion, right after you sign in.
        </p>
      </div>
    </div>
  );
}
