import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserConfig } from "../env";

let browserClient: SupabaseClient | null = null;

export function createSupabaseBrowserClient() {
  if (browserClient) {
    return browserClient;
  }

  const { url, publicKey } = getSupabaseBrowserConfig();

  if (!url || !publicKey) {
    throw new Error("Supabase public environment variables are missing.");
  }

  browserClient = createClient(url, publicKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true
    }
  });

  return browserClient;
}

export function tryCreateSupabaseBrowserClient() {
  try {
    return createSupabaseBrowserClient();
  } catch {
    return null;
  }
}