import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserConfig } from "../env";

let browserClient: SupabaseClient | null = null;

export function createSupabaseBrowserClient() {
  if (browserClient) {
    return browserClient;
  }

  const { url, anonKey } = getSupabaseBrowserConfig();

  if (!url || !anonKey) {
    throw new Error("Supabase public environment variables are missing.");
  }

  browserClient = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true
    }
  });

  return browserClient;
}