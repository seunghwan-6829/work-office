function decodeJwtPayload(token: string) {
  try {
    const parts = token.split(".");

    if (parts.length < 2) {
      return null;
    }

    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const decoded = typeof window === "undefined"
      ? Buffer.from(padded, "base64").toString("utf8")
      : window.atob(padded);

    return JSON.parse(decoded) as { ref?: string };
  } catch {
    return null;
  }
}

function inferProjectRef() {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  return decodeJwtPayload(anonKey)?.ref ?? "";
}

const projectRef = inferProjectRef();
const resolvedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? (projectRef ? `https://${projectRef}.supabase.co` : "");
const resolvedPublicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export function getMissingPublicEnvKeys() {
  const missing: string[] = [];

  if (!resolvedUrl) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!resolvedPublicKey) {
    missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }

  return missing;
}

export function getSupabaseBrowserConfig() {
  return {
    url: resolvedUrl,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
    publicKey: resolvedPublicKey,
    projectRef
  };
}

export function getSupabaseProjectRefFromUrl(url: string) {
  try {
    return new URL(url).hostname.split(".")[0] ?? "";
  } catch {
    return "";
  }
}