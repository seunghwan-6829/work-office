import { createClient } from "@supabase/supabase-js";
import { getSupabaseBrowserConfig } from "../env";

const { url, anonKey } = getSupabaseBrowserConfig();

export function createSupabaseBrowserClient() {
  if (!url || !anonKey) {
    throw new Error("Supabase public environment variables are missing.");
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true
    }
  });
}