import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { createSupabaseBrowserClient, tryCreateSupabaseBrowserClient } from "./supabase/client";

export interface ProjectRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  srtText: string;
}

function authCallbackUrl() {
  return typeof window !== "undefined" ? window.location.origin : undefined;
}

export async function signInWithEmail(email: string, password: string) {
  const supabase = createSupabaseBrowserClient();
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithEmail(email: string, password: string) {
  const supabase = createSupabaseBrowserClient();
  return supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: authCallbackUrl()
    }
  });
}

export async function signOut() {
  const supabase = tryCreateSupabaseBrowserClient();

  if (!supabase) {
    return { error: new Error("Supabase client is not available.") };
  }

  return supabase.auth.signOut();
}

export async function getCurrentSession() {
  const supabase = tryCreateSupabaseBrowserClient();

  if (!supabase) {
    return {
      data: {
        session: null
      },
      error: null
    };
  }

  return supabase.auth.getSession();
}

export function subscribeToAuthChanges(callback: (event: AuthChangeEvent, session: Session | null) => Promise<void>) {
  const supabase = tryCreateSupabaseBrowserClient();

  if (!supabase) {
    return {
      data: {
        subscription: {
          unsubscribe() {}
        }
      }
    };
  }

  return supabase.auth.onAuthStateChange(callback);
}

function projectStorageKey(email: string) {
  return `premiere-projects:${email.toLowerCase()}`;
}

function normalizeProjectName(name: string, index: number) {
  if (!name) {
    return `프로젝트 ${index + 1}`;
  }

  if (/^new project\s*\d*$/i.test(name.trim()) || /^sample project$/i.test(name.trim())) {
    return `프로젝트 ${index + 1}`;
  }

  return name;
}

export function loadProjects(email: string) {
  if (typeof window === "undefined") {
    return [] as ProjectRecord[];
  }

  const raw = window.localStorage.getItem(projectStorageKey(email));

  if (!raw) {
    return [] as ProjectRecord[];
  }

  try {
    return (JSON.parse(raw) as ProjectRecord[]).map((project, index) => ({
      ...project,
      name: normalizeProjectName(project.name, index)
    }));
  } catch {
    return [] as ProjectRecord[];
  }
}

export function saveProjects(email: string, projects: ProjectRecord[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(projectStorageKey(email), JSON.stringify(projects));
}

export function createEmptyProject(name: string): ProjectRecord {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    srtText: ""
  };
}

export function createSampleProject() {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: "프로젝트 샘플",
    createdAt: now,
    updatedAt: now,
    srtText: `1\n00:00:02,000 --> 00:00:05,200\nThis feature can reduce editing time significantly.\n\n2\n00:00:05,800 --> 00:00:09,000\nAn illustration style works well for the example screen.\n\n3\n00:00:09,300 --> 00:00:13,000\nA short motion clip explains the final result more clearly.`
  } satisfies ProjectRecord;
}
