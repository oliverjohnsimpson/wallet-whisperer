-- Wallet Whisperer: richer user profiles (name, phone, photo, AI avatar) and
-- session-scoped Penny chat history. Run in the Supabase SQL editor after 0003.

-- ────────────────────────────────────────────────────────────
-- profiles: first/last name, phone, uploaded photo
-- (avatar_url already exists from 0001 and now holds the *selected* avatar —
--  either the uploaded photo or an AI-generated one.)
-- ────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists photo_url text;

-- ────────────────────────────────────────────────────────────
-- storage bucket for profile photos and generated avatars.
-- Public so the chosen avatar can be shown across the app via a plain URL.
-- ────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars: public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars: owner can upload to own folder"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars: owner can update own"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars: owner can delete own"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ────────────────────────────────────────────────────────────
-- chat_messages: group a login's conversation into a session so Penny can show
-- starter prompts for a fresh session but keep the full history in the database.
-- ────────────────────────────────────────────────────────────
alter table public.chat_messages add column if not exists session_id text;

create index if not exists chat_messages_session_idx
  on public.chat_messages (user_id, session_id, created_at);
