import { useEffect, useRef, useState } from "react";
import { apiGet, apiSend } from "@/lib/api";
import type { ChatMessage } from "@/types";

export default function PennyChat({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiGet("/api/ai/chat/history")
      .then((data) => setMessages(data ?? []))
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: "user", content: text, created_at: new Date().toISOString() },
    ]);
    setLoading(true);

    try {
      const { reply } = await apiSend("POST", "/api/ai/chat", { message: text });
      setMessages((prev) => [
        ...prev,
        { id: `local-${Date.now()}-r`, role: "assistant", content: reply, created_at: new Date().toISOString() },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}-e`,
          role: "assistant",
          content: "Hmm, I couldn't reach my brain just now. Try again?",
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col border-l border-forest/10 bg-white shadow-soft">
      <div className="flex items-center justify-between border-b border-forest/10 bg-forest px-4 py-3 text-cream">
        <div className="flex items-center gap-2">
          <span className="text-xl">🪙</span>
          <div>
            <p className="font-display font-bold leading-none">Penny</p>
            <p className="text-xs text-cream/70">Your AI money companion</p>
          </div>
        </div>
        <button onClick={onClose} className="rounded-full px-2 py-1 text-cream/80 hover:bg-white/10" aria-label="Close">
          ✕
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto scrollbar-thin p-4">
        {historyLoading && <p className="text-center text-sm text-forest-light">Loading your chat with Penny…</p>}

        {!historyLoading && messages.length === 0 && (
          <div className="rounded-xl2 bg-forest-50 p-4 text-sm text-forest-dark">
            Hi, I'm Penny! 👋 Ask me things like <em>"How much did I spend on food this month?"</em> or{" "}
            <em>"Am I on track for my Goa trip budget?"</em>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-card ${
                m.role === "user" ? "bg-gold text-forest-dark" : "bg-forest-50 text-forest-dark"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl bg-forest-50 px-4 py-2 text-sm text-forest-light shadow-card">
              Penny is thinking…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="flex gap-2 border-t border-forest/10 p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Penny about your money…"
          className="flex-1 rounded-full border border-forest/15 px-4 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
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
  );
}
