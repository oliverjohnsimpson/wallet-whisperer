import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { toFile } from "openai/uploads";
import { requireAuth } from "../middleware/auth.js";
import { openai } from "../openai.js";
import { env } from "../env.js";
import { supabaseAdmin } from "../supabaseAdmin.js";
import { CATEGORY_IDS } from "../categories.js";
import { INCOME_CATEGORY_IDS } from "../incomeCategories.js";
import { sendIfError } from "../lib/respond.js";

export const aiRouter = Router();
aiRouter.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const PENNY_PERSONA = `You are Penny, the warm, encouraging AI money companion inside the Wallet Whisperer budget
tracker app ("Listen to your money talk"). You help users understand their income, spending, and savings, nudge them
toward their goals, and answer questions conversationally. Be concise (2-5 sentences unless asked for detail),
friendly, a little playful, and always ground your answers in the real numbers provided in the CONTEXT block — never
invent figures. If the context doesn't contain what's needed to answer precisely, say so plainly. Use the user's
currency symbols as given in the data. Do not give formal regulated financial/investment advice — keep suggestions
practical and budget-focused (e.g. spending patterns, category overspend, saving tips, savings rate).`;

async function buildUserFinancialContext(db: typeof supabaseAdmin, userId: string) {
  const since = new Date();
  since.setDate(since.getDate() - 60);
  const sinceStr = since.toISOString().slice(0, 10);

  const [{ data: budgets }, { data: expenses }, { data: incomes }] = await Promise.all([
    db.from("budgets").select("id, name, type, target_amount, currency, status").eq("user_id", userId),
    db
      .from("expenses")
      .select("amount, amount_primary, currency, category_id, expense_date, description, merchant, budget_id")
      .eq("user_id", userId)
      .gte("expense_date", sinceStr)
      .order("expense_date", { ascending: false })
      .limit(150),
    db
      .from("incomes")
      .select("amount, amount_primary, currency, category_id, received_date, description, source_name")
      .eq("user_id", userId)
      .gte("received_date", sinceStr)
      .order("received_date", { ascending: false })
      .limit(150),
  ]);

  // Only count amounts we could express in the primary currency, so the totals
  // handed to Penny match the dashboard (which excludes un-converted entries).
  const spentByBudget = new Map<string, number>();
  const spentByCategory = new Map<string, number>();
  let totalExpenses = 0;
  for (const e of expenses ?? []) {
    if (e.amount_primary == null) continue;
    const v = Number(e.amount_primary);
    totalExpenses += v;
    if (e.budget_id) spentByBudget.set(e.budget_id, (spentByBudget.get(e.budget_id) ?? 0) + v);
    spentByCategory.set(e.category_id, (spentByCategory.get(e.category_id) ?? 0) + v);
  }

  const incomeByCategory = new Map<string, number>();
  let totalIncome = 0;
  for (const i of incomes ?? []) {
    if (i.amount_primary == null) continue;
    const v = Number(i.amount_primary);
    totalIncome += v;
    incomeByCategory.set(i.category_id, (incomeByCategory.get(i.category_id) ?? 0) + v);
  }

  return {
    last60Days: {
      totalIncome,
      totalExpenses,
      savings: totalIncome - totalExpenses,
    },
    budgets: (budgets ?? []).map((b) => ({ ...b, spent: spentByBudget.get(b.id) ?? 0 })),
    spendByCategory: [...spentByCategory.entries()].map(([category_id, total]) => ({ category_id, total })),
    incomeByCategory: [...incomeByCategory.entries()].map(([category_id, total]) => ({ category_id, total })),
    recentExpenses: (expenses ?? []).slice(0, 20),
    recentIncomes: (incomes ?? []).slice(0, 20),
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

// ────────────────────────────────────────────────────────────
// Kind-aware extraction (expense or income), shared by voice / photo / text.
// ────────────────────────────────────────────────────────────
type Kind = "expense" | "income";

function buildExtractionInstructions(kind: Kind): string {
  const today = new Date().toISOString().slice(0, 10); // per-request so it never goes stale
  if (kind === "income") {
    return `Extract a single income entry from the input and respond with ONLY a JSON object
(no markdown fences) with exactly these fields:
{
  "amount": number,
  "currency": "ISO 4217 3-letter code, best guess from symbols/context, default INR if unclear",
  "category_id": one of ${JSON.stringify(INCOME_CATEGORY_IDS)},
  "source_name": string or null (e.g. employer, brokerage, tenant, bank),
  "description": short string summarizing the income,
  "received_date": "YYYY-MM-DD, best guess, default to today (${today}) if unknown",
  "confidence": number between 0 and 1
}
Pick the single best-fitting category_id from the allowed list (salary, dividends, interest, etc.).`;
  }
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

const expenseDraftSchema = z.object({
  amount: z.coerce.number().nonnegative(),
  currency: z.string().trim().length(3).catch("INR"),
  category_id: z.enum(CATEGORY_IDS).catch("miscellaneous"),
  merchant: z.string().nullable().catch(null),
  description: z.string().catch(""),
  expense_date: z.string().catch(() => new Date().toISOString().slice(0, 10)),
  confidence: z.number().min(0).max(1).catch(0.5),
});

const incomeDraftSchema = z.object({
  amount: z.coerce.number().nonnegative(),
  currency: z.string().trim().length(3).catch("INR"),
  category_id: z.enum(INCOME_CATEGORY_IDS).catch("other_income"),
  source_name: z.string().nullable().catch(null),
  description: z.string().catch(""),
  received_date: z.string().catch(() => new Date().toISOString().slice(0, 10)),
  confidence: z.number().min(0).max(1).catch(0.5),
});

function parseDraft(kind: Kind, raw: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Penny couldn't make sense of that — the extraction came back malformed. Try again?");
  }
  const schema = kind === "income" ? incomeDraftSchema : expenseDraftSchema;
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error("Penny couldn't find a valid amount in that — try again, or enter it manually.");
  }
  return result.data;
}

async function extractDraft(kind: Kind, model: string, userContent: string | Record<string, unknown>[]) {
  const completion = await openai.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: buildExtractionInstructions(kind) },
      { role: "user", content: userContent as any },
    ],
    temperature: 0.2,
  });
  return parseDraft(kind, completion.choices[0]?.message?.content ?? "{}");
}

async function transcribeAudio(file: Express.Multer.File): Promise<string> {
  const audio = await toFile(file.buffer, file.originalname || "audio.webm", {
    type: file.mimetype || "audio/webm",
  });
  const transcription = await openai.audio.transcriptions.create({ file: audio, model: env.transcribeModel });
  return transcription.text;
}

async function storeReceipt(userId: string, file: Express.Multer.File): Promise<string | null> {
  const path = `${userId}/${Date.now()}-${(file.originalname || "receipt").replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error } = await supabaseAdmin.storage
    .from("receipts")
    .upload(path, file.buffer, { contentType: file.mimetype, upsert: false });
  if (error) {
    console.error("[ai] storage upload failed", error);
    return null;
  }
  const { data: signed } = await supabaseAdmin.storage.from("receipts").createSignedUrl(path, 60 * 60 * 24 * 7);
  return signed?.signedUrl ?? null;
}

function voiceHandler(kind: Kind) {
  return async (req: any, res: any) => {
    if (!req.file) return res.status(400).json({ error: "audio file is required (field name: audio)" });
    if (req.file.mimetype && !req.file.mimetype.startsWith("audio/")) {
      return res.status(400).json({ error: "That file doesn't look like an audio recording." });
    }
    try {
      const transcript = await transcribeAudio(req.file);
      const draft = await extractDraft(kind, env.chatModel, transcript);
      res.json({ transcript, draft });
    } catch (err: any) {
      console.error(`[ai/voice-${kind}]`, err);
      res.status(502).json({ error: err.message || "Penny couldn't understand that recording. Try again?" });
    }
  };
}

function receiptHandler(kind: Kind) {
  return async (req: any, res: any) => {
    if (!req.file) return res.status(400).json({ error: "image is required (field name: receipt)" });
    if (!req.file.mimetype || !req.file.mimetype.startsWith("image/")) {
      return res.status(400).json({ error: "Please upload an image file (JPG, PNG, HEIC, etc.)." });
    }
    try {
      const dataUri = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
      const prompt =
        kind === "income"
          ? "Extract the income from this document (payslip, dividend note, or bank statement screenshot)."
          : "Extract the expense from this receipt image.";
      const draft = await extractDraft(kind, env.visionModel, [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: dataUri } },
      ]);
      const receipt_url = await storeReceipt(req.userId, req.file);
      res.json({ draft, receipt_url });
    } catch (err: any) {
      console.error(`[ai/receipt-${kind}]`, err);
      res.status(502).json({ error: err.message || "Penny couldn't read that image. Try a clearer photo?" });
    }
  };
}

// Expense capture (existing behaviour, now via shared handlers)
aiRouter.post("/voice-expense", upload.single("audio"), voiceHandler("expense"));
aiRouter.post("/receipt-expense", upload.single("receipt"), receiptHandler("expense"));

// Income capture
aiRouter.post("/voice-income", upload.single("audio"), voiceHandler("income"));
aiRouter.post("/receipt-income", upload.single("receipt"), receiptHandler("income"));

/** POST /api/ai/parse-text — { text, kind } → { draft }. For pasted text (and future email/SMS ingestion). */
aiRouter.post("/parse-text", async (req, res) => {
  const text = String(req.body?.text ?? "").trim();
  const kind: Kind = req.body?.kind === "income" ? "income" : "expense";
  if (!text) return res.status(400).json({ error: "text is required" });
  try {
    const draft = await extractDraft(kind, env.chatModel, text);
    res.json({ draft });
  } catch (err: any) {
    console.error("[ai/parse-text]", err);
    res.status(502).json({ error: err.message || "Penny couldn't parse that text. Try again?" });
  }
});
