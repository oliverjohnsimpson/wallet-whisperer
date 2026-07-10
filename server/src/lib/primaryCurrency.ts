import type { SupabaseClient } from "@supabase/supabase-js";

/** The currency the user's monthly income/expense/savings rollup is computed in. */
export async function getPrimaryCurrency(db: SupabaseClient, userId: string): Promise<string> {
  const { data } = await db.from("profiles").select("primary_currency").eq("id", userId).single();
  return data?.primary_currency ?? "INR";
}
