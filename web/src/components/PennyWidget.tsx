import { useEffect, useRef, useState } from "react";
import { apiGet, apiSend } from "@/lib/api";
import type { ChatMessage } from "@/types";

// Generic money-app FAQs (paraphrased from common bank/fintech help sections, no brand names).
const FAQS = [
  "How do I add an expense?",
  "How do I create a budget?",
  "What's my savings rate this month?",
  "Which category am I spending the most on?",
  "How can I improve my savings?",
  "What bills or EMIs are coming up?",
];

export default function PennyWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadedHistory, setLoadedHistory] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && !loadedHistory) {
      apiGet("/api/ai/chat/history")
        .then((data) => setMessages(data ?? []))
        .catch(() => {})
        .finally(() => setLoadedHistory(true));
    }
  }, [open, loadedHistory]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, open]);

  async function ask(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { id: `l-${Date.now()}`, role: "user", content: q, created_at: new Date().toISOString() }]);
    setLoading(true);
    try {
      const { reply, actions } = await apiSend("POST", "/api/ai/chat", { message: q });
      setMessages((prev) => [
        ...prev,
        { id: `l-${Date.now()}-r`, role: "assistant", content: reply, created_at: new Date().toISOString() },
      ]);
      // If Penny changed data (created a budget/expense/income), let pages refresh.
      if (Array.isArray(actions) && actions.length > 0) {
        window.dispatchEvent(new CustomEvent("ww:data-changed"));
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `l-${Date.now()}-e`,
          role: "assistant",
          content: "Hmm, I couldn't reach my brain just now. Try again in a moment?",
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Floating launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close Penny" : "Ask Penny"}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gold text-2xl shadow-soft transition hover:scale-105 active:scale-95"
      >
        {open ? "✕" : "🪙"}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-50 flex h-[min(560px,75vh)] w-[min(380px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-xl2 border border-forest/10 bg-white shadow-soft dark:border-white/10 dark:bg-night-card">
          <div className="flex items-center gap-2 border-b border-forest/10 bg-forest px-4 py-3 text-cream dark:border-white/10">
            <span className="text-xl">🪙</span>
            <div>
              <p className="font-display font-bold leading-none">Penny</p>
              <p className="text-xs text-cream/70">Your AI money companion</p>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto scrollbar-thin p-4">
            {messages.length === 0 && (
              <div className="rounded-xl2 bg-forest-50 p-4 text-sm text-forest-dark dark:bg-white/5 dark:text-night-ink">
                Hi, I'm Penny! 👋 Ask me about your money, or try one of these:
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm shadow-card ${
                    m.role === "user"
                      ? "bg-gold text-forest-dark"
                      : "bg-forest-50 text-forest-dark dark:bg-white/5 dark:text-night-ink"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-forest-50 px-4 py-2 text-sm text-forest-light shadow-card dark:bg-white/5 dark:text-night-muted">
                  Penny is thinking…
                </div>
              </div>
            )}

            {messages.length === 0 && (
              <div className="flex flex-wrap gap-2">
                {FAQS.map((f) => (
                  <button
                    key={f}
                    onClick={() => ask(f)}
                    className="rounded-full border border-forest/15 px-3 py-1.5 text-left text-xs font-semibold text-forest-dark transition hover:bg-forest-50 dark:border-white/15 dark:text-night-ink dark:hover:bg-white/5"
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
            className="flex gap-2 border-t border-forest/10 p-3 dark:border-white/10"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Penny anything…"
              className="flex-1 rounded-full border border-forest/15 bg-white px-4 py-2 text-sm text-forest-dark outline-none focus:border-gold focus:ring-2 focus:ring-gold/30 dark:border-white/15 dark:bg-night-800 dark:text-night-ink"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-forest px-4 py-2 text-sm font-semibold text-cream shadow-card disabled:opacity-60"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
