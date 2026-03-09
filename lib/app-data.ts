import { createSupabaseBrowserClient } from "./supabase/client";

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
  const supabase = createSupabaseBrowserClient();
  return supabase.auth.signOut();
}

export async function getCurrentSession() {
  const supabase = createSupabaseBrowserClient();
  return supabase.auth.getSession();
}

export function subscribeToAuthChanges(callback: Parameters<ReturnType<typeof createSupabaseBrowserClient>["auth"]["onAuthStateChange"]>[0]) {
  const supabase = createSupabaseBrowserClient();
  return supabase.auth.onAuthStateChange(callback);
}

function projectStorageKey(email: string) {
  return `premiere-projects:${email.toLowerCase()}`;
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
    return JSON.parse(raw) as ProjectRecord[];
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
    name: "샘플 프로젝트",
    createdAt: now,
    updatedAt: now,
    srtText: `1\n00:00:02,000 --> 00:00:05,200\n이 기능을 넣으면 편집 시간이 크게 줄어듭니다.\n\n2\n00:00:05,800 --> 00:00:09,000\n예시 화면은 일러스트 스타일로 보여주는 게 좋습니다.\n\n3\n00:00:09,300 --> 00:00:13,000\n실제 결과는 짧은 모션 클립으로 보여주는 게 더 강합니다.`
  } satisfies ProjectRecord;
}