import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { toFile } from "openai/uploads";
import { requireAuth } from "../middleware/auth.js";
import { sendIfError } from "../lib/respond.js";
import { getPrimaryCurrency } from "../lib/primaryCurrency.js";
import { convertToPrimary } from "../lib/fx.js";
import { openai } from "../openai.js";
import { supabaseAdmin } from "../supabaseAdmin.js";

export const profileRouter = Router();
profileRouter.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const PROFILE_COLUMNS =
  "id, display_name, first_name, last_name, phone, photo_url, avatar_url, default_currency, primary_currency, subscription_tier";

profileRouter.get("/", async (req, res) => {
  const { data, error } = await req.db
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", req.userId)
    .single();
  if (sendIfError(res, error, 404)) return;
  res.json(data);
});

const profileInput = z.object({
  display_name: z.string().optional().nullable(),
  first_name: z.string().max(80).optional().nullable(),
  last_name: z.string().max(80).optional().nullable(),
  phone: z.string().max(32).optional().nullable(),
  photo_url: z.string().url().optional().nullable(),
  avatar_url: z.string().url().optional().nullable(),
  default_currency: z.string().length(3).optional(),
  primary_currency: z.string().length(3).optional(),
});

profileRouter.patch("/", async (req, res) => {
  const parsed = profileInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { data, error } = await req.db
    .from("profiles")
    .update(parsed.data)
    .eq("id", req.userId)
    .select(PROFILE_COLUMNS)
    .single();
  if (sendIfError(res, error)) return;
  res.json(data);
});

/** Upload bytes to the public `avatars` bucket under the user's folder; returns a public URL. */
async function uploadToAvatars(userId: string, name: string, bytes: Buffer, contentType: string): Promise<string | null> {
  const path = `${userId}/${name}`;
  const { error } = await supabaseAdmin.storage
    .from("avatars")
    .upload(path, bytes, { contentType, upsert: true });
  if (error) {
    console.error("[profile] avatar storage upload failed", error);
    return null;
  }
  const { data } = supabaseAdmin.storage.from("avatars").getPublicUrl(path);
  return data?.publicUrl ?? null;
}

/**
 * POST /api/profile/photo  (multipart field: "photo")
 * Stores the user's uploaded profile photo and records it on the profile.
 */
profileRouter.post("/photo", upload.single("photo"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "image is required (field name: photo)" });
  if (!req.file.mimetype?.startsWith("image/")) {
    return res.status(400).json({ error: "Please upload an image file (JPG, PNG, etc.)." });
  }
  const ext = (req.file.originalname.split(".").pop() || "png").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "png";
  const photo_url = await uploadToAvatars(req.userId, `photo-${Date.now()}.${ext}`, req.file.buffer, req.file.mimetype);
  if (!photo_url) return res.status(502).json({ error: "Couldn't store that photo. Try again?" });

  await req.db.from("profiles").update({ photo_url }).eq("id", req.userId);
  res.json({ photo_url });
});

/**
 * POST /api/profile/avatar  (multipart field: "photo")
 * Generates a stylized avatar from the uploaded photo via OpenAI's image API and
 * stores it. Returns { avatar_url } for the user to preview and optionally select.
 * Degrades gracefully: any failure returns 502 with a friendly message so the UI
 * can fall back to the plain uploaded photo.
 */
profileRouter.post("/avatar", upload.single("photo"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "image is required (field name: photo)" });
  if (!req.file.mimetype?.startsWith("image/")) {
    return res.status(400).json({ error: "Please upload an image file (JPG, PNG, etc.)." });
  }
  try {
    const image = await toFile(req.file.buffer, req.file.originalname || "photo.png", { type: req.file.mimetype });
    const result = await openai.images.edit({
      model: "gpt-image-1",
      image,
      size: "1024x1024",
      prompt:
        "Create a friendly, polished cartoon-style avatar portrait of this person: clean vector illustration, " +
        "soft warm lighting, simple flat background, head-and-shoulders framing suitable for a circular profile picture. " +
        "Keep it flattering and recognizable.",
    });
    const b64 = result.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image returned from the model.");
    const bytes = Buffer.from(b64, "base64");
    const avatar_url = await uploadToAvatars(req.userId, `avatar-${Date.now()}.png`, bytes, "image/png");
    if (!avatar_url) throw new Error("Storage upload failed.");
    res.json({ avatar_url });
  } catch (err: any) {
    console.error("[profile/avatar]", err?.message || err);
    res.status(502).json({
      error: "Penny couldn't generate an avatar right now. You can still use your uploaded photo.",
    });
  }
});

/**
 * POST /api/profile/backfill-primary   body: { recomputeAll?: boolean }
 * Fills/refreshes amount_primary/fx_rate on income and expense rows so every
 * entry is counted in the savings rollup in the user's primary currency.
 *  - Default: only rows missing a conversion (amount_primary IS NULL).
 *  - recomputeAll: every row — used after the dashboard's default currency
 *    changes, since previously-stored conversions are now against the old
 *    currency and would be stale. Safe to run repeatedly.
 */
profileRouter.post("/backfill-primary", async (req, res) => {
  const recomputeAll = req.body?.recomputeAll === true;
  const primary = await getPrimaryCurrency(req.db, req.userId);
  const result = { updated: 0, unconvertible: 0 };

  for (const table of ["incomes", "expenses"] as const) {
    let query = req.db.from(table).select("id, amount, currency");
    if (!recomputeAll) query = query.is("amount_primary", null);
    const { data: rows, error } = await query;
    if (sendIfError(res, error)) return;

    for (const r of rows ?? []) {
      const { amountPrimary, fxRate } = await convertToPrimary(Number(r.amount), r.currency, primary);
      if (amountPrimary == null) {
        result.unconvertible++;
        continue;
      }
      await req.db.from(table).update({ amount_primary: amountPrimary, fx_rate: fxRate }).eq("id", r.id);
      result.updated++;
    }
  }

  res.json({ primaryCurrency: primary, ...result });
});
