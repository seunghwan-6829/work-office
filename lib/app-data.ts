import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { createSupabaseBrowserClient, tryCreateSupabaseBrowserClient } from "./supabase/client";
import { agentSeeds, officeRoomSeeds } from "./mock-data";

export type AgentStatus = "idle" | "working" | "waiting_ceo";
export type TaskStatus = "queued" | "working" | "waiting_report" | "reported";
export type ReportStatus = "waiting" | "reviewed";

export interface RoomRecord {
  id: string;
  title: string;
  copy: string;
  zone: "ops" | "exec";
}

export interface AgentRecord {
  id: string;
  name: string;
  role: string;
  tone: string;
  specialty: string;
  provider: string;
  model: string;
  accent: string;
  hairClass: string;
  outfitClass: string;
  homeRoomId: string;
  currentRoomId: string;
  status: AgentStatus;
  currentTaskId: string | null;
  lastBrief: string;
}

export interface TaskRecord {
  id: string;
  title: string;
  brief: string;
  assignedAgentId: string;
  roomId: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ReportRecord {
  id: string;
  taskId: string;
  agentId: string;
  summary: string;
  status: ReportStatus;
  createdAt: string;
}

export interface ProjectRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  companyName: string;
  ceoName: string;
  rooms: RoomRecord[];
  agents: AgentRecord[];
  tasks: TaskRecord[];
  reports: ReportRecord[];
  managerMemo: string;
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
  return `commerce-empire-projects:${email.toLowerCase()}`;
}

function nowIso() {
  return new Date().toISOString();
}

function createSeedAgents(): AgentRecord[] {
  return agentSeeds.map((agent) => ({
    ...agent,
    currentRoomId: agent.homeRoomId,
    status: "idle",
    currentTaskId: null,
    lastBrief: ""
  }));
}

function createSeedRooms(): RoomRecord[] {
  return officeRoomSeeds.map((room) => ({ ...room }));
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
  const now = nowIso();

  return {
    id: crypto.randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    companyName: "Commerce Empire",
    ceoName: "대표",
    rooms: createSeedRooms(),
    agents: createSeedAgents(),
    tasks: [],
    reports: [],
    managerMemo: "중간 관리자가 아직 첫 업무를 기다리는 중입니다."
  };
}

export function createSampleProject(): ProjectRecord {
  const project = createEmptyProject("커머스 운영본부");
  const now = nowIso();

  const firstTaskId = crypto.randomUUID();
  const secondTaskId = crypto.randomUUID();

  project.tasks = [
    {
      id: firstTaskId,
      title: "신규 주문 누락 점검",
      brief: "메일함과 발주서를 비교해 누락 주문을 찾아줘.",
      assignedAgentId: "agent-order",
      roomId: "room-order",
      status: "working",
      createdAt: now,
      updatedAt: now
    },
    {
      id: secondTaskId,
      title: "OCR 검수 결과 보고",
      brief: "이미지 옵션 OCR 결과를 검수하고 대표 오차만 요약해줘.",
      assignedAgentId: "agent-ocr",
      roomId: "room-ocr",
      status: "waiting_report",
      createdAt: now,
      updatedAt: now
    }
  ];

  project.agents = project.agents.map((agent) => {
    if (agent.id === "agent-order") {
      return {
        ...agent,
        status: "working",
        currentTaskId: firstTaskId,
        lastBrief: "메일함과 발주서를 비교해 누락 주문을 찾아줘."
      };
    }

    if (agent.id === "agent-ocr") {
      return {
        ...agent,
        status: "waiting_ceo",
        currentTaskId: secondTaskId,
        currentRoomId: "room-ceo",
        lastBrief: "이미지 옵션 OCR 결과를 검수하고 대표 오차만 요약해줘."
      };
    }

    return agent;
  });

  project.reports = [
    {
      id: crypto.randomUUID(),
      taskId: secondTaskId,
      agentId: "agent-ocr",
      summary: "OCR 오인식 8건을 추려냈고, 옵션명 표기 규칙을 통일하면 재발을 줄일 수 있습니다.",
      status: "waiting",
      createdAt: now
    }
  ];

  project.managerMemo =
    "현재 병목은 OCR 검수실입니다. 보고 대기 1건이 CEO 승인 전까지 멈춰 있으니, 먼저 보고를 받아 흐름을 다시 열어주는 것이 좋습니다.";

  return project;
}
