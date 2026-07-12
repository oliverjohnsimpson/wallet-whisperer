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
import { getPrimaryCurrency } from "../lib/primaryCurrency.js";
import { convertToPrimary } from "../lib/fx.js";
import { getTier } from "../lib/subscription.js";
import { FREE_LIMITS } from "../lib/entitlements.js";
import type { SupabaseClient } from "@supabase/supabase-js";

export const aiRouter = Router();
aiRouter.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const PENNY_PERSONA = `You are Penny, the warm, encouraging AI money companion inside the Wallet Whisperer budget
tracker app ("Listen to your money talk"). You help users understand their income, spending, and savings, nudge them
toward their goals, and answer questions conversationally. Be concise (2-5 sentences unless asked for detail),
friendly, a little playful, and always ground your answers in the real numbers provided in the CONTEXT block — never
invent figures. If the context doesn't contain what's needed to answer precisely, say so plainly. Use the user's
currency symbols as given in the data. Do not give formal regulated financial/investment advice — keep suggestions
practical and budget-focused (e.g. spending patterns, category overspend, saving tips, savings rate).

You can also TAKE ACTIONS for the user with your tools: log an expense, log an income, create a budget, or pull a
fresh report summary. When the user asks you to record something or create a budget, call the matching tool, then
confirm in one short friendly sentence what you did (with the amount and category). If a detail is ambiguous, make a
sensible assumption and mention it rather than refusing. Default currency is the user's primary currency; default the
date to today when unspecified.`;

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

// Tools Penny can call to act on the user's data.
const PENNY_TOOLS: any[] = [
  {
    type: "function",
    function: {
      name: "log_expense",
      description: "Record a new expense for the user.",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number" },
          currency: { type: "string", description: "3-letter ISO code; default the user's primary currency" },
          category_id: { type: "string", enum: [...CATEGORY_IDS] },
          description: { type: "string" },
          merchant: { type: "string" },
          expense_date: { type: "string", description: "YYYY-MM-DD; default today" },
        },
        required: ["amount", "category_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_income",
      description: "Record a new income entry for the user.",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number" },
          currency: { type: "string", description: "3-letter ISO code; default the user's primary currency" },
          category_id: { type: "string", enum: [...INCOME_CATEGORY_IDS] },
          description: { type: "string" },
          source_name: { type: "string", description: "employer, brokerage, tenant, etc." },
          received_date: { type: "string", description: "YYYY-MM-DD; default today" },
        },
        required: ["amount", "category_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_budget",
      description: "Create a budget the user can save toward for a future expense.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          type: { type: "string", enum: ["monthly_expenditure", "trip", "goal", "purchase", "custom"] },
          target_amount: { type: "number" },
          currency: { type: "string" },
          end_date: { type: "string", description: "YYYY-MM-DD target date, optional" },
        },
        required: ["name", "type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_report_summary",
      description: "Get the user's income, expenses and savings totals (in their primary currency) for a date range.",
      parameters: {
        type: "object",
        properties: {
          from: { type: "string", description: "YYYY-MM-DD start; default start of this month" },
          to: { type: "string", description: "YYYY-MM-DD end; optional" },
        },
      },
    },
  },
];

async function runPennyTool(name: string, args: any, db: SupabaseClient, userId: string) {
  const primary = await getPrimaryCurrency(db, userId);

  if (name === "log_expense") {
    const currency = String(args.currency || primary).toUpperCase();
    const { amountPrimary, fxRate } = await convertToPrimary(Number(args.amount), currency, primary);
    const { data, error } = await db
      .from("expenses")
      .insert({
        user_id: userId,
        category_id: args.category_id,
        amount: Number(args.amount),
        currency,
        amount_primary: amountPrimary,
        fx_rate: fxRate,
        description: args.description ?? null,
        merchant: args.merchant ?? null,
        expense_date: args.expense_date || new Date().toISOString().slice(0, 10),
        source: "penny",
      })
      .select("id, amount, currency, category_id, expense_date")
      .single();
    if (error) return { result: { ok: false, error: error.message } };
    return { result: { ok: true, expense: data }, action: { type: "expense_created", id: data.id } };
  }

  if (name === "log_income") {
    const currency = String(args.currency || primary).toUpperCase();
    const { amountPrimary, fxRate } = await convertToPrimary(Number(args.amount), currency, primary);
    const { data, error } = await db
      .from("incomes")
      .insert({
        user_id: userId,
        category_id: args.category_id,
        amount: Number(args.amount),
        currency,
        amount_primary: amountPrimary,
        fx_rate: fxRate,
        description: args.description ?? null,
        source_name: args.source_name ?? null,
        received_date: args.received_date || new Date().toISOString().slice(0, 10),
        entry_source: "penny",
      })
      .select("id, amount, currency, category_id, received_date")
      .single();
    if (error) return { result: { ok: false, error: error.message } };
    return { result: { ok: true, income: data }, action: { type: "income_created", id: data.id } };
  }

  if (name === "create_budget") {
    const { data, error } = await db
      .from("budgets")
      .insert({
        user_id: userId,
        name: args.name,
        type: args.type,
        target_amount: args.target_amount ?? null,
        currency: String(args.currency || primary).toUpperCase(),
        end_date: args.end_date ?? null,
      })
      .select("id, name, type, target_amount, currency")
      .single();
    if (error) return { result: { ok: false, error: error.message } };
    return { result: { ok: true, budget: data }, action: { type: "budget_created", id: data.id } };
  }

  if (name === "get_report_summary") {
    const from = args.from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    let incQ = db.from("incomes").select("amount_primary, currency, amount, category_id").gte("received_date", from);
    let expQ = db.from("expenses").select("amount_primary, currency, amount, category_id").gte("expense_date", from);
    if (args.to) {
      incQ = incQ.lte("received_date", args.to);
      expQ = expQ.lte("expense_date", args.to);
    }
    const [{ data: inc }, { data: exp }] = await Promise.all([incQ, expQ]);
    const val = (r: any) => (r.amount_primary != null ? Number(r.amount_primary) : r.currency === primary ? Number(r.amount) : 0);
    const income = (inc ?? []).reduce((s, r) => s + val(r), 0);
    const expenses = (exp ?? []).reduce((s, r) => s + val(r), 0);
    return {
      result: {
        ok: true,
        primaryCurrency: primary,
        from,
        to: args.to ?? null,
        income,
        expenses,
        savings: income - expenses,
        savingsRate: income > 0 ? (income - expenses) / income : 0,
      },
    };
  }

  return { result: { ok: false, error: `Unknown tool ${name}` } };
}

/** POST /api/ai/chat — { message } → { reply, actions }. Penny can answer and take actions. */
aiRouter.post("/chat", async (req, res) => {
  const message = String(req.body?.message ?? "").trim();
  if (!message) return res.status(400).json({ error: "message is required" });
  // A session groups one login's conversation. History for context/continuity is
  // scoped to it so a fresh session starts clean (and shows starter prompts),
  // while every message is still persisted to the database.
  const sessionId = req.body?.sessionId ? String(req.body.sessionId).slice(0, 64) : null;

  // Free tier is capped on Penny messages per day.
  const tier = await getTier(req.db, req.userId);
  if (tier === "free") {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { count } = await req.db
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("role", "user")
      .gte("created_at", startOfDay.toISOString());
    if ((count ?? 0) >= FREE_LIMITS.pennyMessagesPerDay) {
      return res.status(403).json({
        error: `You've reached today's ${FREE_LIMITS.pennyMessagesPerDay}-message limit with Penny on the Free plan. Upgrade for unlimited chats.`,
        code: "upgrade_required",
        requiredTier: "standard",
        currentTier: tier,
      });
    }
  }

  try {
    const [context, { data: history }] = await Promise.all([
      buildUserFinancialContext(req.db, req.userId),
      (() => {
        let q = req.db
          .from("chat_messages")
          .select("role, content")
          .eq("user_id", req.userId)
          .order("created_at", { ascending: false })
          .limit(16);
        if (sessionId) q = q.eq("session_id", sessionId);
        return q;
      })(),
    ]);

    const orderedHistory = (history ?? []).slice().reverse();
    const today = new Date().toISOString().slice(0, 10);

    const messages: any[] = [
      { role: "system", content: PENNY_PERSONA },
      { role: "system", content: `Today is ${today}.\nCONTEXT (JSON, last 60 days):\n${JSON.stringify(context)}` },
      ...orderedHistory.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user", content: message },
    ];

    const actions: any[] = [];
    let reply = "";

    for (let step = 0; step < 5; step++) {
      const completion = await openai.chat.completions.create({
        model: env.chatModel,
        messages,
        tools: PENNY_TOOLS,
        temperature: 0.5,
      });
      const msg = completion.choices[0]?.message;
      if (!msg) break;

      if (msg.tool_calls?.length) {
        messages.push(msg);
        for (const tc of msg.tool_calls) {
          let parsedArgs: any = {};
          try {
            parsedArgs = JSON.parse(tc.function.arguments || "{}");
          } catch {
            /* leave empty */
          }
          const { result, action } = await runPennyTool(tc.function.name, parsedArgs, req.db, req.userId);
          if (action) actions.push(action);
          messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
        }
        continue; // let the model read tool results and respond
      }

      reply = msg.content ?? "";
      break;
    }

    if (!reply) reply = "Done!";

    await req.db.from("chat_messages").insert([
      { user_id: req.userId, role: "user", content: message, session_id: sessionId },
      { user_id: req.userId, role: "assistant", content: reply, session_id: sessionId },
    ]);

    res.json({ reply, actions });
  } catch (err: any) {
    console.error("[ai/chat]", err);
    res.status(502).json({ error: "Penny is having trouble thinking right now. Try again in a moment." });
  }
});

/** GET /api/ai/chat/history?sessionId= — messages for one session (or all if omitted). */
aiRouter.get("/chat/history", async (req, res) => {
  let query = req.db
    .from("chat_messages")
    .select("id, role, content, created_at")
    .eq("user_id", req.userId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (req.query.sessionId) query = query.eq("session_id", String(req.query.sessionId));

  const { data, error } = await query;
  if (sendIfError(res, error)) return;
  res.json(data);
});

/**
 * DELETE /api/ai/chat/history?sessionId=
 * Clears the user's Penny history. With sessionId, only that session; otherwise all.
 * History stays in the database until this is called — the client uses it to start
 * a user fresh while keeping the record until they explicitly clear it.
 */
aiRouter.delete("/chat/history", async (req, res) => {
  let query = req.db.from("chat_messages").delete().eq("user_id", req.userId);
  if (req.query.sessionId) query = query.eq("session_id", String(req.query.sessionId));
  const { error } = await query;
  if (sendIfError(res, error)) return;
  res.status(204).end();
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
