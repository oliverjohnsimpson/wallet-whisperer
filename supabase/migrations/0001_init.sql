-- ChaChing: initial schema
-- Run this in the Supabase SQL editor, or via `supabase db push`.

-- ────────────────────────────────────────────────────────────
-- profiles: 1:1 with auth.users
-- ────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  default_currency text not null default 'INR',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: user can read own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles: user can update own" on public.profiles
  for update using (auth.uid() = id);
create policy "profiles: user can insert own" on public.profiles
  for insert with check (auth.uid() = id);

-- auto-create a profile row whenever a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ────────────────────────────────────────────────────────────
-- categories: fixed reference list, publicly readable
-- ────────────────────────────────────────────────────────────
create table if not exists public.categories (
  id text primary key,
  label text not null,
  icon text not null,
  color text not null,
  sort_order int not null
);

alter table public.categories enable row level security;
create policy "categories: readable by anyone" on public.categories
  for select using (true);

insert into public.categories (id, label, icon, color, sort_order) values
  ('food_dining',       'Food & Dining',      '🍜', '#E86A5C', 1),
  ('shopping',          'Shopping',            '🛍️', '#D98E3F', 2),
  ('transport',         'Transport',           '🚗', '#3E7C6B', 3),
  ('housing',           'Housing',             '🏠', '#8A5A44', 4),
  ('utilities',         'Utilities',           '💡', '#E8A33D', 5),
  ('work_office',       'Work / Office',       '💼', '#4C6B54', 6),
  ('technology',        'Technology',          '💻', '#3B6E91', 7),
  ('health_medical',    'Health & Medical',    '⚕️', '#C4574F', 8),
  ('personal_care',     'Personal Care',       '🧴', '#B78BB0', 9),
  ('entertainment',     'Entertainment',       '🎬', '#7A5FA3', 10),
  ('travel',            'Travel',              '✈️', '#2E8B8B', 11),
  ('education',         'Education',           '📚', '#4A6FA5', 12),
  ('kids_family',       'Kids & Family',       '👨‍👩‍👧', '#E6924E', 13),
  ('pets',              'Pets',                '🐾', '#9B7653', 14),
  ('gifts_donations',   'Gifts & Donations',   '🎁', '#D65D7A', 15),
  ('investments',       'Investments',         '📈', '#1B4332', 16),
  ('savings',           'Savings',             '🐷', '#2D6A4F', 17),
  ('emi_loans',         'EMI & Loans',         '🏦', '#6B4F3F', 18),
  ('taxes',             'Taxes',               '🧾', '#5C5C5C', 19),
  ('insurance',         'Insurance',           '🛡️', '#3D5A80', 20),
  ('subscriptions',     'Subscriptions',       '🔁', '#8E5572', 21),
  ('fitness',           'Fitness',             '🏋️', '#457B45', 22),
  ('lifestyle',         'Lifestyle',           '✨', '#C77DA0', 23),
  ('home_essentials',   'Home Essentials',     '🧺', '#B08968', 24),
  ('miscellaneous',     'Miscellaneous',       '🗂️', '#7A7A7A', 25)
on conflict (id) do nothing;

-- ────────────────────────────────────────────────────────────
-- budgets: monthly expenditure, trips, goals, purchases, custom
-- ────────────────────────────────────────────────────────────
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type text not null check (type in ('monthly_expenditure', 'trip', 'goal', 'purchase', 'custom')),
  target_amount numeric(14, 2),
  currency text not null default 'INR',
  start_date date not null default current_date,
  end_date date,
  icon text default '💰',
  color text default '#2D6A4F',
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  created_at timestamptz not null default now()
);

alter table public.budgets enable row level security;
create policy "budgets: owner full access" on public.budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists budgets_user_id_idx on public.budgets (user_id);

-- ────────────────────────────────────────────────────────────
-- expenses
-- ────────────────────────────────────────────────────────────
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  budget_id uuid references public.budgets (id) on delete set null,
  category_id text not null references public.categories (id),
  amount numeric(14, 2) not null check (amount >= 0),
  currency text not null default 'INR',
  description text,
  merchant text,
  expense_date date not null default current_date,
  source text not null default 'manual' check (source in ('manual', 'voice', 'receipt', 'penny')),
  receipt_url text,
  raw_input text,
  created_at timestamptz not null default now()
);

alter table public.expenses enable row level security;
create policy "expenses: owner full access" on public.expenses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists expenses_user_id_idx on public.expenses (user_id);
create index if not exists expenses_budget_id_idx on public.expenses (budget_id);
create index if not exists expenses_category_id_idx on public.expenses (category_id);
create index if not exists expenses_date_idx on public.expenses (expense_date);

-- ────────────────────────────────────────────────────────────
-- chat_messages: Penny conversation history
-- ────────────────────────────────────────────────────────────
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.chat_messages enable row level security;
create policy "chat_messages: owner full access" on public.chat_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists chat_messages_user_id_idx on public.chat_messages (user_id, created_at);

-- ────────────────────────────────────────────────────────────
-- storage bucket for receipt images
-- ────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy "receipts: owner can read own folder"
  on storage.objects for select
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "receipts: owner can upload to own folder"
  on storage.objects for insert
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "receipts: owner can delete own"
  on storage.objects for delete
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
