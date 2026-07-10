# ChaChing 💰
### *Listen to your money talk.*

ChaChing is an AI-powered budget tracker. **Penny**, your AI money companion, helps you log
expenses by voice or receipt photo, answers questions about your spending, and helps you stay
on track across multiple budgets — monthly expenses, trips, savings goals, or a big purchase.

- **Frontend**: React + Vite + TypeScript + Tailwind (`web/`)
- **Backend**: Node.js + Express + TypeScript (`server/`)
- **Database & Auth**: Supabase (Postgres, Row-Level Security, OAuth, Storage)
- **AI**: OpenAI (GPT-4o for Penny's chat + receipt vision, Whisper for voice-to-text)

A React Native/Expo mobile app sharing the same backend is planned as a second phase.

---

## 1. Prerequisites

- Node.js 20+
- A free [Supabase](https://supabase.com) project
- An [OpenAI](https://platform.openai.com/api-keys) API key
- (Optional, for Google/Microsoft sign-in) OAuth apps in Google Cloud Console / Azure AD

## 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com/dashboard).
2. Open **SQL Editor** → paste the contents of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) → **Run**.
   This creates `profiles`, `categories` (pre-seeded with all 25 expense categories), `budgets`,
   `expenses`, `chat_messages`, their Row-Level Security policies, and a private `receipts`
   storage bucket.
3. Go to **Project Settings → API** and note down:
   - `Project URL`
   - `anon public` key
   - `service_role` key (⚠️ server-only, never ship this to the browser)
4. Go to **Authentication → Providers**:
   - **Email**: enabled by default (used for magic-link sign-in).
   - **Google**: enable it, add your Google OAuth Client ID/Secret (from Google Cloud Console →
     APIs & Services → Credentials → OAuth 2.0 Client). Add the callback URL Supabase shows you
     to the Google app's Authorized redirect URIs.
   - **Azure (Microsoft)**: enable it, add your Azure AD App Registration's Client ID/Secret the
     same way.
   - **Phone**: deferred for now — requires an SMS provider (Twilio, MessageBird, Vonage) wired
     up under Authentication → Providers → Phone before it can be enabled.

## 3. Configure environment variables

```bash
cp server/.env.example server/.env
cp web/.env.example web/.env
```

Fill in:

- `server/.env` — `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`
- `web/.env` — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL` (defaults to `http://localhost:8787`)

## 4. Install & run

```bash
npm install                 # installs both workspaces
npm run dev:server          # http://localhost:8787
npm run dev:web             # http://localhost:5173  (in a second terminal)
```

Open http://localhost:5173, sign in, and you'll land on the Dashboard.

## Features

1. **Sign-in** — Google, Microsoft, and email magic-link today; phone/SMS OTP once a provider is
   configured (see step 2).
2. **Dashboard** — lands right after sign-in: this month's spend, top category, active budgets,
   recent expenses.
3. **Penny** — an AI chat companion (bottom-left "Ask Penny") that answers questions about your
   budgets/spending using your real data as context, backed by GPT-4o.
4. **Multiple budgets** — Monthly Expenditure, Trip, Goal, Purchase, or Custom, each with its own
   target amount, currency, and progress bar.
5. **25 expense categories** — Food & Dining, Shopping, Transport, Housing, Utilities, Work/Office,
   Technology, Health & Medical, Personal Care, Entertainment, Travel, Education, Kids & Family,
   Pets, Gifts & Donations, Investments, Savings, EMI & Loans, Taxes, Insurance, Subscriptions,
   Fitness, Lifestyle, Home Essentials, Miscellaneous.
6. **AI expense entry** — the "Add expense" modal has three tabs:
   - **Manual** — a plain form.
   - **Voice** — record with your mic; Whisper transcribes it and GPT-4o extracts amount,
     currency, category, merchant, and date into an editable draft.
   - **Receipt** — upload a photo; GPT-4o Vision reads it and drafts the expense the same way,
     while the image is archived to Supabase Storage.
7. **Reports** — category breakdown, spend-over-time, and budget comparison, filterable by date
   range and budget, built with an accessibility-validated chart palette.

## Project structure

```
web/       React + Vite + Tailwind frontend
server/    Express + TypeScript API (auth verification, CRUD, OpenAI integration)
supabase/  SQL migrations (schema, RLS policies, seed data, storage bucket)
assets/    Brand art (logo concepts, pitch deck)
```

## Notes on architecture

- The frontend talks to Supabase **directly** for auth (OAuth/magic-link) and holds the session.
- Every API call to the Express backend carries the user's Supabase access token; the backend
  verifies it and makes Postgres queries **as that user** (via a per-request Supabase client), so
  Row-Level Security — not backend code — is what actually enforces data isolation.
- The OpenAI API key never reaches the browser: all AI calls (chat, transcription, vision) are
  proxied through `server/src/routes/ai.ts`.

## Roadmap / not yet built

- Phone/SMS sign-in (needs a paid SMS provider — see step 2)
- React Native / Expo mobile app reusing the same Supabase project + Express API
- Editing/deleting individual expenses from the UI (currently create + list; API already supports
  `PATCH`/`DELETE`)
