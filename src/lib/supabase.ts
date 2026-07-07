import { createClient as _create } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

let _client: ReturnType<typeof _create> | null = null;

export function getSupabase() {
  if (!_client) {
    _client = _create(URL, KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
  }
  return _client;
}

// Compat export
export const supabase = typeof window !== "undefined" ? getSupabase() : null as unknown as ReturnType<typeof _create>;
