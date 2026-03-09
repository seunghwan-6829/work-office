"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isAdminEmail } from "../lib/admin";
import {
  createEmptyProject,
  createSampleProject,
  getCurrentSession,
  loadProjects,
  type ProjectRecord,
  saveProjects,
  signInWithEmail,
  signOut,
  signUpWithEmail,
  subscribeToAuthChanges
} from "../lib/app-data";
import { getMissingPublicEnvKeys, getSupabaseBrowserConfig, getSupabaseProjectRefFromUrl } from "../lib/env";
import { mockApiKeyFields } from "../lib/mock-data";
import {
  buildRecommendations,
  createXmlExport,
  parseSrt,
  type RecommendationDraft,
  type RecommendationKind,
  type SubtitleSegment
} from "../lib/srt";

type RecommendationState = RecommendationDraft & {
  decision: "selected" | "excluded" | "pending";
  generated: boolean;
};

type AuthMode = "signin" | "signup";

const kindClassMap: Record<RecommendationKind, string> = {
  image_real: "badge-image",
  image_illustration: "badge-illustration",
  video: "badge-video",
  point_caption: "badge-point"
};

function toRecommendationState(segments: SubtitleSegment[]): RecommendationState[] {
  return buildRecommendations(segments).map((item) => ({
    ...item,
    decision: item.kind === "point_caption" ? "selected" : "pending",
    generated: false
  }));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
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
  const [bannerMessage, setBannerMessage] = useState("프로젝트를 선택하면 SRT부터 순서대로 작업할 수 있습니다.");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
  const isAdmin = isAdminEmail(session?.user.email);

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
    if (!selectedProject) {
      setSegments([]);
      setRecommendations([]);
      return;
    }

    const parsedSegments = selectedProject.srtText ? parseSrt(selectedProject.srtText) : [];
    setSegments(parsedSegments);
    setRecommendations(parsedSegments.length > 0 ? toRecommendationState(parsedSegments) : []);
  }, [selectedProject]);

  function persistProjects(nextProjects: ProjectRecord[]) {
    const email = session?.user.email;
    if (!email) return;
    setProjects(nextProjects);
    saveProjects(email, nextProjects);
  }

  async function handleAuthSubmit() {
    if (!supabaseReady) {
      setAuthMessage(`Supabase 공개 설정이 부족합니다: ${missingEnvKeys.join(", ")}`);
      return;
    }

    if (!authEmail || !authPassword) {
      setAuthMessage("이메일과 비밀번호를 모두 입력해 주세요.");
      return;
    }

    const action = authMode === "signin" ? signInWithEmail : signUpWithEmail;
    const { error } = await action(authEmail, authPassword);

    if (error) {
      setAuthMessage(error.message);
      return;
    }

    setAuthMessage(
      authMode === "signup"
        ? "회원가입 요청이 완료되었습니다. 이메일 확인이 필요한 경우 메일함을 확인해 주세요."
        : "로그인되었습니다."
    );
  }

  function handleCreateProject(withSample = false) {
    const name = withSample ? "샘플 프로젝트" : `새 프로젝트 ${projects.length + 1}`;
    const project = withSample ? createSampleProject() : createEmptyProject(name);
    const nextProjects = [project, ...projects];
    persistProjects(nextProjects);
    setSelectedProjectId(project.id);
    setBannerMessage(`${project.name}를 만들었습니다.`);
  }

  function updateProject(patch: Partial<ProjectRecord>) {
    if (!selectedProject) return;

    const nextProjects = projects.map((project) =>
      project.id === selectedProject.id
        ? { ...project, ...patch, updatedAt: new Date().toISOString() }
        : project
    );

    persistProjects(nextProjects);
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !selectedProject) return;

    const raw = await file.text();
    updateProject({ srtText: raw, name: selectedProject.name });
    setBannerMessage(`${file.name} 파일을 반영했습니다.`);
    event.target.value = "";
  }

  function applySrtText() {
    if (!selectedProject) return;
    updateProject({ srtText: selectedProject.srtText });
    setBannerMessage("SRT를 프로젝트에 저장했습니다.");
  }

  function updateProjectSrtText(value: string) {
    if (!selectedProject) return;

    setProjects((current) =>
      current.map((project) => (project.id === selectedProject.id ? { ...project, srtText: value } : project))
    );
  }

  function handleGenerateRecommendations() {
    if (!selectedProject?.srtText) {
      setBannerMessage("먼저 SRT를 입력해 주세요.");
      return;
    }

    try {
      const parsed = parseSrt(selectedProject.srtText);
      setSegments(parsed);
      setRecommendations(toRecommendationState(parsed));
      setBannerMessage(`추천 항목 ${parsed.length}개를 만들었습니다.`);
    } catch (error) {
      setBannerMessage(error instanceof Error ? error.message : "추천 생성에 실패했습니다.");
    }
  }

  function updateDecision(id: string, decision: RecommendationState["decision"]) {
    setRecommendations((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, decision, generated: decision === "excluded" ? false : item.generated }
          : item
      )
    );
  }

  function handleGenerateAssets() {
    const targets = recommendations.filter((item) => item.decision === "selected");

    if (targets.length === 0) {
      setBannerMessage("먼저 생성할 추천을 선택해 주세요.");
      return;
    }

    setIsGenerating(true);
    window.setTimeout(() => {
      setRecommendations((current) =>
        current.map((item) => (item.decision === "selected" ? { ...item, generated: true } : item))
      );
      setIsGenerating(false);
      setBannerMessage(`선택한 ${targets.length}개 항목을 생성 준비 상태로 전환했습니다.`);
    }, 900);
  }

  function handleExportXml() {
    if (!selectedProject) return;

    const selectedIds = recommendations.filter((item) => item.decision === "selected").map((item) => item.id);
    if (selectedIds.length === 0) {
      setBannerMessage("XML로 내보낼 항목이 없습니다.");
      return;
    }

    const xml = createXmlExport(segments, selectedIds, recommendations);
    const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedProject.name || "premiere-project"}.xml`;
    link.click();
    URL.revokeObjectURL(url);
    setBannerMessage("Premiere XML을 다운로드했습니다.");
  }

  async function handleSignOut() {
    await signOut();
    setSelectedProjectId(null);
    setBannerMessage("로그아웃되었습니다.");
  }

  if (loadingAuth) {
    return <div className="app-loading">작업 공간을 준비하는 중입니다...</div>;
  }

  if (!session) {
    return (
      <main className="auth-page">
        <section className="auth-hero">
          <p className="auth-kicker">Premiere Automation</p>
          <h1>프로젝트 단위로 정리된 편집 자동화</h1>
          <p>로그인 후 프로젝트를 만들고, SRT부터 순서대로 작업을 진행합니다.</p>
        </section>

        <section className="auth-card panel-surface">
          <div className="auth-tabs">
            <button className={authMode === "signin" ? "tab active" : "tab"} onClick={() => setAuthMode("signin")}>로그인</button>
            <button className={authMode === "signup" ? "tab active" : "tab"} onClick={() => setAuthMode("signup")}>회원가입</button>
          </div>

          <div className="auth-form compact-form">
            <label>
              <span>이메일</span>
              <input onChange={(event) => setAuthEmail(event.target.value)} type="email" value={authEmail} />
            </label>
            <label>
              <span>비밀번호</span>
              <input onChange={(event) => setAuthPassword(event.target.value)} type="password" value={authPassword} />
            </label>
            <button className="button button-primary button-block" onClick={handleAuthSubmit}>
              {authMode === "signin" ? "로그인" : "계정 만들기"}
            </button>
            <p className="auth-message">{authMessage || "이메일과 비밀번호로 바로 시작할 수 있습니다."}</p>
            <div className="auth-meta slim-meta">
              <span>관리자: motiol_6829@naver.com</span>
              <span>{supabaseReady ? `${projectRef || "Supabase"} 연결 준비 완료` : `설정 확인 필요: ${missingEnvKeys.join(", ")}`}</span>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="workspace-shell">
      <input accept=".srt" className="hidden-input" onChange={handleFileChange} ref={fileInputRef} type="file" />

      <aside className="workspace-sidebar">
        <div className="sidebar-top">
          <div>
            <p className="sidebar-kicker">Premiere Automation</p>
            <h2>워크스페이스</h2>
          </div>
          <button className="button button-primary button-block" onClick={() => handleCreateProject(false)}>
            새 프로젝트
          </button>
        </div>

        <nav className="sidebar-nav">
          <button className={!selectedProjectId ? "sidebar-link active" : "sidebar-link"} onClick={() => setSelectedProjectId(null)}>
            홈
          </button>
          {isAdmin ? (
            <Link className="sidebar-link" href="/admin">
              관리자 페이지
            </Link>
          ) : null}
        </nav>

        <div className="sidebar-section">
          <div className="sidebar-section-header">
            <span>프로젝트</span>
            <button className="mini-button" onClick={() => handleCreateProject(true)}>샘플</button>
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
              <div className="sidebar-empty">프로젝트가 없습니다.</div>
            )}
          </div>
        </div>

        <div className="sidebar-footer panel-surface">
          <strong>{session.user.email}</strong>
          <span>{supabaseReady ? `${projectRef} 연결됨` : "Supabase 설정 확인 필요"}</span>
          <button className="button button-secondary button-block" onClick={handleSignOut}>로그아웃</button>
        </div>
      </aside>

      <section className="workspace-main">
        <div className="topbar">
          <div>
            <p className="section-kicker">Workspace</p>
            <h1 className="topbar-title">{selectedProject ? selectedProject.name : "프로젝트 홈"}</h1>
          </div>
          <button className="icon-button" onClick={() => setIsSettingsOpen(true)} aria-label="설정 열기">
            <span>+</span>
            <small>설정</small>
          </button>
        </div>

        {!selectedProject ? (
          <div className="dashboard-stack">
            <section className="home-hero panel-surface">
              <div>
                <p className="section-kicker">프로젝트 홈</p>
                <h2>프로젝트를 기준으로 작업 흐름을 나눴습니다</h2>
                <p>홈에서는 프로젝트를 고르고, 상세 화면에서만 SRT와 추천 작업을 진행합니다.</p>
              </div>
              <div className="home-hero-actions">
                <button className="button button-primary" onClick={() => handleCreateProject(false)}>빈 프로젝트 만들기</button>
                <button className="button button-secondary" onClick={() => handleCreateProject(true)}>샘플 프로젝트 만들기</button>
              </div>
            </section>

            <section className="dashboard-grid compact-grid">
              <article className="dashboard-card panel-surface">
                <p className="section-kicker">개요</p>
                <h3>전체 프로젝트</h3>
                <strong>{projects.length}개</strong>
              </article>
              <article className="dashboard-card panel-surface">
                <p className="section-kicker">계정</p>
                <h3>현재 사용자</h3>
                <strong>{session.user.email}</strong>
              </article>
              <article className="dashboard-card panel-surface">
                <p className="section-kicker">Supabase</p>
                <h3>연결 상태</h3>
                <strong>{supabaseReady ? "준비 완료" : "확인 필요"}</strong>
              </article>
            </section>

            <section className="project-gallery">
              {projects.length > 0 ? (
                projects.map((project) => (
                  <button className="project-card panel-surface" key={project.id} onClick={() => setSelectedProjectId(project.id)}>
                    <div>
                      <p className="section-kicker">프로젝트</p>
                      <h3>{project.name}</h3>
                    </div>
                    <p>{project.srtText ? "SRT 연결됨" : "SRT 없음"}</p>
                    <span>{formatDate(project.updatedAt)}</span>
                  </button>
                ))
              ) : (
                <div className="empty-state panel-surface">
                  <h3>프로젝트가 없습니다</h3>
                  <p>좌측에서 새 프로젝트를 만들거나 샘플 프로젝트로 시작해 보세요.</p>
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="project-detail-stack">
            <section className="project-header panel-surface">
              <div>
                <p className="section-kicker">선택한 프로젝트</p>
                <input className="project-title-input" onChange={(event) => updateProject({ name: event.target.value })} value={selectedProject.name} />
                <p className="project-subcopy">최근 수정 {formatDate(selectedProject.updatedAt)}</p>
              </div>
              <div className="project-header-stats compact-stats">
                <div><span>구간</span><strong>{segments.length}</strong></div>
                <div><span>선택</span><strong>{selectedCount}</strong></div>
                <div><span>생성</span><strong>{generatedCount}</strong></div>
              </div>
            </section>

            <section className="project-banner panel-surface">
              <strong>현재 상태</strong>
              <p>{bannerMessage}</p>
            </section>

            <section className="workflow-section panel-surface">
              <div className="section-header">
                <div>
                  <p className="section-kicker">1단계</p>
                  <h2>SRT 입력</h2>
                </div>
                <div className="inline-actions">
                  <button className="button button-secondary" onClick={() => fileInputRef.current?.click()}>업로드</button>
                  <button className="button button-primary" onClick={applySrtText}>저장</button>
                </div>
              </div>

              <textarea
                className="editor-textarea"
                onChange={(event) => updateProjectSrtText(event.target.value)}
                placeholder="SRT를 붙여넣거나 파일을 업로드해 주세요."
                value={selectedProject.srtText}
              />
            </section>

            {selectedProject.srtText ? (
              <section className="workflow-section panel-surface">
                <div className="section-header">
                  <div>
                    <p className="section-kicker">2단계</p>
                    <h2>구간 확인</h2>
                  </div>
                  <button className="button button-primary" onClick={handleGenerateRecommendations}>추천 생성</button>
                </div>

                <div className="segment-list compact-list">
                  {segments.length > 0 ? (
                    segments.map((segment) => (
                      <div className="segment-card" key={segment.id}>
                        <div>
                          <strong>{segment.id}</strong>
                          <span>{segment.startTimecode} - {segment.endTimecode}</span>
                        </div>
                        <p>{segment.text}</p>
                      </div>
                    ))
                  ) : (
                    <div className="empty-inline">SRT 저장 후 타임코드 구간이 표시됩니다.</div>
                  )}
                </div>
              </section>
            ) : null}

            {recommendations.length > 0 ? (
              <section className="workflow-section panel-surface">
                <div className="section-header">
                  <div>
                    <p className="section-kicker">3단계</p>
                    <h2>추천 검수</h2>
                  </div>
                  <div className="inline-actions">
                    <button className="button button-secondary" disabled={isGenerating} onClick={handleGenerateAssets}>
                      {isGenerating ? "준비 중..." : "선택 항목 생성"}
                    </button>
                    <button className="button button-primary" onClick={handleExportXml}>XML 다운로드</button>
                  </div>
                </div>

                <div className="recommendation-grid">
                  {recommendations.filter((item) => item.decision !== "excluded").map((item) => (
                    <article className="recommendation-panel" key={item.id}>
                      <div className="recommendation-topline">
                        <span className={`badge ${kindClassMap[item.kind]}`}>{item.label}</span>
                        <span>{item.timecode}</span>
                      </div>
                      <h3>{item.title}</h3>
                      <p>{item.prompt}</p>
                      <small>{item.reason}</small>
                      <div className="recommendation-actions">
                        <button className={item.decision === "selected" ? "button button-primary" : "button button-secondary"} onClick={() => updateDecision(item.id, item.decision === "selected" ? "pending" : "selected")}>
                          {item.decision === "selected" ? "선택됨" : "선택"}
                        </button>
                        <button className="button" onClick={() => updateDecision(item.id, "excluded")}>제외</button>
                      </div>
                      <div className="recommendation-footer">
                        <span>{item.generated ? "생성 준비 완료" : "생성 전"}</span>
                        <span>세그먼트 {item.segmentId}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </section>

      {isSettingsOpen ? (
        <div className="modal-backdrop" onClick={() => setIsSettingsOpen(false)}>
          <div className="modal-panel panel-surface" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="section-kicker">설정</p>
                <h2>프로바이더 키</h2>
              </div>
              <button className="button button-secondary" onClick={() => setIsSettingsOpen(false)}>닫기</button>
            </div>

            <div className="settings-grid single-column-grid">
              {mockApiKeyFields.map((field) => (
                <label className="settings-block" key={field.id}>
                  <span>{field.label}</span>
                  <input
                    onChange={(event) => setApiKeys((current) => ({ ...current, [field.id]: event.target.value }))}
                    placeholder={field.placeholder}
                    type="password"
                    value={apiKeys[field.id] ?? ""}
                  />
                  <small>{field.help}</small>
                </label>
              ))}
            </div>

            <div className="modal-footer">
              <span>{supabaseReady ? `${projectRef} 연결 준비 완료` : "Supabase 공개 설정 확인 필요"}</span>
              <button className="button button-primary" onClick={() => setIsSettingsOpen(false)}>저장</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}