import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env.js";

/** Service-role client — bypasses RLS. Use only for auth token verification and storage writes. */
export const supabaseAdmin: SupabaseClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Per-request client scoped to the caller's JWT, so RLS policies (auth.uid()) apply. */
export function supabaseAsUser(accessToken: string): SupabaseClient {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
