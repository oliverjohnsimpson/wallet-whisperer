-- Wallet Whisperer: subscription tiers (Free / Standard / Professional)
-- Run in the Supabase SQL editor after 0002.

alter table public.profiles
  add column if not exists subscription_tier text not null default 'free'
  check (subscription_tier in ('free', 'standard', 'professional'));

-- Razorpay-backed subscription records. Written by the server (service role) from
-- the billing webhook; users may read their own.
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tier text not null check (tier in ('standard', 'professional')),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'cancelled', 'past_due', 'halted')),
  provider text not null default 'razorpay',
  provider_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;
create policy "subscriptions: owner can read own" on public.subscriptions
  for select using (auth.uid() = user_id);

create index if not exists subscriptions_user_id_idx on public.subscriptions (user_id);
create index if not exists subscriptions_provider_idx on public.subscriptions (provider_subscription_id);
