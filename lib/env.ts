const FALLBACK_SUPABASE_PROJECT_REF = "nbulrhagghdaqikfhrdok";
const FALLBACK_SUPABASE_URL = `https://${FALLBACK_SUPABASE_PROJECT_REF}.supabase.co`;
const FALLBACK_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5idWxyaGFnaGRhcWlrZmhyZG9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwODI3MTYsImV4cCI6MjA4ODY1ODcxNn0.FjBg16NoLr0j6g7-PPPzo2QfR_K43EmXqYPDeLeU2J4";
const FALLBACK_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_NMcG_P0Nq6EXnodlg5a9xg_d4pHPGPp";

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
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? FALLBACK_SUPABASE_ANON_KEY;
  return decodeJwtPayload(anonKey)?.ref ?? FALLBACK_SUPABASE_PROJECT_REF;
}

const projectRef = inferProjectRef();
const resolvedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? (projectRef ? `https://${projectRef}.supabase.co` : FALLBACK_SUPABASE_URL);
const resolvedAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? FALLBACK_SUPABASE_ANON_KEY;
const resolvedPublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? FALLBACK_SUPABASE_PUBLISHABLE_KEY;
const resolvedPublicKey = resolvedAnonKey || resolvedPublishableKey;

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
    anonKey: resolvedAnonKey,
    publishableKey: resolvedPublishableKey,
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