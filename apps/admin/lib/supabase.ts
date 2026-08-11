import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | undefined;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient !== undefined) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (url === undefined || key === undefined) {
    throw new Error('Admin authentication environment is not configured.');
  }
  browserClient = createClient(url, key, {
    auth: { autoRefreshToken: true, detectSessionInUrl: true, persistSession: true },
  });
  return browserClient;
}
