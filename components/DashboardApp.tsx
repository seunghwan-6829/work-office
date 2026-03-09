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
  return new Intl.DateTimeFormat("en-US", {
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
  const [bannerMessage, setBannerMessage] = useState("Select a project to begin from SRT and move step by step.");
  const [isGenerating, setIsGenerating] = useState(false);

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
      setAuthMessage(`Missing Supabase env: ${missingEnvKeys.join(", ")}`);
      return;
    }

    if (!authEmail || !authPassword) {
      setAuthMessage("Enter both email and password.");
      return;
    }

    const action = authMode === "signin" ? signInWithEmail : signUpWithEmail;
    const { error } = await action(authEmail, authPassword);

    if (error) {
      setAuthMessage(error.message);
      return;
    }

    setAuthMessage(authMode === "signup" ? "Sign-up request sent. Check email if confirmation is enabled." : "Signed in.");
  }

  function handleCreateProject(withSample = false) {
    const name = withSample ? "Sample Project" : `New Project ${projects.length + 1}`;
    const project = withSample ? createSampleProject() : createEmptyProject(name);
    const nextProjects = [project, ...projects];
    persistProjects(nextProjects);
    setSelectedProjectId(project.id);
    setBannerMessage(`${project.name} created.`);
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
    setBannerMessage(`${file.name} attached to ${selectedProject.name}.`);
    event.target.value = "";
  }

  function applySrtText() {
    if (!selectedProject) return;
    updateProject({ srtText: selectedProject.srtText });
    setBannerMessage("SRT saved into the project.");
  }

  function updateProjectSrtText(value: string) {
    if (!selectedProject) return;

    setProjects((current) =>
      current.map((project) => (project.id === selectedProject.id ? { ...project, srtText: value } : project))
    );
  }

  function handleGenerateRecommendations() {
    if (!selectedProject?.srtText) {
      setBannerMessage("Add SRT first.");
      return;
    }

    try {
      const parsed = parseSrt(selectedProject.srtText);
      setSegments(parsed);
      setRecommendations(toRecommendationState(parsed));
      setBannerMessage(`${parsed.length} recommendation items generated.`);
    } catch (error) {
      setBannerMessage(error instanceof Error ? error.message : "Failed to generate recommendations.");
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
      setBannerMessage("Choose at least one recommendation first.");
      return;
    }

    setIsGenerating(true);
    window.setTimeout(() => {
      setRecommendations((current) =>
        current.map((item) => (item.decision === "selected" ? { ...item, generated: true } : item))
      );
      setIsGenerating(false);
      setBannerMessage(`${targets.length} selected items moved into generation-ready state.`);
    }, 900);
  }

  function handleExportXml() {
    if (!selectedProject) return;

    const selectedIds = recommendations.filter((item) => item.decision === "selected").map((item) => item.id);
    if (selectedIds.length === 0) {
      setBannerMessage("No selected items to export.");
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
    setBannerMessage("Premiere XML downloaded.");
  }

  async function handleSignOut() {
    await signOut();
    setSelectedProjectId(null);
    setBannerMessage("Signed out.");
  }

  if (loadingAuth) {
    return <div className="app-loading">Preparing workspace...</div>;
  }

  if (!session) {
    return (
      <main className="auth-page">
        <section className="auth-hero">
          <p className="auth-kicker">Premiere Automation</p>
          <h1>Project-based editing automation workspace</h1>
          <p>
            A cleaner information flow: sign in, create a project, attach SRT, then unlock recommendations,
            generation, and XML export only when each step is ready.
          </p>
          <div className="auth-feature-list">
            <span>Project Home</span>
            <span>Notion-style Sidebar</span>
            <span>Admin Page</span>
          </div>
        </section>

        <section className="auth-card glass-card">
          <div className="auth-tabs">
            <button className={authMode === "signin" ? "tab active" : "tab"} onClick={() => setAuthMode("signin")}>Sign in</button>
            <button className={authMode === "signup" ? "tab active" : "tab"} onClick={() => setAuthMode("signup")}>Sign up</button>
          </div>

          <div className="auth-form">
            <label>
              <span>Email</span>
              <input onChange={(event) => setAuthEmail(event.target.value)} type="email" value={authEmail} />
            </label>
            <label>
              <span>Password</span>
              <input onChange={(event) => setAuthPassword(event.target.value)} type="password" value={authPassword} />
            </label>
            <button className="button button-primary button-block" onClick={handleAuthSubmit}>
              {authMode === "signin" ? "Sign in" : "Create account"}
            </button>
            <p className="auth-message">{authMessage || "Supabase Auth email/password flow is enabled here."}</p>
            <p className="auth-helper">
              Admin access opens automatically for <strong>motiol_6829@naver.com</strong>.
            </p>
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
            <h2>Workspace</h2>
          </div>
          <button className="button button-primary button-block" onClick={() => handleCreateProject(false)}>
            New project
          </button>
        </div>

        <nav className="sidebar-nav">
          <button className={!selectedProjectId ? "sidebar-link active" : "sidebar-link"} onClick={() => setSelectedProjectId(null)}>
            Home
          </button>
          {isAdmin ? (
            <Link className="sidebar-link" href="/admin">
              Admin page
            </Link>
          ) : null}
        </nav>

        <div className="sidebar-section">
          <div className="sidebar-section-header">
            <span>Projects</span>
            <button className="mini-button" onClick={() => handleCreateProject(true)}>Sample</button>
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
              <div className="sidebar-empty">No projects yet.</div>
            )}
          </div>
        </div>

        <div className="sidebar-footer glass-card">
          <strong>{session.user.email}</strong>
          <span>{supabaseReady ? `${projectRef} connected` : "Supabase env missing"}</span>
          <button className="button button-secondary button-block" onClick={handleSignOut}>Sign out</button>
        </div>
      </aside>

      <section className="workspace-main">
        {!selectedProject ? (
          <div className="dashboard-stack">
            <section className="home-hero glass-card">
              <div>
                <p className="section-kicker">Project Home</p>
                <h1>Manage automation as independent projects</h1>
                <p>
                  The home screen only shows project context. Detailed editing tools appear after entering a project,
                  so the interface stays focused instead of dumping every control at once.
                </p>
              </div>
              <div className="home-hero-actions">
                <button className="button button-primary" onClick={() => handleCreateProject(false)}>Create blank project</button>
                <button className="button button-secondary" onClick={() => handleCreateProject(true)}>Create sample project</button>
              </div>
            </section>

            <section className="dashboard-grid">
              <article className="dashboard-card glass-card">
                <p className="section-kicker">Overview</p>
                <h3>Total projects</h3>
                <strong>{projects.length}</strong>
                <p>Projects are managed per signed-in account.</p>
              </article>
              <article className="dashboard-card glass-card">
                <p className="section-kicker">Auth</p>
                <h3>Current user</h3>
                <strong>{session.user.email}</strong>
                <p>{isAdmin ? "Admin access enabled" : "Standard member access"}</p>
              </article>
              <article className="dashboard-card glass-card">
                <p className="section-kicker">Supabase</p>
                <h3>Status</h3>
                <strong>{supabaseReady ? "Ready" : "Check env"}</strong>
                <p>{supabaseReady ? `${projectRef} is ready for auth` : missingEnvKeys.join(", ")}</p>
              </article>
            </section>

            <section className="project-gallery">
              {projects.length > 0 ? (
                projects.map((project) => (
                  <button className="project-card glass-card" key={project.id} onClick={() => setSelectedProjectId(project.id)}>
                    <div>
                      <p className="section-kicker">Project</p>
                      <h3>{project.name}</h3>
                    </div>
                    <p>{project.srtText ? "SRT attached" : "No SRT yet"}</p>
                    <span>{formatDate(project.updatedAt)}</span>
                  </button>
                ))
              ) : (
                <div className="empty-state glass-card">
                  <h3>No projects yet</h3>
                  <p>Use the sidebar to create a blank project or a sample project.</p>
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="project-detail-stack">
            <section className="project-header glass-card">
              <div>
                <p className="section-kicker">Selected Project</p>
                <input className="project-title-input" onChange={(event) => updateProject({ name: event.target.value })} value={selectedProject.name} />
                <p className="project-subcopy">Last updated {formatDate(selectedProject.updatedAt)}</p>
              </div>
              <div className="project-header-stats">
                <div><span>Segments</span><strong>{segments.length}</strong></div>
                <div><span>Selected</span><strong>{selectedCount}</strong></div>
                <div><span>Generated</span><strong>{generatedCount}</strong></div>
              </div>
            </section>

            <section className="project-banner glass-card">
              <strong>Status</strong>
              <p>{bannerMessage}</p>
            </section>

            <section className="workflow-section glass-card">
              <div className="section-header">
                <div>
                  <p className="section-kicker">Step 1</p>
                  <h2>SRT source</h2>
                </div>
                <div className="inline-actions">
                  <button className="button button-secondary" onClick={() => fileInputRef.current?.click()}>Upload SRT</button>
                  <button className="button button-primary" onClick={applySrtText}>Save SRT</button>
                </div>
              </div>

              <textarea
                className="editor-textarea"
                onChange={(event) => updateProjectSrtText(event.target.value)}
                placeholder="Paste SRT here or upload a file."
                value={selectedProject.srtText}
              />
            </section>

            {selectedProject.srtText ? (
              <section className="workflow-section glass-card">
                <div className="section-header">
                  <div>
                    <p className="section-kicker">Step 2</p>
                    <h2>Segment preview</h2>
                  </div>
                  <button className="button button-primary" onClick={handleGenerateRecommendations}>Generate recommendations</button>
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
                    <div className="empty-inline">Save the SRT first to parse timecoded segments.</div>
                  )}
                </div>
              </section>
            ) : null}

            {recommendations.length > 0 ? (
              <section className="workflow-section glass-card">
                <div className="section-header">
                  <div>
                    <p className="section-kicker">Step 3</p>
                    <h2>Review recommendations</h2>
                  </div>
                  <div className="inline-actions">
                    <button className="button button-secondary" disabled={isGenerating} onClick={handleGenerateAssets}>
                      {isGenerating ? "Preparing..." : "Generate selected"}
                    </button>
                    <button className="button button-primary" onClick={handleExportXml}>Download XML</button>
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
                          {item.decision === "selected" ? "Selected" : "Select"}
                        </button>
                        <button className="button" onClick={() => updateDecision(item.id, "excluded")}>Exclude</button>
                      </div>
                      <div className="recommendation-footer">
                        <span>{item.generated ? "Ready" : "Pending"}</span>
                        <span>Segment {item.segmentId}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="workflow-section glass-card">
              <div className="section-header">
                <div>
                  <p className="section-kicker">Settings</p>
                  <h2>Provider keys</h2>
                </div>
              </div>

              <div className="settings-grid">
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
            </section>
          </div>
        )}
      </section>
    </main>
  );
}