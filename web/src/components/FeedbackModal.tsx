import { useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/api";
import Modal from "@/components/ui/Modal";

const RATING_META: Record<number, { emoji: string; label: string }> = {
  1: { emoji: "😠", label: "Hate it" },
  2: { emoji: "🙁", label: "Meh" },
  3: { emoji: "😐", label: "Neutral" },
  4: { emoji: "🙂", label: "Like it" },
  5: { emoji: "😍", label: "Love it" },
};

// 6-7 prebuilt reasons tuned to each rating.
const REASONS: Record<number, string[]> = {
  1: ["Too confusing", "Buggy or crashes", "Missing features I need", "Too slow", "Design needs work", "Not useful for me", "Something else"],
  2: ["Hard to use", "Occasional bugs", "Missing key features", "Feels slow", "Design could improve", "Didn't meet expectations", "Something else"],
  3: ["Add more features", "Improve the design", "Make it faster", "Fix a few bugs", "Smarter Penny (AI)", "More integrations", "Clearer insights"],
  4: ["Easy to use", "Helpful insights", "Love Penny", "Great design", "Saves me time", "Good value", "Just needs a little more"],
  5: ["Easy to use", "Helpful insights", "Love Penny", "Beautiful design", "Saves me time", "Would recommend", "Best budgeting app"],
};

function prompt(rating: number): string {
  if (rating === 3) return "What can we do better to make this a 5-star app?";
  if (rating <= 2) return "Sorry to hear that — what went wrong?";
  return "Awesome! What did you love most?";
}

interface StoreLinks {
  playStoreUrl: string | null;
  appStoreUrl: string | null;
}

export default function FeedbackModal({ onClose }: { onClose: () => void }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [reasons, setReasons] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [store, setStore] = useState<StoreLinks>({ playStoreUrl: null, appStoreUrl: null });

  useEffect(() => {
    apiGet("/api/feedback/store-links")
      .then((s) => setStore(s ?? { playStoreUrl: null, appStoreUrl: null }))
      .catch(() => {});
  }, []);

  function toggleReason(r: string) {
    setReasons((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  }

  function pickRating(n: number) {
    setRating(n);
    setReasons([]); // reasons are rating-specific
  }

  async function submit() {
    if (!rating) return;
    setSaving(true);
    setError(null);
    try {
      await apiSend("POST", "/api/feedback", { rating, reasons, comment: comment.trim() || null });
      setDone(true);
    } catch (err: any) {
      setError(err?.message ?? "Couldn't send your feedback. Try again?");
    } finally {
      setSaving(false);
    }
  }

  const active = hover || rating;
  const happy = rating >= 4;
  const hasStore = Boolean(store.playStoreUrl || store.appStoreUrl);

  return (
    <Modal title="Share your feedback" onClose={onClose} maxWidth="md">
      {!done ? (
        <div className="space-y-4">
          <p className="text-sm text-forest-light dark:text-night-muted">How do you feel about Wallet Whisperer?</p>

          {/* Star picker */}
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                onClick={() => pickRating(n)}
                aria-label={`${n} star${n > 1 ? "s" : ""} — ${RATING_META[n].label}`}
                className="text-4xl transition-transform hover:scale-110"
              >
                <span className={n <= active ? "text-gold" : "text-forest/20 dark:text-white/20"}>★</span>
              </button>
            ))}
          </div>
          {active > 0 && (
            <p className="text-center text-sm font-semibold text-forest-dark dark:text-night-ink">
              {RATING_META[active].emoji} {RATING_META[active].label}
            </p>
          )}

          {rating > 0 && (
            <>
              <p className="text-sm font-semibold text-forest-dark dark:text-night-ink">{prompt(rating)}</p>
              <div className="flex flex-wrap gap-2">
                {REASONS[rating].map((r) => (
                  <button
                    key={r}
                    onClick={() => toggleReason(r)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      reasons.includes(r)
                        ? "border-forest bg-forest text-cream"
                        : "border-forest/15 text-forest-dark hover:bg-forest-50 dark:border-white/15 dark:text-night-ink dark:hover:bg-white/5"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>

              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="Anything else you'd like to share? (optional)"
                className="ww-input"
              />

              {error && <p className="text-sm text-coral-dark">{error}</p>}

              <button
                onClick={submit}
                disabled={saving}
                className="w-full rounded-full bg-forest py-2.5 font-semibold text-cream shadow-card transition hover:bg-forest-dark disabled:opacity-60"
              >
                {saving ? "Sending…" : "Send feedback"}
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4 text-center">
          <p className="text-4xl">{happy ? "🎉" : "🙏"}</p>
          <p className="font-display text-lg font-bold text-forest-dark dark:text-night-ink">Thank you for your feedback!</p>
          <p className="text-sm text-forest-light dark:text-night-muted">
            {happy
              ? "We're so glad you're enjoying Wallet Whisperer."
              : "We read every note and we'll use yours to make the app better."}
          </p>

          {/* Item 12: after a 4-5 star rating, invite users to review on the stores.
              Only appears once store links are configured. */}
          {happy && hasStore && (
            <div className="rounded-xl2 bg-forest-50 p-4 dark:bg-white/5">
              <p className="mb-3 text-sm font-semibold text-forest-dark dark:text-night-ink">
                Would you share that love on the app store? It really helps us grow. ✨
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                {store.playStoreUrl && (
                  <a
                    href={store.playStoreUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full bg-forest px-4 py-2 text-sm font-semibold text-cream shadow-card transition hover:bg-forest-dark"
                  >
                    ▶ Rate on Google Play
                  </a>
                )}
                {store.appStoreUrl && (
                  <a
                    href={store.appStoreUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full bg-forest px-4 py-2 text-sm font-semibold text-cream shadow-card transition hover:bg-forest-dark"
                  >
                     Rate on the App Store
                  </a>
                )}
              </div>
            </div>
          )}

          <button
            onClick={onClose}
            className="w-full rounded-full bg-gold py-2.5 font-semibold text-forest-dark shadow-card transition hover:bg-gold-light"
          >
            Done
          </button>
        </div>
      )}
    </Modal>
  );
}
