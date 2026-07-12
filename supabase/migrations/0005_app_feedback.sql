-- Wallet Whisperer: in-app star feedback. Run in the Supabase SQL editor after 0004.

create table if not exists public.app_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  reasons text[] not null default '{}',
  comment text,
  -- Whether the user chose to share their rating on an app store (item 12).
  shared_to_store boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.app_feedback enable row level security;

create policy "app_feedback: owner can insert own" on public.app_feedback
  for insert with check (auth.uid() = user_id);
create policy "app_feedback: owner can read own" on public.app_feedback
  for select using (auth.uid() = user_id);
create policy "app_feedback: owner can update own" on public.app_feedback
  for update using (auth.uid() = user_id);

create index if not exists app_feedback_user_idx on public.app_feedback (user_id, created_at);
