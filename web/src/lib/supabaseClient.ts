import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anonKey) {
  console.warn(
    "[Wallet Whisperer] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy web/.env.example to web/.env and fill it in."
  );
}

export const supabase = createClient(url, anonKey);
