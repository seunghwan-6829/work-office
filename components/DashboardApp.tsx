"use client";

import { CSSProperties, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  createEmptyProject,
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
import { mockApiKeyFields, officeRoomSeeds, quickBriefTemplates } from "../lib/mock-data";

type AuthMode = "signin" | "signup";

const T = {
  loading: "오피스를 불러오는 중입니다...",
  appKicker: "COMMERCE EMPIRE",
  heroLine1: "캐릭터가 움직이는",
  heroLine2: "AI 오피스 운영실",
  authCopy:
    "담당자를 클릭해 짧게 업무를 브리핑하고, 각자 방에서 작업시킨 뒤, 완료되면 CEO실로 와서 보고받는 흐름을 웹으로 먼저 만듭니다.",
  authHint: "Supabase 이메일 로그인으로 바로 시작할 수 있습니다.",
  signin: "로그인",
  signup: "회원가입",
  createAccount: "계정 만들기",
  email: "이메일",
  password: "비밀번호",
  workspace: "운영실",
  home: "개요",
  admin: "설정",
  projects: "회사",
  noProjects: "회사 데이터가 없습니다.",
  newProject: "새 회사",
  selectedProject: "선택한 회사",
  currentUser: "현재 사용자",
  connectionState: "연결 상태",
  ready: "준비 완료",
  checkNeeded: "설정 필요",
  logout: "로그아웃",
  settings: "API 설정",
  save: "저장",
  close: "닫기"
} as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function mapAuthError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "이메일 또는 비밀번호가 올바르지 않습니다.";
  }

  if (normalized.includes("email not confirmed")) {
    return "이메일 인증이 완료되지 않았습니다. 메일함을 확인해 주세요.";
  }

  if (normalized.includes("user already registered")) {
    return "이미 가입된 이메일입니다. 로그인으로 진행해 주세요.";
  }

  if (normalized.includes("email address") && normalized.includes("invalid")) {
    return "이메일 형식이 올바르지 않습니다.";
  }

  if (normalized.includes("signup is disabled")) {
    return "Supabase에서 이메일 회원가입이 비활성화되어 있습니다.";
  }

  if (normalized.includes("database error saving new user")) {
    return "회원가입은 시도됐지만 Supabase 사용자 저장 중 오류가 발생했습니다. Auth 설정을 확인해 주세요.";
  }

  if (normalized.includes("invalid api key")) {
    return "Supabase URL 또는 공개 키 설정이 잘못되었습니다.";
  }

  return message;
}

function getAgentCardStyle(accent: string) {
  return {
    "--agent-accent": accent
  } as CSSProperties;
}

function buildManagerSuggestions(project: ProjectRecord) {
  const waitingReports = project.reports.filter((report) => report.status === "waiting").length;
  const workingAgents = project.agents.filter((agent) => agent.status === "working").length;
  const idleAgents = project.agents.filter((agent) => agent.status === "idle").length;

  const suggestions = [
    waitingReports > 0
      ? `CEO실 앞 보고 대기 ${waitingReports}건이 흐름을 멈추고 있습니다. 보고를 먼저 처리하는 것이 좋습니다.`
      : "CEO실 앞 대기 인원이 없습니다. 승인 흐름은 원활합니다.",
    workingAgents > idleAgents
      ? "현재 가동률이 높습니다. 중간 관리자가 병목 방을 계속 모니터링해야 합니다."
      : "유휴 인력이 남아 있어 신규 실험 업무를 넣기 좋습니다.",
    project.tasks.some((task) => task.status === "working")
      ? "작업 중 태스크가 있으니 모델 라우팅과 실패 로그를 함께 저장해 두는 편이 좋습니다."
      : "아직 시작되지 않은 상태입니다. 첫 업무 브리핑 템플릿부터 표준화하면 확장성이 좋아집니다."
  ];

  return suggestions;
}

function buildQuickReport(agent: AgentRecord, brief: string) {
  const trimmed = brief.trim();
  if (!trimmed) {
    return `${agent.name}이 빈 브리핑 상태로 완료 보고를 올렸습니다.`;
  }

  return `${agent.name}이 '${trimmed.slice(0, 36)}' 업무를 마치고 핵심 이슈와 다음 액션을 정리해 왔습니다.`;
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [briefDraft, setBriefDraft] = useState("");
  const [briefMessage, setBriefMessage] = useState("");
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [bannerMessage, setBannerMessage] = useState("대표가 각 캐릭터에게 업무를 배정할 준비가 되어 있습니다.");

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
  const managerSuggestions = useMemo(
    () => (selectedProject ? buildManagerSuggestions(selectedProject) : []),
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
    if (!providerStorageKey || typeof window === "undefined") {
      return;
    }

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

    const nextProjects = projects.map((project) => {
      if (project.id !== selectedProject.id) {
        return project;
      }

      const nextProject = mutator(project);
      return {
        ...nextProject,
        updatedAt: new Date().toISOString()
      };
    });

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

  function handleCreateProject() {
    const nextName = `AI 운영실 ${projects.length + 1}`;
    const nextProject = createEmptyProject(nextName);
    const nextProjects = [nextProject, ...projects];
    persistProjects(nextProjects);
    setSelectedProjectId(nextProject.id);
    setBannerMessage(`${nextName}을 만들었습니다.`);
  }

  function startAgentTask() {
    if (!selectedProject || !selectedAgent) return;

    const brief = briefDraft.trim();
    if (!brief) {
      setBriefMessage("짧은 업무 브리핑을 먼저 입력해 주세요.");
      return;
    }

    if (selectedAgent.status === "waiting_ceo") {
      setBriefMessage("이 담당자는 아직 CEO 보고 대기 중입니다. 먼저 보고를 받아 주세요.");
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
          ? {
              ...agent,
              status: "working",
              currentTaskId: taskId,
              currentRoomId: agent.homeRoomId,
              lastBrief: brief
            }
          : agent
      ),
      managerMemo: `중간 관리자 메모: ${selectedAgent.name}에게 새 업무가 배정되었습니다. '${brief.slice(0, 48)}'`
    }));

    setBriefMessage("짧은 대화가 끝났고, 담당자가 자기 방으로 돌아가 업무를 시작했습니다.");
    setBannerMessage(`${selectedAgent.name}이(가) ${selectedAgent.role} 업무를 시작했습니다.`);
  }

  function moveAgentToReport() {
    if (!selectedProject || !selectedAgent || selectedAgent.status !== "working" || !selectedAgent.currentTaskId) {
      setBriefMessage("현재 진행 중인 업무가 있을 때만 완료 보고로 넘길 수 있습니다.");
      return;
    }

    const taskId = selectedAgent.currentTaskId;
    const reportId = crypto.randomUUID();
    const summary = buildQuickReport(selectedAgent, briefDraft || selectedAgent.lastBrief);
    const now = new Date().toISOString();

    updateProject((project) => ({
      ...project,
      tasks: project.tasks.map((task) =>
        task.id === taskId ? { ...task, status: "waiting_report", updatedAt: now } : task
      ),
      reports: [
        {
          id: reportId,
          taskId,
          agentId: selectedAgent.id,
          summary,
          status: "waiting",
          createdAt: now
        },
        ...project.reports
      ],
      agents: project.agents.map((agent) =>
        agent.id === selectedAgent.id
          ? {
              ...agent,
              status: "waiting_ceo",
              currentRoomId: "room-ceo"
            }
          : agent
      ),
      managerMemo: `중간 관리자 메모: ${selectedAgent.name}의 업무가 완료되어 CEO실 앞에서 승인 대기 중입니다.`
    }));

    setBriefMessage("업무가 완료되었습니다. 이 담당자는 이제 CEO실 앞에서 무한 대기합니다.");
    setBannerMessage(`${selectedAgent.name}이(가) CEO실 앞으로 이동해 보고를 기다리는 중입니다.`);
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
          ? {
              ...agent,
              status: "idle",
              currentRoomId: agent.homeRoomId,
              currentTaskId: null
            }
          : agent
      ),
      managerMemo: "중간 관리자 메모: CEO가 보고를 수락했고, 담당자가 원래 자리로 복귀했습니다."
    }));

    const agentName = selectedProject.agents.find((agent) => agent.id === report.agentId)?.name ?? "담당자";
    setBannerMessage(`${agentName}의 보고를 확인했고, 다시 본인 자리로 복귀시켰습니다.`);
  }

  function getRoomAgents(roomId: string) {
    return selectedProject?.agents.filter((agent) => agent.currentRoomId === roomId) ?? [];
  }

  if (loadingAuth) {
    return <main className="app-loading">{T.loading}</main>;
  }

  if (!session) {
    return (
      <main className="auth-page">
        <section className="auth-hero">
          <p className="auth-kicker">{T.appKicker}</p>
          <h1>
            <span className="hero-title-line">{T.heroLine1}</span>
            <span className="hero-title-line">{T.heroLine2}</span>
          </h1>
          <p>{T.authCopy}</p>
          <div className="hero-chip-row">
            <span className="hero-chip">Vercel Web</span>
            <span className="hero-chip">Supabase Auth</span>
            <span className="hero-chip">Realtime Ready</span>
            <span className="hero-chip">API Router Ready</span>
          </div>
        </section>

        <section className="auth-card panel-surface">
          <div className="auth-tabs">
            <button className={authMode === "signin" ? "tab active" : "tab"} onClick={() => setAuthMode("signin")}>
              {T.signin}
            </button>
            <button className={authMode === "signup" ? "tab active" : "tab"} onClick={() => setAuthMode("signup")}>
              {T.signup}
            </button>
          </div>

          <div className="auth-form">
            <label>
              <span>{T.email}</span>
              <input type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} />
            </label>
            <label>
              <span>{T.password}</span>
              <input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} />
            </label>
            <button className="button button-primary button-block" onClick={handleAuthSubmit}>
              {authMode === "signin" ? T.signin : T.createAccount}
            </button>
            <p className="auth-message">{authMessage || T.authHint}</p>
            <div className="auth-meta slim-meta">
              <span>{supabaseReady ? `${projectRef || "Supabase"} ${T.ready}` : `${T.settings}: ${missingEnvKeys.join(", ")}`}</span>
              <span>{`방 ${officeRoomSeeds.length}개, 캐릭터 6명 구조로 시작합니다.`}</span>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="workspace-shell">
      <aside className="workspace-sidebar panel-surface">
        <div className="sidebar-top">
          <div>
            <p className="sidebar-kicker">{T.workspace}</p>
            <h2>Commerce Empire</h2>
          </div>
          <div className="sidebar-nav">
            <button className="sidebar-link active">{T.home}</button>
            <button className="sidebar-link" onClick={() => setIsSettingsOpen(true)}>
              {T.admin}
            </button>
          </div>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-header">
            <strong>{T.projects}</strong>
            <button className="mini-button" onClick={handleCreateProject}>
              {T.newProject}
            </button>
          </div>
          <div className="project-list">
            {projects.length > 0 ? (
              projects.map((project) => (
                <button
                  className={project.id === selectedProjectId ? "project-link active" : "project-link"}
                  key={project.id}
                  onClick={() => setSelectedProjectId(project.id)}
                >
                  <strong>{project.name}</strong>
                  <span>{formatDate(project.updatedAt)}</span>
                </button>
              ))
            ) : (
              <div className="sidebar-empty">{T.noProjects}</div>
            )}
          </div>
        </div>

        <div className="sidebar-footer panel-surface">
          <p className="sidebar-kicker">{T.currentUser}</p>
          <strong>{session.user.email}</strong>
          <span>{supabaseReady ? "Supabase 연결 준비 완료" : "환경 변수 확인 필요"}</span>
          <div className="inline-actions">
            <button className="button button-secondary" onClick={() => setIsSettingsOpen(true)}>
              {T.settings}
            </button>
            <button className="button" onClick={() => void signOut()}>
              {T.logout}
            </button>
          </div>
        </div>
      </aside>

      <section className="workspace-main">
        <header className="home-hero panel-surface">
          <div>
            <p className="section-kicker">Office Simulation</p>
            <h2>{selectedProject?.name ?? "오피스 운영실"}</h2>
            <p>
              캐릭터를 클릭해서 짧게 대화하고 업무를 시작시키세요. 완료되면 CEO실로 이동해 보고 대기하고, 보고를 받으면 다시 본인 자리로 돌아갑니다.
            </p>
            <div className="hero-chip-row">
              <span className="hero-chip">{selectedProject?.companyName ?? "Commerce Empire"}</span>
              <span className="hero-chip">{`CEO ${selectedProject?.ceoName ?? "대표"}`}</span>
              <span className="hero-chip">{`대기 보고 ${waitingReports.length}건`}</span>
            </div>
          </div>
          <div className="hero-stats">
            <article className="dashboard-card panel-surface">
              <p className="section-kicker">Reports</p>
              <h3>CEO실 대기</h3>
              <strong>{waitingReports.length}</strong>
            </article>
            <article className="dashboard-card panel-surface">
              <p className="section-kicker">Agents</p>
              <h3>작업 중 인원</h3>
              <strong>{selectedProject?.agents.filter((agent) => agent.status === "working").length ?? 0}</strong>
            </article>
            <article className="dashboard-card panel-surface">
              <p className="section-kicker">API</p>
              <h3>{T.connectionState}</h3>
              <strong>{Object.values(apiKeys).filter(Boolean).length}</strong>
            </article>
          </div>
        </header>

        <section className="project-banner panel-surface">
          <strong>실시간 운영 메모</strong>
          <p>{bannerMessage}</p>
        </section>

        {selectedProject ? (
          <div className="office-dashboard-grid">
            <section className="workflow-section panel-surface">
              <div className="section-header">
                <div>
                  <p className="section-kicker">Office Layout</p>
                  <h2>방 배치와 현재 인원</h2>
                </div>
              </div>
              <div className="office-layout">
                {selectedProject.rooms.map((room) => {
                  const roomAgents = getRoomAgents(room.id);
                  return (
                    <article className={`office-room ${room.id === "room-ceo" ? "office-room-ceo" : ""}`} key={room.id}>
                      <span className="office-room-label">{room.title}</span>
                      <p>{room.copy}</p>
                      <div className="room-occupants">
                        {roomAgents.length > 0 ? (
                          roomAgents.map((agent) => (
                            <span className="occupant-pill" key={agent.id}>
                              {agent.name}
                            </span>
                          ))
                        ) : (
                          <span className="occupant-empty">비어 있음</span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
              <div className="flow-strip">
                <span>업무 브리핑</span>
                <span>방 이동</span>
                <span>작업중</span>
                <span>CEO실 도착</span>
                <span>보고 후 복귀</span>
              </div>
            </section>

            <section className="workflow-section panel-surface">
              <div className="section-header">
                <div>
                  <p className="section-kicker">Character Cast</p>
                  <h2>담당자 배치</h2>
                </div>
              </div>
              <div className="agent-board">
                {selectedProject.agents.map((agent) => (
                  <article className="agent-card agent-card-button" key={agent.id} style={getAgentCardStyle(agent.accent)}>
                    <button className="agent-card-ghost" onClick={() => setSelectedAgentId(agent.id)} />
                    <div className="agent-card-top">
                      <div className="pixel-avatar">
                        <div className={`pixel-avatar-hair ${agent.hairClass}`} />
                        <div className="pixel-avatar-face" />
                        <div className={`pixel-avatar-body ${agent.outfitClass}`} />
                        <div className="pixel-avatar-paper" />
                      </div>
                      <div className="agent-heading">
                        <strong>{agent.name}</strong>
                        <span>{agent.role}</span>
                        <span className={`status-pill status-${agent.status}`}>{agent.status}</span>
                      </div>
                    </div>
                    <p className="agent-tone">{agent.tone}</p>
                    <p>{agent.specialty}</p>
                    <div className="agent-meta">
                      <span>{`${agent.provider} / ${agent.model}`}</span>
                      <span>{`현재 위치: ${
                        selectedProject.rooms.find((room) => room.id === agent.currentRoomId)?.title ?? "이동 중"
                      }`}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="workflow-section panel-surface">
              <div className="section-header">
                <div>
                  <p className="section-kicker">CEO Inbox</p>
                  <h2>보고 대기열</h2>
                </div>
              </div>
              <div className="report-list">
                {waitingReports.length > 0 ? (
                  waitingReports.map((report) => {
                    const agent = selectedProject.agents.find((item) => item.id === report.agentId);
                    return (
                      <article className="report-card" key={report.id}>
                        <div>
                          <strong>{agent?.name ?? "담당자"}</strong>
                          <p>{report.summary}</p>
                          <span>{formatDate(report.createdAt)}</span>
                        </div>
                        <button className="button button-primary" onClick={() => reviewReport(report)}>
                          보고 받기
                        </button>
                      </article>
                    );
                  })
                ) : (
                  <div className="empty-inline">아직 CEO실 앞에서 대기 중인 보고가 없습니다.</div>
                )}
              </div>
            </section>

            <section className="workflow-section panel-surface">
              <div className="section-header">
                <div>
                  <p className="section-kicker">Middle Manager</p>
                  <h2>중간 관리자 메모리</h2>
                </div>
              </div>
              <div className="manager-panel">
                <article className="manager-card">
                  <strong>현재 메모</strong>
                  <p>{selectedProject.managerMemo}</p>
                </article>
                <article className="manager-card">
                  <strong>개선 제안</strong>
                  <div className="manager-suggestions">
                    {managerSuggestions.map((suggestion) => (
                      <span className="manager-suggestion" key={suggestion}>
                        {suggestion}
                      </span>
                    ))}
                  </div>
                </article>
              </div>
            </section>
          </div>
        ) : null}
      </section>

      {selectedAgent && selectedProject ? (
        <div className="modal-backdrop" onClick={() => setSelectedAgentId(null)}>
          <div className="modal-panel panel-surface" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="section-kicker">Agent Briefing</p>
                <h2>{`${selectedAgent.name} · ${selectedAgent.role}`}</h2>
              </div>
              <button className="button button-secondary" onClick={() => setSelectedAgentId(null)}>
                {T.close}
              </button>
            </div>

            <div className="agent-modal-stack">
              <div className="agent-modal-summary">
                <span className={`status-pill status-${selectedAgent.status}`}>{selectedAgent.status}</span>
                <p>{selectedAgent.specialty}</p>
                <small>{`${selectedAgent.provider} / ${selectedAgent.model}`}</small>
              </div>

              <div className="brief-template-row">
                {quickBriefTemplates.map((template) => (
                  <button className="button button-secondary brief-template-button" key={template} onClick={() => setBriefDraft(template)}>
                    {template}
                  </button>
                ))}
              </div>

              <label className="settings-block">
                <span>짧은 대화 후 업무 브리핑</span>
                <textarea
                  className="editor-textarea agent-brief-textarea"
                  placeholder="예: 오늘 들어온 주문 메일을 읽고 누락 발주와 일정 꼬임을 먼저 찾아줘."
                  value={briefDraft}
                  onChange={(event) => setBriefDraft(event.target.value)}
                />
                <small>나중에 여기에 실제 API 호출 프롬프트와 라우팅 규칙을 연결하면 됩니다.</small>
              </label>

              <div className="agent-modal-actions">
                <button className="button button-primary" onClick={startAgentTask}>
                  업무 시작
                </button>
                <button className="button button-secondary" onClick={moveAgentToReport}>
                  완료 보고 올리기
                </button>
              </div>

              <p className="auth-message">{briefMessage || "캐릭터를 짧게 브리핑한 뒤 업무를 시작시키거나 완료 보고로 넘길 수 있습니다."}</p>
            </div>
          </div>
        </div>
      ) : null}

      {isSettingsOpen ? (
        <div className="modal-backdrop" onClick={() => setIsSettingsOpen(false)}>
          <div className="modal-panel panel-surface" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="section-kicker">{T.settings}</p>
                <h2>캐릭터별 API 연결 준비</h2>
              </div>
              <button className="button button-secondary" onClick={() => setIsSettingsOpen(false)}>
                {T.close}
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
            <div className="modal-footer settings-modal-footer">
              <span>지금은 브라우저 로컬 저장으로 유지하고, 다음 단계에서 Supabase 비밀 저장소나 서버 라우터로 옮기면 됩니다.</span>
              <button className="button button-primary" onClick={() => setIsSettingsOpen(false)}>
                {T.save}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
