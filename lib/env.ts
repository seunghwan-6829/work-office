function decodeJwtPayload(token: string) {
  try {
    const parts = token.split(".");

    if (parts.length < 2) {
      return null;
    }

    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const decoded =
      typeof window === "undefined" ? Buffer.from(padded, "base64").toString("utf8") : window.atob(padded);

    return JSON.parse(decoded) as { ref?: string };
  } catch {
    return null;
  }
}

function readPublicKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
}

function inferProjectRef() {
  const key = readPublicKey();
  return key ? decodeJwtPayload(key)?.ref ?? "" : "";
}

function readUrl() {
  const directUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (directUrl) {
    return directUrl;
  }

  const projectRef = inferProjectRef();
  return projectRef ? `https://${projectRef}.supabase.co` : "";
}

export function getMissingPublicEnvKeys() {
  const missing: string[] = [];

  if (!readUrl()) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!readPublicKey()) {
    missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return missing;
}

export function getSupabaseBrowserConfig() {
  const url = readUrl();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const publicKey = publishableKey || anonKey;

  return {
    url,
    anonKey,
    publishableKey,
    publicKey,
    projectRef: getSupabaseProjectRefFromUrl(url) || inferProjectRef()
  };
}

export function getSupabaseProjectRefFromUrl(url: string) {
  try {
    return new URL(url).hostname.split(".")[0] ?? "";
  } catch {
    return "";
  }
}
