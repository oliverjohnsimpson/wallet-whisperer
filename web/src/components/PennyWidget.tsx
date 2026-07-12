import { useEffect, useRef, useState } from "react";
import { apiGet, apiSend, apiUpload } from "@/lib/api";
import type { ChatMessage } from "@/types";

// Prebuilt conversation starters — shown only at the start of a session so users
// can pick a jumping-off point, and hidden once a conversation is underway.
const STARTERS = [
  "How do I add an expense?",
  "How do I create a budget?",
  "What's my savings rate this month?",
  "Which category am I spending the most on?",
  "How can I improve my savings?",
  "What bills or EMIs are coming up?",
];

// One session per app load (≈ per login). History for the session lives in the DB
// but starts empty on the client so the user gets a fresh conversation each login.
function newSessionId() {
  return crypto.randomUUID?.() ?? `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function PennyWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [firstName, setFirstName] = useState<string>("");
  const [greetingOpen, setGreetingOpen] = useState(false);

  // Multimodal input (item 5)
  const [attachOpen, setAttachOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  const sessionId = useRef<string>(newSessionId());
  const bottomRef = useRef<HTMLDivElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  // Mirror the latest typed text + image so the recorder's async onstop can read them.
  const pendingRef = useRef<{ text: string; image: File | null }>({ text: "", image: null });
  pendingRef.current = { text: input, image: imageFile };

  useEffect(() => {
    apiGet("/api/profile")
      .then((p) => {
        const name = (p?.first_name || p?.display_name || "").toString().split(" ")[0];
        if (name) setFirstName(name);
      })
      .catch(() => {});
    const t = setTimeout(() => setGreetingOpen(true), 1200);
    const hide = setTimeout(() => setGreetingOpen(false), 9000);
    return () => {
      clearTimeout(t);
      clearTimeout(hide);
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, open]);

  const midConversation = messages.length > 0;

  function pickImage(file: File | undefined) {
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setAttachOpen(false);
  }

  function clearImage() {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
  }

  async function send({ text, image, audio }: { text?: string; image?: File | null; audio?: Blob | null }) {
    const t = (text ?? "").trim();
    const img = image ?? null;
    const aud = audio ?? null;
    if ((!t && !img && !aud) || loading) return;

    setInput("");
    clearImage();
    setAttachOpen(false);

    const markers = [img ? "📷 Image" : "", aud ? "🎙️ Voice note" : ""].filter(Boolean).join(" · ");
    const bubble = t ? (markers ? `${t}  ·  ${markers}` : t) : markers || "…";
    setMessages((prev) => [...prev, { id: `l-${Date.now()}`, role: "user", content: bubble, created_at: new Date().toISOString() }]);
    setLoading(true);
    try {
      let data: any;
      if (img || aud) {
        const fd = new FormData();
        if (t) fd.append("message", t);
        fd.append("sessionId", sessionId.current);
        if (img) fd.append("image", img);
        if (aud) fd.append("audio", aud, "voice.webm");
        data = await apiUpload("/api/ai/chat/rich", fd);
      } else {
        data = await apiSend("POST", "/api/ai/chat", { message: t, sessionId: sessionId.current });
      }
      setMessages((prev) => [
        ...prev,
        { id: `l-${Date.now()}-r`, role: "assistant", content: data.reply, created_at: new Date().toISOString() },
      ]);
      if (Array.isArray(data.actions) && data.actions.length > 0) {
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

  async function startRecording() {
    if (recording || loading) return;
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size > 0) send({ text: pendingRef.current.text, image: pendingRef.current.image, audio: blob });
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (err: any) {
      setMicError(err?.name === "NotAllowedError" ? "Microphone access was denied." : "Couldn't access your microphone.");
    }
  }

  function stopRecording() {
    if (!recording) return;
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  async function clearChat() {
    try {
      await apiSend("DELETE", "/api/ai/chat/history");
    } catch {
      /* best-effort */
    }
    sessionId.current = newSessionId();
    setMessages([]);
  }

  const greetingName = firstName ? `, ${firstName}` : "";

  return (
    <>
      {/* One-time greeting bubble on login */}
      {greetingOpen && !open && (
        <button
          onClick={() => {
            setGreetingOpen(false);
            setOpen(true);
          }}
          className="fixed bottom-24 right-5 z-50 max-w-[220px] rounded-2xl bg-white px-4 py-2 text-left text-sm font-semibold text-forest-dark shadow-soft dark:bg-night-card dark:text-night-ink"
        >
          👋 Hi{greetingName}! I'm Penny — tap to chat about your money.
        </button>
      )}

      {/* Floating launcher (shining) */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close Penny" : "Ask Penny"}
        className={`fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-gold text-2xl shadow-soft transition hover:scale-105 active:scale-95 ${
          open ? "" : "penny-shine"
        }`}
      >
        {open ? "✕" : "🪙"}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-50 flex h-[min(560px,75vh)] w-[min(380px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-xl2 border border-forest/10 bg-white shadow-soft dark:border-white/10 dark:bg-night-card">
          <div className="flex items-center gap-2 border-b border-forest/10 bg-forest px-4 py-3 text-cream dark:border-white/10">
            <span className="text-xl">🪙</span>
            <div className="flex-1">
              <p className="font-display font-bold leading-none">Penny</p>
              <p className="text-xs text-cream/70">Your AI money companion</p>
            </div>
            {midConversation && (
              <button
                onClick={clearChat}
                title="Clear chat and start fresh"
                className="rounded-full px-2 py-1 text-xs font-semibold text-cream/80 transition hover:bg-white/10"
              >
                New chat
              </button>
            )}
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto scrollbar-thin p-4">
            {!midConversation && (
              <div className="rounded-xl2 bg-forest-50 p-4 text-sm text-forest-dark dark:bg-white/5 dark:text-night-ink">
                Hi{greetingName}! 👋 I'm Penny. Ask me anything, snap a receipt 📷, or send a voice note 🎙️ — or pick a
                starter below:
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm shadow-card ${
                    m.role === "user" ? "bg-gold text-forest-dark" : "bg-forest-50 text-forest-dark dark:bg-white/5 dark:text-night-ink"
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

            {!midConversation && (
              <div className="flex flex-wrap gap-2">
                {STARTERS.map((f) => (
                  <button
                    key={f}
                    onClick={() => send({ text: f })}
                    className="rounded-full border border-forest/15 px-3 py-1.5 text-left text-xs font-semibold text-forest-dark transition hover:bg-forest-50 dark:border-white/15 dark:text-night-ink dark:hover:bg-white/5"
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Attachment preview */}
          {imagePreview && (
            <div className="flex items-center gap-2 border-t border-forest/10 px-3 pt-2 dark:border-white/10">
              <img src={imagePreview} alt="Attachment" className="h-12 w-12 rounded-lg object-cover shadow-card" />
              <span className="text-xs text-forest-light dark:text-night-muted">Image attached</span>
              <button onClick={clearImage} className="ml-auto rounded-full px-2 py-1 text-xs font-semibold text-coral hover:bg-coral/10">
                Remove
              </button>
            </div>
          )}
          {micError && <p className="border-t border-forest/10 px-3 pt-2 text-xs text-coral-dark dark:border-white/10">{micError}</p>}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send({ text: input, image: imageFile });
            }}
            className="relative flex items-center gap-2 border-t border-forest/10 p-3 dark:border-white/10"
          >
            {/* Creative "+" attach menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setAttachOpen((o) => !o)}
                aria-label="Add an image or photo"
                className={`flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold shadow-card transition ${
                  attachOpen ? "rotate-45 bg-forest text-cream" : "bg-forest-50 text-forest-dark dark:bg-white/10 dark:text-night-ink"
                }`}
              >
                +
              </button>
              {attachOpen && (
                <div className="absolute bottom-11 left-0 z-10 w-44 overflow-hidden rounded-xl2 border border-forest/10 bg-white shadow-soft dark:border-white/10 dark:bg-night-card">
                  <button
                    type="button"
                    onClick={() => uploadRef.current?.click()}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-forest-dark transition hover:bg-forest-50 dark:text-night-ink dark:hover:bg-white/5"
                  >
                    🖼️ Upload image
                  </button>
                  <button
                    type="button"
                    onClick={() => cameraRef.current?.click()}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-forest-dark transition hover:bg-forest-50 dark:text-night-ink dark:hover:bg-white/5"
                  >
                    📸 Take photo
                  </button>
                </div>
              )}
            </div>
            <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e.target.files?.[0])} />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pickImage(e.target.files?.[0])} />

            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={recording ? "Listening… release to send" : "Ask, or attach an image…"}
              className="flex-1 rounded-full border border-forest/15 bg-white px-4 py-2 text-sm text-forest-dark outline-none focus:border-gold focus:ring-2 focus:ring-gold/30 dark:border-white/15 dark:bg-night-800 dark:text-night-ink"
            />

            {/* Press-and-hold mic for a voice message */}
            <button
              type="button"
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onMouseLeave={stopRecording}
              onTouchStart={(e) => {
                e.preventDefault();
                startRecording();
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                stopRecording();
              }}
              aria-label="Hold to record a voice message"
              title="Hold to talk"
              className={`flex h-9 w-9 items-center justify-center rounded-full text-lg shadow-card transition ${
                recording ? "scale-110 animate-pulse bg-coral text-white" : "bg-forest-50 text-forest-dark dark:bg-white/10 dark:text-night-ink"
              }`}
            >
              🎙️
            </button>

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
