import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function Login() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function signInWithProvider(provider: "google" | "azure") {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + "/dashboard" },
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-forest via-forest-light to-forest-dark p-4">
      <div className="w-full max-w-md rounded-xl2 bg-cream p-8 shadow-soft">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-forest text-3xl shadow-card">
            💰
          </div>
          <h1 className="font-display text-4xl font-extrabold">
            <span className="text-forest">Cha</span>
            <span className="text-gold">Ching</span>
          </h1>
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
            <span aria-hidden>🔍</span> Continue with Google
          </button>
          <button
            onClick={() => signInWithProvider("azure")}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-forest/15 bg-white px-4 py-2.5 font-semibold text-forest-dark shadow-card transition hover:shadow-soft"
          >
            <span aria-hidden>🪟</span> Continue with Microsoft
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
