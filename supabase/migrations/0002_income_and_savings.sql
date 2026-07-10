-- Wallet Whisperer: income tracking, primary-currency savings rollup
-- Run this in the Supabase SQL editor after 0001_init.sql.

-- ────────────────────────────────────────────────────────────
-- profiles: a primary currency that the monthly income/expense/savings
-- rollup is computed in (other-currency entries convert into it).
-- ────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists primary_currency text not null default 'INR';

-- Seed existing rows from whatever default_currency they already had.
update public.profiles set primary_currency = default_currency
where primary_currency = 'INR' and default_currency is not null and default_currency <> 'INR';

-- ────────────────────────────────────────────────────────────
-- income_categories: fixed reference list of income source types
-- ────────────────────────────────────────────────────────────
create table if not exists public.income_categories (
  id text primary key,
  label text not null,
  icon text not null,
  color text not null,
  sort_order int not null
);

alter table public.income_categories enable row level security;
create policy "income_categories: readable by anyone" on public.income_categories
  for select using (true);

insert into public.income_categories (id, label, icon, color, sort_order) values
  ('salary',        'Salary',              '💼', '#2D6A4F', 1),
  ('freelance',     'Freelance',           '🧑‍💻', '#3B6E91', 2),
  ('business',      'Business Profit',     '🏪', '#1B4332', 3),
  ('dividends',     'Dividends',           '📈', '#E8A33D', 4),
  ('interest',      'Interest',            '🏦', '#4A6FA5', 5),
  ('capital_gains', 'Capital Gains',       '💹', '#2E8B8B', 6),
  ('rental',        'Rental Income',       '🏠', '#8A5A44', 7),
  ('bonus',         'Bonus',               '🎉', '#D65D7A', 8),
  ('pension',       'Pension',             '👵', '#9B7653', 9),
  ('royalty',       'Royalty',             '🎵', '#7A5FA3', 10),
  ('refund',        'Refund / Cashback',   '💸', '#457B45', 11),
  ('gift',          'Gift',                '🎁', '#C77DA0', 12),
  ('other_income',  'Other Income',        '🪙', '#7A7A7A', 13)
on conflict (id) do nothing;

-- ────────────────────────────────────────────────────────────
-- incomes
-- ────────────────────────────────────────────────────────────
create table if not exists public.incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id text not null references public.income_categories (id),
  amount numeric(14, 2) not null check (amount >= 0),
  currency text not null default 'INR',
  -- amount converted into the user's primary currency (for cross-currency rollups)
  amount_primary numeric(14, 2),
  fx_rate numeric(18, 8),
  description text,
  source_name text,               -- e.g. employer, brokerage, tenant
  received_date date not null default current_date,
  entry_source text not null default 'manual'
    check (entry_source in ('manual', 'voice', 'receipt', 'email', 'sms', 'penny')),
  receipt_url text,
  raw_input text,
  created_at timestamptz not null default now()
);

alter table public.incomes enable row level security;
create policy "incomes: owner full access" on public.incomes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists incomes_user_id_idx on public.incomes (user_id);
create index if not exists incomes_category_id_idx on public.incomes (category_id);
create index if not exists incomes_date_idx on public.incomes (received_date);

-- ────────────────────────────────────────────────────────────
-- expenses: mirror the primary-currency columns so savings math
-- (income - expenses) can be done in one currency.
-- ────────────────────────────────────────────────────────────
alter table public.expenses
  add column if not exists amount_primary numeric(14, 2);
alter table public.expenses
  add column if not exists fx_rate numeric(18, 8);

-- Backfill historical expenses already in the user's primary currency so they
-- count in the savings rollup. Foreign-currency rows need live FX conversion —
-- run POST /api/profile/backfill-primary for those.
update public.expenses e
  set amount_primary = e.amount, fx_rate = 1
  from public.profiles p
  where e.user_id = p.id and e.amount_primary is null and e.currency = p.primary_currency;
