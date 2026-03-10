
"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isAdminEmail } from "../lib/admin";
import {
  createEmptyProject,
  getCurrentSession,
  loadProjects,
  saveProjects,
  signInWithEmail,
  signOut,
  signUpWithEmail,
  subscribeToAuthChanges,
  type ProjectRecord
} from "../lib/app-data";
import { getMissingPublicEnvKeys, getSupabaseBrowserConfig, getSupabaseProjectRefFromUrl } from "../lib/env";
import { mockApiKeyFields } from "../lib/mock-data";
import {
  buildRecommendations,
  createXmlExport,
  parseSrt,
  type RecommendationDraft,
  type RecommendationKind,
  type RecommendationSettings,
  type SubtitleSegment
} from "../lib/srt";

type RecommendationState = RecommendationDraft & {
  decision: "selected" | "excluded" | "pending";
  generated: boolean;
};

type AuthMode = "signin" | "signup";
type ReviewStep = 2 | 3 | 4 | 5;

type ClaudeRecommendationPayload = {
  segmentId: string;
  kind: RecommendationKind;
  title: string;
  visualCue: string;
  prompt: string;
  reason: string;
  timecode: string;
};

const T = {
  loading: "작업 공간을 준비하고 있습니다...",
  appKicker: "PREMIERE AUTOMATION",
  heroLine1: "프로젝트 단위 편집 자동화",
  heroLine2: "워크스페이스",
  authCopy: "SRT 업로드부터 1차 검수, 최종 검수, XML 출력까지 한 흐름으로 정리합니다.",
  signin: "로그인",
  signup: "회원가입",
  email: "이메일",
  password: "비밀번호",
  createAccount: "계정 만들기",
  authHint: "이메일과 비밀번호로 바로 시작할 수 있습니다.",
  workspace: "워크스페이스",
  home: "홈",
  adminPage: "관리자 페이지",
  projects: "프로젝트",
  noProjects: "프로젝트가 없습니다.",
  logout: "로그아웃",
  settings: "설정",
  projectHome: "프로젝트 홈",
  homeTitle: "프로젝트 중심으로 작업 흐름을 관리합니다.",
  homeCopy: "왼쪽에서 프로젝트를 선택하고, 오른쪽 상세 화면에서 SRT 입력과 검수를 이어서 진행합니다.",
  overview: "개요",
  account: "계정",
  newProject: "새 프로젝트",
  allProjects: "전체 프로젝트",
  currentUser: "현재 사용자",
  connectionState: "연결 상태",
  ready: "준비 완료",
  checkNeeded: "확인 필요",
  selectedProject: "선택한 프로젝트",
  recentUpdate: "최근 수정",
  segmentCount: "구간",
  selectedCount: "선택",
  generatedCount: "생성",
  currentStatus: "현재 상태",
  srtStep: "1단계",
  srtInput: "SRT 입력",
  fileUpload: "파일 업로드",
  openSrt: "SRT 열기",
  srtConnected: "SRT가 연결되어 있습니다.",
  noSrt: "아직 SRT가 없습니다.",
  firstReviewStep: "2단계",
  firstReview: "1차 검수",
  autoClassify: "AI 자동 분류",
  generationOptions: "생성 옵션",
  generationOptionsTitle: "생성 빈도와 출력 옵션",
  recommendationFrequency: "추천 빈도",
  perSegmentVariants: "구간당 생성 개수",
  aspectRatio: "비율",
  secondReviewStep: "3단계",
  secondReview: "2차 검수",
  finalPrepStep: "4단계",
  finalPrep: "최종 검수 준비",
  finalReviewStep: "5단계",
  finalReview: "최종 검수",
  openSecondReview: "2차 검수 열기",
  openFinalPrep: "최종 검수 준비",
  openFinalReview: "최종 검수 열기",
  selectAll: "전체 선택",
  generateAll: "전체 항목 생성",
  generating: "생성 준비 중...",
  downloadXml: "XML 다운로드",
  sourceSentence: "대본 문장",
  recommendationDesc: "추천 정보",
  kind: "형식",
  realImage: "실사 형식",
  illustration: "일러스트 형식",
  video: "영상 형식",
  visualCue: "떠오르는 장면 설명",
  prompt: "생성 프롬프트",
  select: "선택",
  selected: "선택됨",
  exclude: "제외",
  beforeGeneration: "생성 전",
  readyToGenerate: "생성 준비 완료",
  segmentLabel: "세그먼트",
  recommendationEmpty: "추천 항목이 아직 없습니다.",
  providerKeys: "프로바이더 키",
  close: "닫기",
  save: "저장",
  upload: "업로드",
  clearSrt: "SRT 삭제",
  renameProject: "프로젝트 저장",
  deleteProject: "프로젝트 삭제",
  aiSetupRequired: "Claude API 키를 연결해야 AI 자동 분류를 진행할 수 있습니다."
} as const;

const kindClassMap: Record<RecommendationKind, string> = {
  image_real: "badge-image",
  image_illustration: "badge-illustration",
  video: "badge-video"
};

const kindLabelMap: Record<RecommendationKind, string> = {
  image_real: T.realImage,
  image_illustration: T.illustration,
  video: T.video
};

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

  if (normalized.includes("password should be at least")) {
    return "비밀번호는 더 길게 입력해 주세요.";
  }

  return message;
}

function hydrateRecommendations(items: ClaudeRecommendationPayload[]): RecommendationState[] {
  return items.map((item) => ({
    id: `rec-${item.segmentId}`,
    segmentId: item.segmentId,
    kind: item.kind,
    label: kindLabelMap[item.kind],
    title: item.title,
    prompt: item.prompt,
    visualCue: item.visualCue,
    reason: item.reason,
    timecode: item.timecode,
    decision: "pending",
    generated: false
  }));
}

export default function DashboardApp() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
  const [segments, setSegments] = useState<SubtitleSegment[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationState[]>([]);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [bannerMessage, setBannerMessage] = useState("프로젝트를 선택하면 SRT부터 단계별로 작업할 수 있습니다.");
  const [floatingNotice, setFloatingNotice] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSrtModalOpen, setIsSrtModalOpen] = useState(false);
  const [variantsPerSegment, setVariantsPerSegment] = useState("3");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [frequencySeconds, setFrequencySeconds] = useState("5");
  const [reviewStep, setReviewStep] = useState<ReviewStep>(2);

  const recommendationSettings = useMemo<RecommendationSettings>(
    () => ({ frequencySeconds: Math.max(1, Number(frequencySeconds) || 5) }),
    [frequencySeconds]
  );

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );
  const selectedCount = useMemo(
    () => recommendations.filter((item) => item.decision === "selected").length,
    [recommendations]
  );
  const generatedCount = useMemo(
    () => recommendations.filter((item) => item.generated).length,
    [recommendations]
  );
  const reviewItems = useMemo(
    () => recommendations.filter((item) => item.decision !== "excluded"),
    [recommendations]
  );
  const isAdmin = isAdminEmail(session?.user.email);
  const providerStorageKey = session?.user.email ? `provider-keys:${session.user.email.toLowerCase()}` : null;

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

    const nextProjects = loadProjects(email);
    setProjects(nextProjects);
    setSelectedProjectId((current) => current ?? nextProjects[0]?.id ?? null);
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
    if (!selectedProject) {
      setSegments([]);
      setRecommendations([]);
      setReviewStep(2);
      return;
    }

    const parsedSegments = selectedProject.srtText ? parseSrt(selectedProject.srtText) : [];
    setSegments(parsedSegments);
    setReviewStep(parsedSegments.length > 0 ? 2 : 2);
  }, [selectedProject]);

  function persistProjects(nextProjects: ProjectRecord[]) {
    const email = session?.user.email;
    if (!email) return;
    setProjects(nextProjects);
    saveProjects(email, nextProjects);
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
    const { data, error } = await action(email, password);

    if (error) {
      setAuthMessage(mapAuthError(error.message));
      return;
    }

    if (authMode === "signin") {
      setAuthMessage(
        data.session
          ? "로그인되었습니다."
          : "로그인 요청은 완료되었지만 세션이 바로 생성되지 않았습니다. 이메일 인증 상태를 확인해 주세요."
      );
      return;
    }

    const identities = data.user?.identities ?? [];

    if (!data.user) {
      setAuthMessage("회원가입 응답을 받지 못했습니다. Supabase Auth 설정을 다시 확인해 주세요.");
      return;
    }

    if (identities.length === 0) {
      setAuthMessage("이미 가입된 이메일이거나 이메일 인증 대기 상태일 수 있습니다. 메일함을 확인하거나 로그인해 주세요.");
      return;
    }

    setAuthMessage(
      data.session
        ? "회원가입과 동시에 로그인되었습니다."
        : "회원가입 요청이 완료되었습니다. 이메일 인증이 필요하면 메일함을 확인해 주세요."
    );
  }

  function handleCreateProject() {
    const name = `프로젝트 ${projects.length + 1}`;
    const project = createEmptyProject(name);
    const nextProjects = [project, ...projects];
    persistProjects(nextProjects);
    setSelectedProjectId(project.id);
    setRecommendations([]);
    setReviewStep(2);
    setBannerMessage(`${project.name}를 만들었습니다.`);
  }


  function handleProjectRename() {
    if (!selectedProject) return;
    const currentIndex = projects.findIndex((project) => project.id === selectedProject.id);
    const nextName = selectedProject.name.trim() || `프로젝트 ${currentIndex + 1}`;
    updateProject({ name: nextName });
    setBannerMessage(`프로젝트 이름을 '${nextName}'로 저장했습니다.`);
  }

  function handleDeleteProject() {
    if (!selectedProject) return;
    const deletedName = selectedProject.name;
    const nextProjects = projects.filter((project) => project.id !== selectedProject.id);
    persistProjects(nextProjects);
    setSelectedProjectId(nextProjects[0]?.id ?? null);
    setSegments([]);
    setRecommendations([]);
    setReviewStep(2);
    setBannerMessage(`${deletedName}를 삭제했습니다.`);
  }

  function handleClearSrt() {
    if (!selectedProject) return;
    updateProject({ srtText: "" });
    setSegments([]);
    setRecommendations([]);
    setReviewStep(2);
    setIsSrtModalOpen(false);
    setBannerMessage("연결된 SRT를 삭제했습니다.");
  }
  function updateProject(patch: Partial<ProjectRecord>) {
    if (!selectedProject) return;

    const nextProjects = projects.map((project) =>
      project.id === selectedProject.id ? { ...project, ...patch, updatedAt: new Date().toISOString() } : project
    );
    persistProjects(nextProjects);
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !selectedProject) return;

    const raw = await file.text();
    updateProject({ srtText: raw });
    setBannerMessage(`${file.name} 파일을 반영했습니다.`);
    event.target.value = "";
  }

  function updateProjectSrtText(value: string) {
    if (!selectedProject) return;

    setProjects((current) =>
      current.map((project) => (project.id === selectedProject.id ? { ...project, srtText: value } : project))
    );
  }

  function applySrtText() {
    if (!selectedProject) return;

    try {
      const parsed = parseSrt(selectedProject.srtText);
      setSegments(parsed);
      setRecommendations([]);
      setReviewStep(2);
      updateProject({ srtText: selectedProject.srtText });
      setBannerMessage(`SRT를 반영했고 ${parsed.length}개 구간을 확인했습니다.`);
      setIsSrtModalOpen(false);
    } catch (error) {
      setBannerMessage(error instanceof Error ? error.message : "SRT 처리에 실패했습니다.");
    }
  }

  async function handleGenerateRecommendations() {
    if (!selectedProject?.srtText) {
      setBannerMessage("먼저 SRT를 입력해 주세요.");
      return;
    }

    if (!apiKeys.anthropic?.trim()) {
      setFloatingNotice(T.aiSetupRequired);
      setIsSettingsOpen(true);
      return;
    }

    try {
      const parsed = parseSrt(selectedProject.srtText);
      setSegments(parsed);
      setIsClassifying(true);

      const response = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          apiKey: apiKeys.anthropic,
          segments: parsed,
          frequencySeconds: recommendationSettings.frequencySeconds
        })
      });

      const payload = (await response.json()) as { error?: string; items?: ClaudeRecommendationPayload[] };

      if (!response.ok || !payload.items) {
        throw new Error(payload.error || "Claude 분류에 실패했습니다.");
      }

      const nextRecommendations = hydrateRecommendations(payload.items);
      setRecommendations(nextRecommendations);
      setReviewStep(2);
      setBannerMessage(`Claude가 1차 검수용 추천 항목 ${nextRecommendations.length}개를 만들었습니다.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI 자동 분류에 실패했습니다.";
      setBannerMessage(message);
      setFloatingNotice(message);
    } finally {
      setIsClassifying(false);
    }
  }

  function updateDecision(id: string, decision: RecommendationState["decision"]) {
    setRecommendations((current) =>
      current.map((item) =>
        item.id === id ? { ...item, decision, generated: decision === "excluded" ? false : item.generated } : item
      )
    );
  }

  function updateRecommendation(id: string, patch: Partial<RecommendationState>) {
    setRecommendations((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        const nextKind = patch.kind ?? item.kind;
        return { ...item, ...patch, kind: nextKind, label: kindLabelMap[nextKind] };
      })
    );
  }

  function selectAllReviewItems() {
    setRecommendations((current) =>
      current.map((item) => (item.decision === "excluded" ? item : { ...item, decision: "selected" }))
    );
  }

  function handleGenerateAssets() {
    const targets = recommendations.filter((item) => item.decision === "selected");
    if (targets.length === 0) {
      setBannerMessage("먼저 생성할 추천 항목을 선택해 주세요.");
      return;
    }

    setIsGenerating(true);
    window.setTimeout(() => {
      setRecommendations((current) =>
        current.map((item) => (item.decision === "selected" ? { ...item, generated: true } : item))
      );
      setIsGenerating(false);
      setBannerMessage(`선택한 ${targets.length}개 구간에 대해 생성 준비를 마쳤습니다.`);
    }, 900);
  }

  function handleExportXml() {
    if (!selectedProject) return;

    const selectedIds = recommendations.filter((item) => item.decision === "selected").map((item) => item.id);
    if (selectedIds.length === 0) {
      setBannerMessage("XML로 내보낼 항목이 없습니다.");
      return;
    }

    const xml = createXmlExport(segments, selectedIds, recommendations, {
      variantsPerSegment: Number(variantsPerSegment) || 1,
      aspectRatio: aspectRatio || "16:9"
    });
    const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedProject.name || "premiere-project"}.xml`;
    link.click();
    URL.revokeObjectURL(url);
    setBannerMessage("Premiere용 XML을 다운로드했습니다. 현재 파일은 마커 기반 시퀀스로 가져오게 됩니다.");
  }

  async function handleSignOut() {
    await signOut();
    setSelectedProjectId(null);
    setBannerMessage("로그아웃했습니다.");
  }

  if (loadingAuth) {
    return <div className="app-loading">{T.loading}</div>;
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
          <div className="auth-form compact-form">
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
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="workspace-shell">
      <input ref={fileInputRef} accept=".srt" className="hidden-input" onChange={handleFileChange} type="file" />

      {floatingNotice ? (
        <div className="floating-notice" onClick={() => setFloatingNotice("")}>{floatingNotice}</div>
      ) : null}

      <aside className="workspace-sidebar panel-surface">
        <div className="sidebar-top">
          <div>
            <p className="sidebar-kicker">{T.appKicker}</p>
            <h2>{T.workspace}</h2>
          </div>
          <button className="button button-primary button-block" onClick={handleCreateProject}>
            {T.newProject}
          </button>
        </div>

        <nav className="sidebar-nav panel-nav">
          <button className={!selectedProjectId ? "sidebar-link active" : "sidebar-link"} onClick={() => setSelectedProjectId(null)}>
            <span className="sidebar-link-icon">⌂</span>
            <span>{T.home}</span>
          </button>
          {isAdmin ? (
            <Link className="sidebar-link" href="/admin">
              <span className="sidebar-link-icon">⚙</span>
              <span>{T.adminPage}</span>
            </Link>
          ) : null}
        </nav>

        <div className="sidebar-section">
          <div className="sidebar-section-header">
            <span>{T.projects}</span>
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
          <strong>{session.user.email}</strong>
          <button className="button button-secondary button-block" onClick={handleSignOut}>
            {T.logout}
          </button>
        </div>
      </aside>

      <section className="workspace-main">
        <div className="topbar">
          <div>
            <p className="section-kicker">{T.workspace}</p>
            <h1 className="topbar-title">{selectedProject ? selectedProject.name : T.projectHome}</h1>
          </div>
          <button aria-label={T.settings} className="icon-button" onClick={() => setIsSettingsOpen(true)}>
            <span>+</span>
            <small>{T.settings}</small>
          </button>
        </div>

        {!selectedProject ? (
          <div className="dashboard-stack">
            <section className="home-hero panel-surface">
              <div>
                <p className="section-kicker">{T.projectHome}</p>
                <h2>{T.homeTitle}</h2>
                <p>{T.homeCopy}</p>
              </div>
              <div className="home-hero-actions">
                <button className="button button-primary" onClick={handleCreateProject}>
                  {T.newProject}
                </button>
              </div>
            </section>

            <section className="dashboard-grid compact-grid">
              <article className="dashboard-card panel-surface">
                <p className="section-kicker">{T.overview}</p>
                <h3>{T.allProjects}</h3>
                <strong>{projects.length}개</strong>
              </article>
              <article className="dashboard-card panel-surface">
                <p className="section-kicker">{T.account}</p>
                <h3>{T.currentUser}</h3>
                <strong>{session.user.email}</strong>
              </article>
              <article className="dashboard-card panel-surface">
                <p className="section-kicker">Supabase</p>
                <h3>{T.connectionState}</h3>
                <strong>{supabaseReady ? T.ready : T.checkNeeded}</strong>
              </article>
            </section>
          </div>
        ) : (
          <div className="project-workboard">
            <div className="project-main-column">
              <section className="project-header panel-surface">
                <div>
                  <p className="section-kicker">{T.selectedProject}</p>
                  <input
                    className="project-title-input"
                    value={selectedProject.name}
                    onChange={(event) => updateProject({ name: event.target.value })}
                  />
                  <p className="project-subcopy">
                    {T.recentUpdate} {formatDate(selectedProject.updatedAt)}
                  </p>
                  <div className="inline-actions project-manage-actions">
                    <button className="button button-secondary" onClick={handleProjectRename}>
                      {T.renameProject}
                    </button>
                    <button className="button button-danger" onClick={handleDeleteProject}>
                      {T.deleteProject}
                    </button>
                  </div>
                </div>
                <div className="project-header-stats compact-stats minimal-stats">
                  <div>
                    <span>{T.segmentCount}</span>
                    <strong>{segments.length}</strong>
                  </div>
                  <div>
                    <span>{T.selectedCount}</span>
                    <strong>{selectedCount}</strong>
                  </div>
                  <div>
                    <span>{T.generatedCount}</span>
                    <strong>{generatedCount}</strong>
                  </div>
                </div>
              </section>

              <section className="project-banner panel-surface">
                <strong>{T.currentStatus}</strong>
                <p>{bannerMessage}</p>
              </section>

              <section className="workflow-section panel-surface">
                <div className="section-header">
                  <div>
                    <p className="section-kicker">{T.srtStep}</p>
                    <h2>{T.srtInput}</h2>
                  </div>
                  <div className="inline-actions">
                    <button className="button button-secondary" onClick={() => fileInputRef.current?.click()}>
                      {T.fileUpload}
                    </button>
                    <button className="button button-secondary" onClick={handleClearSrt}>
                      {T.clearSrt}
                    </button>
                    <button className="button button-primary" onClick={() => setIsSrtModalOpen(true)}>
                      {T.openSrt}
                    </button>
                  </div>
                </div>
                <div className="compact-srt-entry">
                  <strong>{selectedProject.srtText ? T.srtConnected : T.noSrt}</strong>
                  <p>
                    {selectedProject.srtText
                      ? `${segments.length}개 구간이 확인되었습니다. 필요하면 팝업에서 내용을 수정할 수 있습니다.`
                      : "SRT를 붙여넣거나 파일로 올린 뒤 단계별 검수로 넘어가 주세요."}
                  </p>
                </div>
              </section>

              <section className="workflow-section panel-surface">
                <div className="section-header">
                  <div>
                    <p className="section-kicker">{T.firstReviewStep}</p>
                    <h2>{T.firstReview}</h2>
                  </div>
                  <div className="inline-actions">
                    <button className="button button-primary" onClick={handleGenerateRecommendations}>
                      {isClassifying ? "AI 분석 중..." : T.autoClassify}
                    </button>
                    {recommendations.length > 0 ? (
                      <button className="button button-secondary" onClick={() => setReviewStep(3)}>
                        {T.openSecondReview}
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="segment-list">
                  {segments.length > 0 ? (
                    segments.map((segment) => (
                      <div className="segment-card segment-card-wide" key={segment.id}>
                        <div className="segment-index-row">
                          <strong>{segment.id}</strong>
                          <span>
                            {segment.startTimecode} - {segment.endTimecode}
                          </span>
                        </div>
                        <p>{segment.text}</p>
                      </div>
                    ))
                  ) : (
                    <div className="empty-inline">SRT를 연결하면 이곳에 타임코드 구간이 표시됩니다.</div>
                  )}
                </div>
              </section>

              <section className="workflow-section panel-surface">
                <div className="section-header">
                  <div>
                    <p className="section-kicker">{T.generationOptions}</p>
                    <h2>{T.generationOptionsTitle}</h2>
                  </div>
                </div>
                <div className="options-grid">
                  <label className="settings-block">
                    <span>{T.recommendationFrequency}</span>
                    <input value={frequencySeconds} onChange={(event) => setFrequencySeconds(event.target.value)} />
                    <small>예: 5로 두면 5초마다 1개 정도의 추천 항목만 추립니다.</small>
                  </label>
                  <label className="settings-block">
                    <span>{T.perSegmentVariants}</span>
                    <input value={variantsPerSegment} onChange={(event) => setVariantsPerSegment(event.target.value)} />
                    <small>예: 3개로 두면 같은 문장에 대한 결과물이 3개 레이어로 XML에 들어갑니다.</small>
                  </label>
                  <label className="settings-block settings-block-wide">
                    <span>{T.aspectRatio}</span>
                    <input value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value)} />
                    <small>예: 16:9, 9:16, 1:1처럼 원하는 비율을 직접 입력할 수 있습니다.</small>
                  </label>
                </div>
              </section>

              {reviewStep >= 3 ? (
                <section className="workflow-section panel-surface">
                  <div className="section-header">
                    <div>
                      <p className="section-kicker">{T.secondReviewStep}</p>
                      <h2>{T.secondReview}</h2>
                    </div>
                    <button className="button button-secondary" onClick={() => setReviewStep(4)}>
                      {T.openFinalPrep}
                    </button>
                  </div>
                  <div className="stage-placeholder">
                    <strong>MOGRT 자막 투입 구간 추천 단계</strong>
                    <p>현재는 이미지와 영상 후보를 먼저 정리하고, 이후 단계에서 MOGRT 자막 투입 구간을 검수합니다.</p>
                  </div>
                </section>
              ) : null}

              {reviewStep >= 4 ? (
                <section className="workflow-section panel-surface">
                  <div className="section-header">
                    <div>
                      <p className="section-kicker">{T.finalPrepStep}</p>
                      <h2>{T.finalPrep}</h2>
                    </div>
                    <button className="button button-secondary" onClick={() => setReviewStep(5)}>
                      {T.openFinalReview}
                    </button>
                  </div>
                  <div className="stage-placeholder">
                    <strong>오른쪽 검수판에서 항목별 형식과 설명을 개별 수정할 수 있습니다.</strong>
                    <p>대본 문장과 추천 설명의 배경을 분리해서 더 헷갈리지 않도록 정리했습니다.</p>
                  </div>
                </section>
              ) : null}
            </div>

            <aside className="review-column panel-surface">
              <div className="section-header review-header">
                <div>
                  <p className="section-kicker">{T.finalReviewStep}</p>
                  <h2>{T.finalReview}</h2>
                </div>
                <div className="inline-actions review-header-actions">
                  <button className="button" onClick={selectAllReviewItems} disabled={reviewStep < 5 || reviewItems.length === 0}>
                    {T.selectAll}
                  </button>
                  <button className="button button-secondary" disabled={isGenerating || reviewStep < 5} onClick={handleGenerateAssets}>
                    {isGenerating ? T.generating : T.generateAll}
                  </button>
                  <button className="button button-primary" disabled={reviewStep < 5} onClick={handleExportXml}>
                    {T.downloadXml}
                  </button>
                </div>
              </div>

              {reviewStep < 5 ? (
                <div className="review-empty">
                  <strong>최종 검수 단계가 아직 열리지 않았습니다.</strong>
                  <p>왼쪽에서 2차 검수와 최종 검수 준비 단계를 차례대로 열어 주세요.</p>
                </div>
              ) : reviewItems.length > 0 ? (
                <div className="review-list">
                  {reviewItems.map((item) => (
                    <article className="recommendation-panel recommendation-panel-strong" key={item.id}>
                      <div className="recommendation-topline">
                        <span className={`badge ${kindClassMap[item.kind]}`}>{item.label}</span>
                        <span>{item.timecode}</span>
                      </div>
                      <h3>{item.title}</h3>
                      <div className="recommendation-body-grid">
                        <div className="source-block">
                          <span className="meta-label">{T.sourceSentence}</span>
                          <p>{segments.find((segment) => segment.id === item.segmentId)?.text ?? item.title}</p>
                        </div>
                        <div className="recommend-block">
                          <span className="meta-label">{T.recommendationDesc}</span>
                          <label className="settings-block compact-field">
                            <span>{T.kind}</span>
                            <select
                              value={item.kind}
                              onChange={(event) => updateRecommendation(item.id, { kind: event.target.value as RecommendationKind })}
                            >
                              <option value="image_real">{T.realImage}</option>
                              <option value="image_illustration">{T.illustration}</option>
                              <option value="video">{T.video}</option>
                            </select>
                          </label>
                          <label className="settings-block compact-field">
                            <span>{T.visualCue}</span>
                            <textarea
                              className="inline-textarea"
                              value={item.visualCue}
                              onChange={(event) => updateRecommendation(item.id, { visualCue: event.target.value })}
                            />
                          </label>
                          <label className="settings-block compact-field">
                            <span>{T.prompt}</span>
                            <textarea
                              className="inline-textarea"
                              value={item.prompt}
                              onChange={(event) => updateRecommendation(item.id, { prompt: event.target.value })}
                            />
                          </label>
                        </div>
                      </div>
                      <div className="recommendation-actions">
                        <button
                          className={item.decision === "selected" ? "button button-primary" : "button button-secondary"}
                          onClick={() => updateDecision(item.id, item.decision === "selected" ? "pending" : "selected")}
                        >
                          {item.decision === "selected" ? T.selected : T.select}
                        </button>
                        <button className="button" onClick={() => updateDecision(item.id, "excluded")}>
                          {T.exclude}
                        </button>
                      </div>
                      <div className="recommendation-footer">
                        <span>{item.generated ? T.readyToGenerate : T.beforeGeneration}</span>
                        <span>
                          {T.segmentLabel} {item.segmentId}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="review-empty">
                  <strong>{T.recommendationEmpty}</strong>
                  <p>Claude API 키를 연결한 뒤 `{T.autoClassify}`를 누르면 이 영역에 결과가 채워집니다.</p>
                </div>
              )}
            </aside>
          </div>
        )}
      </section>

      {isSettingsOpen ? (
        <div className="modal-backdrop" onClick={() => setIsSettingsOpen(false)}>
          <div className="modal-panel panel-surface" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="section-kicker">{T.settings}</p>
                <h2>{T.providerKeys}</h2>
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
              <button className="button button-primary" onClick={() => setIsSettingsOpen(false)}>
                {T.save}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isSrtModalOpen && selectedProject ? (
        <div className="modal-backdrop" onClick={() => setIsSrtModalOpen(false)}>
          <div className="modal-panel modal-panel-wide panel-surface" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="section-kicker">{T.srtInput}</p>
                <h2>{selectedProject.name}</h2>
              </div>
              <div className="inline-actions">
                <button className="button button-secondary" onClick={() => fileInputRef.current?.click()}>
                  {T.upload}
                </button>
                <button className="button button-secondary" onClick={handleClearSrt}>
                  {T.clearSrt}
                </button>
                <button className="button button-primary" onClick={applySrtText}>
                  {T.save}
                </button>
              </div>
            </div>
            <textarea
              className="editor-textarea editor-textarea-large"
              placeholder="SRT 내용을 붙여넣어 주세요."
              value={selectedProject.srtText}
              onChange={(event) => updateProjectSrtText(event.target.value)}
            />
          </div>
        </div>
      ) : null}
    </main>
  );
}






