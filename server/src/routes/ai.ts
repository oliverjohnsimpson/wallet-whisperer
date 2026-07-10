import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { toFile } from "openai/uploads";
import { requireAuth } from "../middleware/auth.js";
import { openai } from "../openai.js";
import { env } from "../env.js";
import { supabaseAdmin } from "../supabaseAdmin.js";
import { CATEGORY_IDS } from "../categories.js";
import { sendIfError } from "../lib/respond.js";

export const aiRouter = Router();
aiRouter.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const PENNY_PERSONA = `You are Penny, the warm, encouraging AI money companion inside the ChaChing budget tracker app
("Listen to your money talk"). You help users understand their spending, nudge them toward their goals, and answer
questions about their budgets and expenses conversationally. Be concise (2-5 sentences unless asked for detail),
friendly, a little playful, and always ground your answers in the real numbers provided in the CONTEXT block — never
invent figures. If the context doesn't contain what's needed to answer precisely, say so plainly. Use the user's
currency symbols as given in the data. Do not give formal regulated financial/investment advice — keep suggestions
practical and budget-focused (e.g. spending patterns, category overspend, saving tips, goal pacing).`;

async function buildUserFinancialContext(db: typeof supabaseAdmin, userId: string) {
  const since = new Date();
  since.setDate(since.getDate() - 60);
  const sinceStr = since.toISOString().slice(0, 10);

  const [{ data: budgets }, { data: expenses }] = await Promise.all([
    db.from("budgets").select("id, name, type, target_amount, currency, status").eq("user_id", userId),
    db
      .from("expenses")
      .select("amount, currency, category_id, expense_date, description, merchant, budget_id")
      .eq("user_id", userId)
      .gte("expense_date", sinceStr)
      .order("expense_date", { ascending: false })
      .limit(150),
  ]);

  const spentByBudget = new Map<string, number>();
  const spentByCategory = new Map<string, number>();
  for (const e of expenses ?? []) {
    if (e.budget_id) spentByBudget.set(e.budget_id, (spentByBudget.get(e.budget_id) ?? 0) + Number(e.amount));
    spentByCategory.set(e.category_id, (spentByCategory.get(e.category_id) ?? 0) + Number(e.amount));
  }

  return {
    budgets: (budgets ?? []).map((b) => ({ ...b, spent: spentByBudget.get(b.id) ?? 0 })),
    spendByCategoryLast60Days: [...spentByCategory.entries()].map(([category_id, total]) => ({ category_id, total })),
    recentExpenses: (expenses ?? []).slice(0, 30),
  };
}

/** POST /api/ai/chat — { message: string } → { reply: string } */
aiRouter.post("/chat", async (req, res) => {
  const message = String(req.body?.message ?? "").trim();
  if (!message) return res.status(400).json({ error: "message is required" });

  try {
    const [context, { data: history }] = await Promise.all([
      buildUserFinancialContext(req.db, req.userId),
      req.db
        .from("chat_messages")
        .select("role, content")
        .eq("user_id", req.userId)
        .order("created_at", { ascending: false })
        .limit(16),
    ]);

    const orderedHistory = (history ?? []).slice().reverse();

    const completion = await openai.chat.completions.create({
      model: env.chatModel,
      messages: [
        { role: "system", content: PENNY_PERSONA },
        { role: "system", content: `CONTEXT (JSON, last 60 days):\n${JSON.stringify(context)}` },
        ...orderedHistory.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user", content: message },
      ],
      temperature: 0.6,
    });

    const reply = completion.choices[0]?.message?.content ?? "Sorry, I couldn't come up with a reply just now.";

    await req.db.from("chat_messages").insert([
      { user_id: req.userId, role: "user", content: message },
      { user_id: req.userId, role: "assistant", content: reply },
    ]);

    res.json({ reply });
  } catch (err: any) {
    console.error("[ai/chat]", err);
    res.status(502).json({ error: "Penny is having trouble thinking right now. Try again in a moment." });
  }
});

/** GET /api/ai/chat/history */
aiRouter.get("/chat/history", async (req, res) => {
  const { data, error } = await req.db
    .from("chat_messages")
    .select("id, role, content, created_at")
    .eq("user_id", req.userId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (sendIfError(res, error)) return;
  res.json(data);
});

function buildExtractionInstructions(): string {
  // Computed per-request (not a module-level const) so "today" never goes stale
  // for the life of a long-running server process.
  const today = new Date().toISOString().slice(0, 10);
  return `Extract a single expense from the input and respond with ONLY a JSON object
(no markdown fences) with exactly these fields:
{
  "amount": number,
  "currency": "ISO 4217 3-letter code, best guess from symbols/context, default INR if unclear",
  "category_id": one of ${JSON.stringify(CATEGORY_IDS)},
  "merchant": string or null,
  "description": short string summarizing the expense,
  "expense_date": "YYYY-MM-DD, best guess, default to today (${today}) if unknown",
  "confidence": number between 0 and 1
}
Pick the single best-fitting category_id from the allowed list. If multiple items are present, sum them into one total
and mention the breakdown in "description".`;
}

const draftSchema = z.object({
  amount: z.coerce.number().nonnegative(),
  currency: z.string().trim().length(3).catch("INR"),
  category_id: z.enum(CATEGORY_IDS).catch("miscellaneous"),
  merchant: z.string().nullable().catch(null),
  description: z.string().catch(""),
  expense_date: z.string().catch(() => new Date().toISOString().slice(0, 10)),
  confidence: z.number().min(0).max(1).catch(0.5),
});

/** Parses and validates the model's JSON draft; throws with a clear message on malformed/unusable output. */
function parseExpenseDraft(raw: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Penny couldn't make sense of that — the extraction came back malformed. Try again?");
  }
  const result = draftSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error("Penny couldn't find a valid amount in that — try again, or enter it manually.");
  }
  return result.data;
}

/** Shared by /voice-expense and /receipt-expense: runs the extraction prompt and validates the result. */
async function extractExpenseDraft(model: string, userContent: string | Record<string, unknown>[]) {
  const completion = await openai.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: buildExtractionInstructions() },
      { role: "user", content: userContent as any },
    ],
    temperature: 0.2,
  });
  return parseExpenseDraft(completion.choices[0]?.message?.content ?? "{}");
}

/** POST /api/ai/voice-expense — multipart form field "audio" → transcript + expense draft */
aiRouter.post("/voice-expense", upload.single("audio"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "audio file is required (field name: audio)" });
  if (req.file.mimetype && !req.file.mimetype.startsWith("audio/")) {
    return res.status(400).json({ error: "That file doesn't look like an audio recording." });
  }

  try {
    const file = await toFile(req.file.buffer, req.file.originalname || "audio.webm", {
      type: req.file.mimetype || "audio/webm",
    });

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: env.transcribeModel,
    });

    const transcript = transcription.text;
    const draft = await extractExpenseDraft(env.chatModel, transcript);
    res.json({ transcript, draft });
  } catch (err: any) {
    console.error("[ai/voice-expense]", err);
    res.status(502).json({ error: err.message || "Penny couldn't understand that recording. Try again?" });
  }
});

/** POST /api/ai/receipt-expense — multipart form field "receipt" → expense draft + receipt_url */
aiRouter.post("/receipt-expense", upload.single("receipt"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "receipt image is required (field name: receipt)" });
  if (!req.file.mimetype || !req.file.mimetype.startsWith("image/")) {
    return res.status(400).json({ error: "Please upload an image file (JPG, PNG, HEIC, etc.)." });
  }

  try {
    const base64 = req.file.buffer.toString("base64");
    const dataUri = `data:${req.file.mimetype};base64,${base64}`;

    const draft = await extractExpenseDraft(env.visionModel, [
      { type: "text", text: "Extract the expense from this receipt image." },
      { type: "image_url", image_url: { url: dataUri } },
    ]);

    const path = `${req.userId}/${Date.now()}-${(req.file.originalname || "receipt").replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("receipts")
      .upload(path, req.file.buffer, { contentType: req.file.mimetype, upsert: false });

    let receipt_url: string | null = null;
    if (!uploadError) {
      const { data: signed } = await supabaseAdmin.storage.from("receipts").createSignedUrl(path, 60 * 60 * 24 * 7);
      receipt_url = signed?.signedUrl ?? null;
    } else {
      console.error("[ai/receipt-expense] storage upload failed", uploadError);
    }

    res.json({ draft, receipt_url, receipt_path: uploadError ? null : path });
  } catch (err: any) {
    console.error("[ai/receipt-expense]", err);
    res.status(502).json({ error: err.message || "Penny couldn't read that receipt. Try a clearer photo?" });
  }
});
