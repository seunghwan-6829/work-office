"use client";

import { CSSProperties, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  createSampleProject,
  getCurrentSession,
  loadProjects,
  saveProjects,
  signInWithEmail,
  signOut,
  signUpWithEmail,
  subscribeToAuthChanges,
  type AgentRecord,
  type ProjectRecord,
  type ReportRecord
} from "../lib/app-data";
import { getMissingPublicEnvKeys, getSupabaseBrowserConfig, getSupabaseProjectRefFromUrl } from "../lib/env";
import { mockApiKeyFields, quickBriefTemplates } from "../lib/mock-data";

type AuthMode = "signin" | "signup";
type CeoFacing = "front" | "side" | "back";
type AgentFacing = "front" | "side";

type MapSpot = {
  left: string;
  top: string;
  facing: AgentFacing;
};

const ceoSpritePaths: Record<CeoFacing, string> = {
  front: "/sprites/ceo-front.png",
  side: "/sprites/ceo-side.png",
  back: "/sprites/ceo-back.png"
};

const workingSpots: Record<string, MapSpot> = {
  "agent-order": { left: "8.5%", top: "17%", facing: "front" },
  "agent-source": { left: "26.4%", top: "17%", facing: "side" },
  "agent-ocr": { left: "43.9%", top: "17.2%", facing: "front" },
  "agent-copy": { left: "61.5%", top: "17%", facing: "front" },
  "agent-publish": { left: "18.5%", top: "66.3%", facing: "front" },
  "agent-manager": { left: "35.6%", top: "66.5%", facing: "side" }
};

const idleSpots: Record<string, MapSpot> = {
  "agent-order": { left: "9.5%", top: "41.5%", facing: "side" },
  "agent-source": { left: "24.5%", top: "41.4%", facing: "side" },
  "agent-ocr": { left: "39.8%", top: "41.3%", facing: "front" },
  "agent-copy": { left: "18.7%", top: "82.8%", facing: "side" },
  "agent-publish": { left: "10.7%", top: "83.2%", facing: "side" },
  "agent-manager": { left: "39.2%", top: "82.8%", facing: "front" }
};

const ceoQueueSpots: MapSpot[] = [
  { left: "78.7%", top: "41.8%", facing: "side" },
  { left: "84.2%", top: "41.8%", facing: "side" },
  { left: "89.3%", top: "41.8%", facing: "side" }
];

const officeLabels = [
  { title: "주문 확인실", left: "3.4%", top: "5.7%" },
  { title: "도매 수집실", left: "20.9%", top: "5.7%" },
  { title: "OCR 작업실", left: "38.6%", top: "5.7%" },
  { title: "상품명 작업실", left: "56.3%", top: "5.7%" },
  { title: "썸네일 대기실", left: "3.4%", top: "54.5%" },
  { title: "업로드 준비실", left: "20.7%", top: "54.5%" },
  { title: "중간 관리자실", left: "38.1%", top: "54.5%" },
  { title: "CEO실", left: "73.5%", top: "54.4%" }
];

const mapInstructions = [
  "담당자를 클릭하면 바로 브리핑 창이 열립니다.",
  "작업 시작을 누르면 해당 인원은 지정된 방에서 일하는 상태로 보입니다.",
  "완료 보고를 누르면 CEO실 앞 대기열로 이동합니다."
];

function mapAuthError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) return "이메일 또는 비밀번호가 올바르지 않습니다.";
  if (normalized.includes("email not confirmed")) return "이메일 인증이 완료되지 않았습니다.";
  if (normalized.includes("user already registered")) return "이미 가입된 이메일입니다.";
  if (normalized.includes("signup is disabled")) return "Supabase에서 이메일 회원가입이 비활성화되어 있습니다.";
  if (normalized.includes("database error saving new user")) return "회원가입 저장 중 오류가 발생했습니다.";
  if (normalized.includes("invalid api key")) return "Supabase 공개 키 설정을 다시 확인해 주세요.";
  return message;
}

function getAgentCardStyle(accent: string) {
  return { "--agent-accent": accent } as CSSProperties;
}

function getAgentSpot(project: ProjectRecord, agent: AgentRecord) {
  if (agent.status === "working") {
    return workingSpots[agent.id] ?? idleSpots[agent.id] ?? { left: "10%", top: "40%", facing: "front" };
  }

  if (agent.status === "waiting_ceo") {
    const waitingAgents = project.agents.filter((item) => item.status === "waiting_ceo");
    const queueIndex = waitingAgents.findIndex((item) => item.id === agent.id);
    return ceoQueueSpots[Math.min(Math.max(queueIndex, 0), ceoQueueSpots.length - 1)] ?? ceoQueueSpots[0];
  }

  return idleSpots[agent.id] ?? { left: "10%", top: "40%", facing: "front" };
}

function buildQuickReport(agent: AgentRecord, brief: string) {
  const trimmed = brief.trim();
  if (!trimmed) return `${agent.name}이 업무를 마쳤지만 요약 없이 도착했습니다.`;
  return `${agent.name}이 '${trimmed.slice(0, 30)}' 업무를 마치고 결과를 보고하려고 CEO실 앞에서 대기 중입니다.`;
}

export default function DashboardApp() {
  const missingEnvKeys = getMissingPublicEnvKeys();
  const supabaseConfig = getSupabaseBrowserConfig();
  const projectRef = getSupabaseProjectRefFromUrl(supabaseConfig.url);
  const supabaseReady = missingEnvKeys.length === 0;

  const [session, setSession] = useState<Session | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [briefDraft, setBriefDraft] = useState("");
  const [briefMessage, setBriefMessage] = useState("");
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );
  const selectedAgent = useMemo(
    () => selectedProject?.agents.find((agent) => agent.id === selectedAgentId) ?? null,
    [selectedProject, selectedAgentId]
  );
  const waitingReports = useMemo(
    () => selectedProject?.reports.filter((report) => report.status === "waiting") ?? [],
    [selectedProject]
  );
  const providerStorageKey = session?.user.email ? `empire-provider-keys:${session.user.email.toLowerCase()}` : null;
  const ceoFacing: CeoFacing = waitingReports.length > 0 ? "side" : "front";
  const mapAgents = useMemo(
    () =>
      selectedProject
        ? selectedProject.agents.map((agent) => ({
            agent,
            spot: getAgentSpot(selectedProject, agent)
          }))
        : [],
    [selectedProject]
  );

  useEffect(() => {
    let mounted = true;

    getCurrentSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session ?? null);
        setLoadingAuth(false);
      })
      .catch(() => {
        if (!mounted) return;
        setLoadingAuth(false);
      });

    const { data } = subscribeToAuthChanges(async (_event, nextSession) => {
      setSession(nextSession);
      setLoadingAuth(false);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const email = session?.user.email;
    if (!email) {
      setProjects([]);
      setSelectedProjectId(null);
      return;
    }

    const stored = loadProjects(email);
    const nextProjects = stored.length > 0 ? stored : [createSampleProject()];
    setProjects(nextProjects);
    setSelectedProjectId((current) => current ?? nextProjects[0]?.id ?? null);

    if (stored.length === 0) {
      saveProjects(email, nextProjects);
    }
  }, [session?.user.email]);

  useEffect(() => {
    if (!providerStorageKey || typeof window === "undefined") {
      setApiKeys({});
      return;
    }

    const raw = window.localStorage.getItem(providerStorageKey);
    if (!raw) {
      setApiKeys({});
      return;
    }

    try {
      setApiKeys(JSON.parse(raw) as Record<string, string>);
    } catch {
      setApiKeys({});
    }
  }, [providerStorageKey]);

  useEffect(() => {
    if (!providerStorageKey || typeof window === "undefined") return;
    window.localStorage.setItem(providerStorageKey, JSON.stringify(apiKeys));
  }, [apiKeys, providerStorageKey]);

  useEffect(() => {
    if (!selectedAgent) {
      setBriefDraft("");
      setBriefMessage("");
      return;
    }

    setBriefDraft(selectedAgent.lastBrief);
    setBriefMessage("");
  }, [selectedAgent]);

  function persistProjects(nextProjects: ProjectRecord[]) {
    const email = session?.user.email;
    if (!email) return;
    setProjects(nextProjects);
    saveProjects(email, nextProjects);
  }

  function updateProject(mutator: (project: ProjectRecord) => ProjectRecord) {
    if (!selectedProject) return;

    const nextProjects = projects.map((project) =>
      project.id === selectedProject.id ? { ...mutator(project), updatedAt: new Date().toISOString() } : project
    );
    persistProjects(nextProjects);
  }

  async function handleAuthSubmit() {
    if (!supabaseReady) {
      setAuthMessage(`Supabase 설정을 먼저 확인해 주세요: ${missingEnvKeys.join(", ")}`);
      return;
    }

    const email = authEmail.trim();
    const password = authPassword.trim();

    if (!email || !password) {
      setAuthMessage("이메일과 비밀번호를 모두 입력해 주세요.");
      return;
    }

    const action = authMode === "signin" ? signInWithEmail : signUpWithEmail;
    const { error } = await action(email, password);

    if (error) {
      setAuthMessage(mapAuthError(error.message));
      return;
    }

    setAuthMessage(authMode === "signin" ? "로그인되었습니다." : "회원가입 요청이 완료되었습니다.");
  }

  function startAgentTask() {
    if (!selectedProject || !selectedAgent) return;

    const brief = briefDraft.trim();
    if (!brief) {
      setBriefMessage("짧은 업무 브리핑을 입력해 주세요.");
      return;
    }

    if (selectedAgent.status === "waiting_ceo") {
      setBriefMessage("이 담당자는 아직 CEO 보고 대기 중입니다.");
      return;
    }

    const taskId = crypto.randomUUID();
    const now = new Date().toISOString();

    updateProject((project) => ({
      ...project,
      tasks: [
        {
          id: taskId,
          title: `${selectedAgent.role} 업무`,
          brief,
          assignedAgentId: selectedAgent.id,
          roomId: selectedAgent.homeRoomId,
          status: "working",
          createdAt: now,
          updatedAt: now
        },
        ...project.tasks
      ],
      agents: project.agents.map((agent) =>
        agent.id === selectedAgent.id
          ? { ...agent, status: "working", currentTaskId: taskId, currentRoomId: agent.homeRoomId, lastBrief: brief }
          : agent
      ),
      managerMemo: `${selectedAgent.name}이(가) ${selectedAgent.role} 업무를 시작했습니다.`
    }));

    setBriefMessage("알겠습니다. 바로 업무에 들어가겠습니다.");
  }

  function moveAgentToReport() {
    if (!selectedProject || !selectedAgent || selectedAgent.status !== "working" || !selectedAgent.currentTaskId) {
      setBriefMessage("현재 진행 중인 업무가 있을 때만 완료 보고로 넘길 수 있습니다.");
      return;
    }

    const taskId = selectedAgent.currentTaskId;
    const now = new Date().toISOString();

    updateProject((project) => ({
      ...project,
      tasks: project.tasks.map((task) => (task.id === taskId ? { ...task, status: "waiting_report", updatedAt: now } : task)),
      reports: [
        {
          id: crypto.randomUUID(),
          taskId,
          agentId: selectedAgent.id,
          summary: buildQuickReport(selectedAgent, briefDraft || selectedAgent.lastBrief),
          status: "waiting",
          createdAt: now
        },
        ...project.reports
      ],
      agents: project.agents.map((agent) =>
        agent.id === selectedAgent.id ? { ...agent, status: "waiting_ceo", currentRoomId: "room-ceo" } : agent
      ),
      managerMemo: `${selectedAgent.name}이(가) CEO실 앞에서 보고 대기 중입니다.`
    }));

    setBriefMessage("업무 완료했습니다. CEO실 앞에서 보고 대기하겠습니다.");
  }

  function reviewReport(report: ReportRecord) {
    if (!selectedProject) return;

    updateProject((project) => ({
      ...project,
      reports: project.reports.map((item) => (item.id === report.id ? { ...item, status: "reviewed" } : item)),
      tasks: project.tasks.map((task) =>
        task.id === report.taskId ? { ...task, status: "reported", updatedAt: new Date().toISOString() } : task
      ),
      agents: project.agents.map((agent) =>
        agent.id === report.agentId
          ? { ...agent, status: "idle", currentRoomId: agent.homeRoomId, currentTaskId: null }
          : agent
      ),
      managerMemo: "CEO가 보고를 받았고 담당자는 원래 자리로 복귀했습니다."
    }));

    setSelectedAgentId(report.agentId);
    setBriefMessage("보고 확인 감사합니다. 자리로 복귀하겠습니다.");
  }

  if (loadingAuth) {
    return <main className="app-loading">오피스를 불러오는 중입니다...</main>;
  }

  if (!session) {
    return (
      <main className="auth-page">
        <section className="auth-hero">
          <p className="auth-kicker">WORK OFFICE</p>
          <h1>
            <span className="hero-title-line">복도와 방이 보이는</span>
            <span className="hero-title-line">AI 오피스 웹 시뮬레이터</span>
          </h1>
          <p>로그인 후에는 맵 전체만 보이도록 구성됩니다. 캐릭터는 맵 안에서 클릭해서 상호작용합니다.</p>
        </section>

        <section className="auth-card panel-surface">
          <div className="auth-tabs">
            <button className={authMode === "signin" ? "tab active" : "tab"} onClick={() => setAuthMode("signin")}>
              로그인
            </button>
            <button className={authMode === "signup" ? "tab active" : "tab"} onClick={() => setAuthMode("signup")}>
              회원가입
            </button>
          </div>

          <div className="auth-form">
            <label>
              <span>이메일</span>
              <input type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} />
            </label>
            <label>
              <span>비밀번호</span>
              <input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} />
            </label>
            <button className="button button-primary button-block" onClick={handleAuthSubmit}>
              {authMode === "signin" ? "로그인" : "계정 만들기"}
            </button>
            <p className="auth-message">{authMessage || "Supabase 로그인으로 바로 시작할 수 있습니다."}</p>
            <div className="auth-meta slim-meta">
              <span>{supabaseReady ? `${projectRef || "Supabase"} 연결 준비 완료` : missingEnvKeys.join(", ")}</span>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="office-fullscreen-shell">
      <section className="office-fullscreen-stage">
        <div className="office-background-layer" />

        <div className="office-map-labels">
          {officeLabels.map((label) => (
            <span
              className="office-map-label"
              key={label.title}
              style={{ left: label.left, top: label.top } as CSSProperties}
            >
              {label.title}
            </span>
          ))}
        </div>

        <div className="office-hud office-hud-left">
          <p className="office-hud-kicker">운영실</p>
          <strong>{selectedProject?.name ?? "Commerce Empire"}</strong>
          <span>{selectedProject?.managerMemo ?? "대표가 첫 지시를 기다리고 있습니다."}</span>
          <div className="office-hud-actions">
            <button className="button button-secondary" onClick={() => setIsSettingsOpen(true)}>
              API 설정
            </button>
            <button className="button" onClick={() => void signOut()}>
              로그아웃
            </button>
          </div>
        </div>

        <div className="office-hud office-hud-right">
          <div className="office-stat-box">
            <span>CEO실 대기</span>
            <strong>{waitingReports.length}</strong>
          </div>
          <div className="office-stat-box">
            <span>작업 중</span>
            <strong>{selectedProject?.agents.filter((agent) => agent.status === "working").length ?? 0}</strong>
          </div>
          <div className="office-stat-box">
            <span>API 연결</span>
            <strong>{Object.values(apiKeys).filter(Boolean).length}</strong>
          </div>
        </div>

        <div className="office-help-bubble">
          {mapInstructions.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>

        <div
          className={`office-ceo-sprite office-ceo-sprite-${ceoFacing}`}
          style={{ "--ceo-sprite-url": `url('${ceoSpritePaths[ceoFacing]}')` } as CSSProperties}
        />

        {mapAgents.map(({ agent, spot }) => (
          <button
            className={`office-walker office-walker-large status-${agent.status} facing-${spot.facing}`}
            key={agent.id}
            onClick={() => setSelectedAgentId(agent.id)}
            style={
              {
                "--walker-left": spot.left,
                "--walker-top": spot.top,
                "--agent-accent": agent.accent
              } as CSSProperties
            }
          >
            <span className={`walker-hair ${agent.hairClass}`} />
            <span className="walker-face" />
            <span className={`walker-body ${agent.outfitClass}`} />
            <span className="walker-shadow" />
            <span className="walker-name">{agent.name}</span>
          </button>
        ))}

        {selectedAgent ? (
          <div className="office-interaction-panel panel-surface">
            <div className="office-interaction-header">
              <div>
                <p className="section-kicker">Agent Interaction</p>
                <h2>{selectedAgent.name}</h2>
              </div>
              <button className="button button-secondary" onClick={() => setSelectedAgentId(null)}>
                닫기
              </button>
            </div>

            <div className="office-interaction-meta">
              <span className={`status-pill status-${selectedAgent.status}`}>{selectedAgent.status}</span>
              <span>{selectedAgent.role}</span>
              <span>{`${selectedAgent.provider} / ${selectedAgent.model}`}</span>
            </div>

            <div className="brief-template-row">
              {quickBriefTemplates.map((template) => (
                <button className="button button-secondary brief-template-button" key={template} onClick={() => setBriefDraft(template)}>
                  {template}
                </button>
              ))}
            </div>

            <label className="settings-block">
              <span>짧은 업무 브리핑</span>
              <textarea
                className="editor-textarea agent-brief-textarea"
                value={briefDraft}
                onChange={(event) => setBriefDraft(event.target.value)}
                placeholder="오늘 처리할 업무를 한두 문장으로 지시해 주세요."
              />
            </label>

            <div className="agent-modal-actions">
              <button className="button button-primary" onClick={startAgentTask}>
                업무 시작
              </button>
              <button className="button button-secondary" onClick={moveAgentToReport}>
                완료 보고
              </button>
            </div>

            <p className="auth-message">{briefMessage || selectedAgent.specialty}</p>
          </div>
        ) : null}

        {waitingReports.length > 0 ? (
          <div className="office-report-stack">
            {waitingReports.map((report) => {
              const agent = selectedProject?.agents.find((item) => item.id === report.agentId);
              return (
                <button className="office-report-chip" key={report.id} onClick={() => reviewReport(report)}>
                  <strong>{agent?.name ?? "담당자"}</strong>
                  <span>보고 받기</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </section>

      {isSettingsOpen ? (
        <div className="modal-backdrop" onClick={() => setIsSettingsOpen(false)}>
          <div className="modal-panel panel-surface" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="section-kicker">API Settings</p>
                <h2>캐릭터용 API 연결</h2>
              </div>
              <button className="button button-secondary" onClick={() => setIsSettingsOpen(false)}>
                닫기
              </button>
            </div>
            <div className="settings-grid single-column-grid">
              {mockApiKeyFields.map((field) => (
                <label className="settings-block" key={field.id}>
                  <span>{field.label}</span>
                  <input
                    type="password"
                    placeholder={field.placeholder}
                    value={apiKeys[field.id] ?? ""}
                    onChange={(event) => setApiKeys((current) => ({ ...current, [field.id]: event.target.value }))}
                  />
                  <small>{field.help}</small>
                </label>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
