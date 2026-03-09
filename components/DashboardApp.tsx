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
  type SubtitleSegment
} from "../lib/srt";

type RecommendationState = RecommendationDraft & {
  decision: "selected" | "excluded" | "pending";
  generated: boolean;
};

type AuthMode = "signin" | "signup";

const T = {
  loading: "\uC791\uC5C5 \uACF5\uAC04\uC744 \uC900\uBE44\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4...",
  appKicker: "Premiere Automation",
  authTitle: "\uD504\uB85C\uC81D\uD2B8 \uB2E8\uC704 \uD3B8\uC9D1 \uC790\uB3D9\uD654 \uC6CC\uD06C\uC2A4\uD398\uC774\uC2A4",
  authCopy: "SRT\uB97C \uB123\uACE0, \uAD6C\uAC04\uC744 \uAC80\uC218\uD558\uACE0, \uCD94\uCC9C\uC744 \uB2E4\uB4EC\uC740 \uB4A4 XML\uAE4C\uC9C0 \uC774\uC5B4\uC9C0\uB294 \uC791\uC5C5 \uD750\uB984\uC744 \uD55C\uACF3\uC5D0\uC11C \uAD00\uB9AC\uD569\uB2C8\uB2E4.",
  signin: "\uB85C\uADF8\uC778",
  signup: "\uD68C\uC6D0\uAC00\uC785",
  email: "\uC774\uBA54\uC77C",
  password: "\uBE44\uBC00\uBC88\uD638",
  createAccount: "\uACC4\uC815 \uB9CC\uB4E4\uAE30",
  authHint: "\uC774\uBA54\uC77C\uACFC \uBE44\uBC00\uBC88\uD638\uB85C \uBC14\uB85C \uC2DC\uC791\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.",
  admin: "\uAD00\uB9AC\uC790",
  workspace: "\uC6CC\uD06C\uC2A4\uD398\uC774\uC2A4",
  home: "\uD648",
  adminPage: "\uAD00\uB9AC\uC790 \uD398\uC774\uC9C0",
  projects: "\uD504\uB85C\uC81D\uD2B8",
  sample: "\uC0D8\uD50C",
  noProjects: "\uD504\uB85C\uC81D\uD2B8\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.",
  logout: "\uB85C\uADF8\uC544\uC6C3",
  settings: "\uC124\uC815",
  projectHome: "\uD504\uB85C\uC81D\uD2B8 \uD648",
  homeTitle: "\uD504\uB85C\uC81D\uD2B8\uB97C \uAE30\uC900\uC73C\uB85C \uC791\uC5C5 \uD750\uB984\uC744 \uB098\uB220\uC11C \uAD00\uB9AC\uD569\uB2C8\uB2E4.",
  homeCopy: "\uC67C\uCABD\uC5D0\uC11C \uD504\uB85C\uC81D\uD2B8\uB97C \uACE0\uB974\uACE0, \uC0C1\uC138 \uD654\uBA74\uC5D0\uC11C\uB9CC SRT \uC785\uB825\uACFC \uAC80\uC218\uB97C \uC9C4\uD589\uD558\uB3C4\uB85D \uC815\uB9AC\uD588\uC2B5\uB2C8\uB2E4.",
  newProject: "\uC0C8 \uD504\uB85C\uC81D\uD2B8",
  sampleProject: "\uC0D8\uD50C \uD504\uB85C\uC81D\uD2B8",
  allProjects: "\uC804\uCCB4 \uD504\uB85C\uC81D\uD2B8",
  currentUser: "\uD604\uC7AC \uC0AC\uC6A9\uC790",
  connectionState: "\uC5F0\uACB0 \uC0C1\uD0DC",
  ready: "\uC900\uBE44 \uC644\uB8CC",
  checkNeeded: "\uD655\uC778 \uD544\uC694",
  selectedProject: "\uC120\uD0DD\uD55C \uD504\uB85C\uC81D\uD2B8",
  recentUpdate: "\uCD5C\uADFC \uC218\uC815",
  segmentCount: "\uAD6C\uAC04",
  selectedCount: "\uC120\uD0DD",
  generatedCount: "\uC0DD\uC131",
  currentStatus: "\uD604\uC7AC \uC0C1\uD0DC",
  srtStep: "1\uB2E8\uACC4",
  srtInput: "SRT \uC785\uB825",
  fileUpload: "\uD30C\uC77C \uC5C5\uB85C\uB4DC",
  openSrt: "SRT \uC5F4\uAE30",
  srtConnected: "SRT\uAC00 \uC5F0\uACB0\uB418\uC5B4 \uC788\uC2B5\uB2C8\uB2E4.",
  noSrt: "\uC544\uC9C1 SRT\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.",
  firstReviewStep: "2\uB2E8\uACC4",
  firstReview: "1\uCC28 \uAC80\uC218",
  autoClassify: "AI \uC790\uB3D9 \uBD84\uB958",
  generationOptions: "\uC0DD\uC131 \uC635\uC158",
  generationOptionsTitle: "\uB3D9\uC2DC \uC0DD\uC131 \uAC1C\uC218\uC640 \uBE44\uC728",
  perSegmentVariants: "\uAD6C\uAC04\uB2F9 \uC0DD\uC131 \uAC1C\uC218",
  aspectRatio: "\uBE44\uC728",
  secondReviewStep: "3\uB2E8\uACC4",
  secondReview: "2\uCC28 \uAC80\uC218",
  finalPrepStep: "4\uB2E8\uACC4",
  finalPrep: "\uCD5C\uC885 \uAC80\uC218 \uC900\uBE44",
  finalReviewStep: "5\uB2E8\uACC4",
  finalReview: "\uCD5C\uC885 \uAC80\uC218",
  generateAll: "\uC804\uCCB4 \uD56D\uBAA9 \uC0DD\uC131",
  generating: "\uC0DD\uC131 \uC900\uBE44 \uC911...",
  downloadXml: "XML \uB2E4\uC6B4\uB85C\uB4DC",
  sourceSentence: "\uB300\uBCF8 \uBB38\uC7A5",
  recommendationDesc: "\uCD94\uCC9C \uC124\uBA85",
  kind: "\uD615\uC2DD",
  realImage: "\uC2E4\uC0AC \uD615\uC2DD",
  illustration: "\uC77C\uB7EC\uC2A4\uD2B8 \uD615\uC2DD",
  video: "\uC601\uC0C1 \uD615\uC2DD",
  visualCue: "\uB5A0\uC624\uB974\uB294 \uC7A5\uBA74 \uC124\uBA85",
  prompt: "\uC0DD\uC131 \uD504\uB86C\uD504\uD2B8",
  select: "\uC120\uD0DD",
  selected: "\uC120\uD0DD\uB428",
  exclude: "\uC81C\uC678",
  beforeGeneration: "\uC0DD\uC131 \uC804",
  readyToGenerate: "\uC0DD\uC131 \uC900\uBE44 \uC644\uB8CC",
  segmentLabel: "\uC138\uADF8\uBA3C\uD2B8",
  recommendationEmpty: "\uCD94\uCC9C \uD56D\uBAA9\uC774 \uC544\uC9C1 \uC5C6\uC2B5\uB2C8\uB2E4.",
  providerKeys: "\uD504\uB85C\uBC14\uC774\uB354 \uD0A4",
  close: "\uB2EB\uAE30",
  save: "\uC800\uC7A5",
  upload: "\uC5C5\uB85C\uB4DC"
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

function toRecommendationState(segments: SubtitleSegment[]): RecommendationState[] {
  return buildRecommendations(segments).map((item) => ({ ...item, decision: "pending", generated: false }));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
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
  const [bannerMessage, setBannerMessage] = useState("\uD504\uB85C\uC81D\uD2B8\uB97C \uC120\uD0DD\uD558\uBA74 SRT\uBD80\uD130 \uB2E8\uACC4\uBCC4\uB85C \uC791\uC5C5\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSrtModalOpen, setIsSrtModalOpen] = useState(false);
  const [variantsPerSegment, setVariantsPerSegment] = useState("3");
  const [aspectRatio, setAspectRatio] = useState("16:9");

  const selectedProject = useMemo(() => projects.find((project) => project.id === selectedProjectId) ?? null, [projects, selectedProjectId]);
  const selectedCount = useMemo(() => recommendations.filter((item) => item.decision === "selected").length, [recommendations]);
  const generatedCount = useMemo(() => recommendations.filter((item) => item.generated).length, [recommendations]);
  const reviewItems = useMemo(() => recommendations.filter((item) => item.decision !== "excluded"), [recommendations]);
  const isAdmin = isAdminEmail(session?.user.email);

  useEffect(() => {
    let mounted = true;
    getCurrentSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setLoadingAuth(false);
    }).catch(() => {
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
  }, [selectedProject]);

  function persistProjects(nextProjects: ProjectRecord[]) {
    const email = session?.user.email;
    if (!email) return;
    setProjects(nextProjects);
    saveProjects(email, nextProjects);
  }

  async function handleAuthSubmit() {
    if (!supabaseReady) {
      setAuthMessage(`Supabase ${missingEnvKeys.join(", ")}`);
      return;
    }

    const email = authEmail.trim();
    const password = authPassword.trim();

    if (!email || !password) {
      setAuthMessage("\uC774\uBA54\uC77C\uACFC \uBE44\uBC00\uBC88\uD638\uB97C \uBAA8\uB450 \uC785\uB825\uD574 \uC8FC\uC138\uC694.");
      return;
    }

    const action = authMode === "signin" ? signInWithEmail : signUpWithEmail;
    const { data, error } = await action(email, password);

    if (error) {
      setAuthMessage(error.message);
      return;
    }

    if (authMode === "signin") {
      setAuthMessage(
        data.session
          ? "\uB85C\uADF8\uC778\uB418\uC5C8\uC2B5\uB2C8\uB2E4."
          : "\uB85C\uADF8\uC778\uC740 \uC694\uCCAD\uB418\uC5C8\uC9C0\uB9CC \uC138\uC158\uC744 \uBC1B\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC774\uBA54\uC77C \uC778\uC99D \uC0C1\uD0DC\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694."
      );
      return;
    }

    const identities = data.user?.identities ?? [];

    if (!data.user) {
      setAuthMessage("\uD68C\uC6D0\uAC00\uC785 \uC751\uB2F5\uC744 \uBC1B\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. Supabase Auth \uC124\uC815\uC744 \uD55C \uBC88 \uB354 \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
      return;
    }

    if (identities.length === 0) {
      setAuthMessage("\uC774\uBBF8 \uAC00\uC785\uB41C \uC774\uBA54\uC77C\uC774\uAC70\uB098, \uC774\uBA54\uC77C \uC778\uC99D \uB300\uAE30 \uC0C1\uD0DC\uC77C \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uBA54\uC77C\uD568\uC744 \uD655\uC778\uD558\uAC70\uB098 \uB85C\uADF8\uC778\uC744 \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.");
      return;
    }

    setAuthMessage(
      data.session
        ? "\uD68C\uC6D0\uAC00\uC785\uACFC \uB3D9\uC2DC\uC5D0 \uB85C\uADF8\uC778\uB418\uC5C8\uC2B5\uB2C8\uB2E4."
        : "\uD68C\uC6D0\uAC00\uC785 \uC694\uCCAD\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uC774\uBA54\uC77C \uC778\uC99D\uC774 \uD544\uC694\uD558\uBA74 \uBA54\uC77C\uD568\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694."
    );
  }

  function handleCreateProject(withSample = false) {
    const name = withSample ? T.sampleProject : `${T.newProject} ${projects.length + 1}`;
    const project = withSample ? createSampleProject() : createEmptyProject(name);
    const nextProjects = [project, ...projects];
    persistProjects(nextProjects);
    setSelectedProjectId(project.id);
    setRecommendations([]);
    setBannerMessage(`${project.name}\uB97C \uB9CC\uB4E4\uC5C8\uC2B5\uB2C8\uB2E4.`);
  }

  function updateProject(patch: Partial<ProjectRecord>) {
    if (!selectedProject) return;
    const nextProjects = projects.map((project) => project.id === selectedProject.id ? { ...project, ...patch, updatedAt: new Date().toISOString() } : project);
    persistProjects(nextProjects);
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !selectedProject) return;
    const raw = await file.text();
    updateProject({ srtText: raw });
    setBannerMessage(`${file.name} \uD30C\uC77C\uC744 \uBC18\uC601\uD588\uC2B5\uB2C8\uB2E4.`);
    event.target.value = "";
  }

  function updateProjectSrtText(value: string) {
    if (!selectedProject) return;
    setProjects((current) => current.map((project) => project.id === selectedProject.id ? { ...project, srtText: value } : project));
  }

  function applySrtText() {
    if (!selectedProject) return;
    try {
      const parsed = parseSrt(selectedProject.srtText);
      setSegments(parsed);
      setRecommendations([]);
      updateProject({ srtText: selectedProject.srtText });
      setBannerMessage(`SRT\uB97C \uBC18\uC601\uD588\uACE0 ${parsed.length}\uAC1C \uAD6C\uAC04\uC744 \uD655\uC778\uD588\uC2B5\uB2C8\uB2E4.`);
      setIsSrtModalOpen(false);
    } catch (error) {
      setBannerMessage(error instanceof Error ? error.message : "SRT \uCC98\uB9AC\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.");
    }
  }

  function handleGenerateRecommendations() {
    if (!selectedProject?.srtText) {
      setBannerMessage("\uBA3C\uC800 SRT\uB97C \uC785\uB825\uD574 \uC8FC\uC138\uC694.");
      return;
    }
    try {
      const parsed = parseSrt(selectedProject.srtText);
      setSegments(parsed);
      setRecommendations(toRecommendationState(parsed));
      setBannerMessage(`1\uCC28 \uAC80\uC218\uC6A9 \uCD94\uCC9C \uD56D\uBAA9 ${parsed.length}\uAC1C\uB97C \uB9CC\uB4E4\uC5C8\uC2B5\uB2C8\uB2E4.`);
    } catch (error) {
      setBannerMessage(error instanceof Error ? error.message : "AI \uC790\uB3D9 \uBD84\uB958\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.");
    }
  }

  function updateDecision(id: string, decision: RecommendationState["decision"]) {
    setRecommendations((current) => current.map((item) => item.id === id ? { ...item, decision, generated: decision === "excluded" ? false : item.generated } : item));
  }

  function updateRecommendation(id: string, patch: Partial<RecommendationState>) {
    setRecommendations((current) => current.map((item) => {
      if (item.id !== id) return item;
      const nextKind = patch.kind ?? item.kind;
      return { ...item, ...patch, kind: nextKind, label: kindLabelMap[nextKind] };
    }));
  }

  function handleGenerateAssets() {
    const targets = recommendations.filter((item) => item.decision === "selected");
    if (targets.length === 0) {
      setBannerMessage("\uBA3C\uC800 \uC0DD\uC131\uD560 \uCD94\uCC9C \uD56D\uBAA9\uC744 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.");
      return;
    }
    setIsGenerating(true);
    window.setTimeout(() => {
      setRecommendations((current) => current.map((item) => item.decision === "selected" ? { ...item, generated: true } : item));
      setIsGenerating(false);
      setBannerMessage(`\uC120\uD0DD\uD55C ${targets.length}\uAC1C \uAD6C\uAC04\uC5D0 \uB300\uD574 \uC0DD\uC131 \uC900\uBE44\uB97C \uB9C8\uCCE4\uC2B5\uB2C8\uB2E4.`);
    }, 900);
  }

  function handleExportXml() {
    if (!selectedProject) return;
    const selectedIds = recommendations.filter((item) => item.decision === "selected").map((item) => item.id);
    if (selectedIds.length === 0) {
      setBannerMessage("XML\uB85C \uB0B4\uBCF4\uB0BC \uD56D\uBAA9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.");
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
    setBannerMessage("Premiere XML\uC744 \uB2E4\uC6B4\uB85C\uB4DC\uD588\uC2B5\uB2C8\uB2E4.");
  }

  async function handleSignOut() {
    await signOut();
    setSelectedProjectId(null);
    setBannerMessage("\uB85C\uADF8\uC544\uC6C3\uD588\uC2B5\uB2C8\uB2E4.");
  }

  if (loadingAuth) return <div className="app-loading">{T.loading}</div>;

  if (!session) {
    return (
      <main className="auth-page">
        <section className="auth-hero">
          <p className="auth-kicker">{T.appKicker}</p>
          <h1><span className="hero-title-line">\uD504\uB85C\uC81D\uD2B8 \uB2E8\uC704 \uD3B8\uC9D1 \uC790\uB3D9\uD654</span><span className="hero-title-line">\uC6CC\uD06C\uC2A4\uD398\uC774\uC2A4</span></h1>
          <p>{T.authCopy}</p>
        </section>
        <section className="auth-card panel-surface">
          <div className="auth-tabs">
            <button className={authMode === "signin" ? "tab active" : "tab"} onClick={() => setAuthMode("signin")}>{T.signin}</button>
            <button className={authMode === "signup" ? "tab active" : "tab"} onClick={() => setAuthMode("signup")}>{T.signup}</button>
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
            <button className="button button-primary button-block" onClick={handleAuthSubmit}>{authMode === "signin" ? T.signin : T.createAccount}</button>
            <p className="auth-message">{authMessage || T.authHint}</p>
            <div className="auth-meta slim-meta">
              <span>{T.admin}: motiol_6829@naver.com</span>
              <span>{supabaseReady ? `${projectRef || "Supabase"} ${T.ready}` : `${T.settings}: ${missingEnvKeys.join(", ")}`}</span>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="workspace-shell">
      <input accept=".srt" className="hidden-input" onChange={handleFileChange} ref={fileInputRef} type="file" />
      <aside className="workspace-sidebar panel-surface">
        <div className="sidebar-top">
          <div>
            <p className="sidebar-kicker">{T.appKicker}</p>
            <h2>{T.workspace}</h2>
          </div>
          <button className="button button-primary button-block" onClick={() => handleCreateProject(false)}>{T.newProject}</button>
        </div>
        <nav className="sidebar-nav">
          <button className={!selectedProjectId ? "sidebar-link active" : "sidebar-link"} onClick={() => setSelectedProjectId(null)}>{T.home}</button>
          {isAdmin ? <Link className="sidebar-link" href="/admin">{T.adminPage}</Link> : null}
        </nav>
        <div className="sidebar-section">
          <div className="sidebar-section-header">
            <span>{T.projects}</span>
            <button className="mini-button" onClick={() => handleCreateProject(true)}>{T.sample}</button>
          </div>
          <div className="project-list">
            {projects.length > 0 ? projects.map((project) => (
              <button className={project.id === selectedProjectId ? "project-link active" : "project-link"} key={project.id} onClick={() => setSelectedProjectId(project.id)}>
                <strong>{project.name}</strong>
                <span>{formatDate(project.updatedAt)}</span>
              </button>
            )) : <div className="sidebar-empty">{T.noProjects}</div>}
          </div>
        </div>
        <div className="sidebar-footer panel-surface">
          <strong>{session.user.email}</strong>
          <span>{supabaseReady ? `${projectRef} ${T.ready}` : "Supabase settings required"}</span>
          <button className="button button-secondary button-block" onClick={handleSignOut}>{T.logout}</button>
        </div>
      </aside>
      <section className="workspace-main">
        <div className="topbar">
          <div>
            <p className="section-kicker">Workspace</p>
            <h1 className="topbar-title">{selectedProject ? selectedProject.name : T.projectHome}</h1>
          </div>
          <button className="icon-button" aria-label={T.settings} onClick={() => setIsSettingsOpen(true)}><span>+</span><small>{T.settings}</small></button>
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
                <button className="button button-primary" onClick={() => handleCreateProject(false)}>{T.newProject}</button>
                <button className="button button-secondary" onClick={() => handleCreateProject(true)}>{T.sampleProject}</button>
              </div>
            </section>
            <section className="dashboard-grid compact-grid">
              <article className="dashboard-card panel-surface"><p className="section-kicker">\uAC1C\uC694</p><h3>{T.allProjects}</h3><strong>{projects.length}\uAC1C</strong></article>
              <article className="dashboard-card panel-surface"><p className="section-kicker">\uACC4\uC815</p><h3>{T.currentUser}</h3><strong>{session.user.email}</strong></article>
              <article className="dashboard-card panel-surface"><p className="section-kicker">Supabase</p><h3>{T.connectionState}</h3><strong>{supabaseReady ? T.ready : T.checkNeeded}</strong></article>
            </section>
          </div>
        ) : (
          <div className="project-workboard">
            <div className="project-main-column">
              <section className="project-header panel-surface">
                <div>
                  <p className="section-kicker">{T.selectedProject}</p>
                  <input className="project-title-input" value={selectedProject.name} onChange={(event) => updateProject({ name: event.target.value })} />
                  <p className="project-subcopy">{T.recentUpdate} {formatDate(selectedProject.updatedAt)}</p>
                </div>
                <div className="project-header-stats compact-stats">
                  <div><span>{T.segmentCount}</span><strong>{segments.length}</strong></div>
                  <div><span>{T.selectedCount}</span><strong>{selectedCount}</strong></div>
                  <div><span>{T.generatedCount}</span><strong>{generatedCount}</strong></div>
                </div>
              </section>
              <section className="project-banner panel-surface"><strong>{T.currentStatus}</strong><p>{bannerMessage}</p></section>
              <section className="workflow-section panel-surface">
                <div className="section-header">
                  <div><p className="section-kicker">{T.srtStep}</p><h2>{T.srtInput}</h2></div>
                  <div className="inline-actions">
                    <button className="button button-secondary" onClick={() => fileInputRef.current?.click()}>{T.fileUpload}</button>
                    <button className="button button-primary" onClick={() => setIsSrtModalOpen(true)}>{T.openSrt}</button>
                  </div>
                </div>
                <div className="compact-srt-entry">
                  <strong>{selectedProject.srtText ? T.srtConnected : T.noSrt}</strong>
                  <p>{selectedProject.srtText ? `${segments.length}\uAC1C \uAD6C\uAC04\uC774 \uD655\uC778\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uD544\uC694\uD558\uBA74 \uD31D\uC5C5\uC5D0\uC11C \uB0B4\uC6A9\uC744 \uC218\uC815\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.` : `SRT\uB97C \uBD99\uC5EC\uB123\uAC70\uB098 \uD30C\uC77C\uB85C \uC62C\uB9B0 \uB4A4 \uB2E8\uACC4\uBCC4 \uAC80\uC218\uB85C \uB118\uC5B4\uAC00 \uC8FC\uC138\uC694.`}</p>
                </div>
              </section>
              <section className="workflow-section panel-surface">
                <div className="section-header">
                  <div><p className="section-kicker">{T.firstReviewStep}</p><h2>{T.firstReview}</h2></div>
                  <button className="button button-primary" onClick={handleGenerateRecommendations}>{T.autoClassify}</button>
                </div>
                <div className="segment-list">
                  {segments.length > 0 ? segments.map((segment) => (
                    <div className="segment-card segment-card-wide" key={segment.id}>
                      <div className="segment-index-row"><strong>{segment.id}</strong><span>{segment.startTimecode} - {segment.endTimecode}</span></div>
                      <p>{segment.text}</p>
                    </div>
                  )) : <div className="empty-inline">SRT\uB97C \uC5F0\uACB0\uD558\uBA74 \uC774\uACF3\uC5D0 \uD0C0\uC784\uCF54\uB4DC \uAD6C\uAC04\uC774 \uD45C\uC2DC\uB429\uB2C8\uB2E4.</div>}
                </div>
              </section>
              <section className="workflow-section panel-surface">
                <div className="section-header"><div><p className="section-kicker">{T.generationOptions}</p><h2>{T.generationOptionsTitle}</h2></div></div>
                <div className="options-grid">
                  <label className="settings-block"><span>{T.perSegmentVariants}</span><input value={variantsPerSegment} onChange={(event) => setVariantsPerSegment(event.target.value)} /><small>\uC608: 3\uAC1C\uB85C \uB450\uBA74 \uAC19\uC740 \uBB38\uC7A5\uC5D0 \uB300\uD55C \uD6C4\uBCF4 \uACB0\uACFC\uBB3C\uC774 3\uAC1C \uB808\uC774\uC5B4\uB85C XML\uC5D0 \uB4E4\uC5B4\uAC11\uB2C8\uB2E4.</small></label>
                  <label className="settings-block"><span>{T.aspectRatio}</span><input value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value)} /><small>\uC608: 16:9, 9:16, 1:1\uCC98\uB7FC \uC6D0\uD558\uB294 \uBE44\uC728\uC744 \uC9C1\uC811 \uC801\uC744 \uC218 \uC788\uC2B5\uB2C8\uB2E4.</small></label>
                </div>
              </section>
              <section className="workflow-section panel-surface"><div className="section-header"><div><p className="section-kicker">{T.secondReviewStep}</p><h2>{T.secondReview}</h2></div></div><div className="stage-placeholder"><strong>MOGRT \uC790\uB9C9 \uD22C\uC785 \uAD6C\uAC04 \uCD94\uCC9C \uB2E8\uACC4</strong><p>\uD604\uC7AC\uB294 \uC774\uBBF8\uC9C0\uC640 \uC601\uC0C1 \uD6C4\uBCF4\uB97C \uBA3C\uC800 \uC815\uB9AC\uD558\uB294 \uB2E8\uACC4\uC785\uB2C8\uB2E4.</p></div></section>
              <section className="workflow-section panel-surface"><div className="section-header"><div><p className="section-kicker">{T.finalPrepStep}</p><h2>{T.finalPrep}</h2></div></div><div className="stage-placeholder"><strong>\uC624\uB978\uCABD \uAC80\uC218\uD310\uC5D0\uC11C \uD56D\uBAA9\uBCC4 \uD615\uC2DD\uACFC \uC124\uBA85\uC744 \uAC1C\uBCC4 \uC218\uC815\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.</strong><p>\uB300\uBCF8 \uBB38\uC7A5\uACFC \uCD94\uCC9C \uC124\uBA85\uC758 \uBC30\uACBD\uC744 \uBD84\uB9AC\uD574 \uB450\uC5C8\uC2B5\uB2C8\uB2E4.</p></div></section>
            </div>
            <aside className="review-column panel-surface">
              <div className="section-header review-header">
                <div><p className="section-kicker">{T.finalReviewStep}</p><h2>{T.finalReview}</h2></div>
                <div className="inline-actions"><button className="button button-secondary" disabled={isGenerating} onClick={handleGenerateAssets}>{isGenerating ? T.generating : T.generateAll}</button><button className="button button-primary" onClick={handleExportXml}>{T.downloadXml}</button></div>
              </div>
              {reviewItems.length > 0 ? <div className="review-list">{reviewItems.map((item) => (
                <article className="recommendation-panel recommendation-panel-strong" key={item.id}>
                  <div className="recommendation-topline"><span className={`badge ${kindClassMap[item.kind]}`}>{item.label}</span><span>{item.timecode}</span></div>
                  <h3>{item.title}</h3>
                  <div className="recommendation-body-grid">
                    <div className="source-block"><span className="meta-label">{T.sourceSentence}</span><p>{segments.find((segment) => segment.id === item.segmentId)?.text ?? item.title}</p></div>
                    <div className="recommend-block">
                      <span className="meta-label">{T.recommendationDesc}</span>
                      <label className="settings-block compact-field"><span>{T.kind}</span><select value={item.kind} onChange={(event) => updateRecommendation(item.id, { kind: event.target.value as RecommendationKind })}><option value="image_real">{T.realImage}</option><option value="image_illustration">{T.illustration}</option><option value="video">{T.video}</option></select></label>
                      <label className="settings-block compact-field"><span>{T.visualCue}</span><textarea className="inline-textarea" value={item.visualCue} onChange={(event) => updateRecommendation(item.id, { visualCue: event.target.value })} /></label>
                      <label className="settings-block compact-field"><span>{T.prompt}</span><textarea className="inline-textarea" value={item.prompt} onChange={(event) => updateRecommendation(item.id, { prompt: event.target.value })} /></label>
                    </div>
                  </div>
                  <div className="recommendation-actions"><button className={item.decision === "selected" ? "button button-primary" : "button button-secondary"} onClick={() => updateDecision(item.id, item.decision === "selected" ? "pending" : "selected")}>{item.decision === "selected" ? T.selected : T.select}</button><button className="button" onClick={() => updateDecision(item.id, "excluded")}>{T.exclude}</button></div>
                  <div className="recommendation-footer"><span>{item.generated ? T.readyToGenerate : T.beforeGeneration}</span><span>{T.segmentLabel} {item.segmentId}</span></div>
                </article>
              ))}</div> : <div className="review-empty"><strong>{T.recommendationEmpty}</strong><p>`{T.autoClassify}` \uBC84\uD2BC\uC744 \uB204\uB974\uBA74 \uC774 \uC601\uC5ED\uC5D0 \uACB0\uACFC\uAC00 \uCC44\uC6CC\uC9D1\uB2C8\uB2E4.</p><p>\uD604\uC7AC \uB2E8\uACC4\uC5D0\uC11C\uB294 \uC774\uBBF8\uC9C0\uC640 \uC601\uC0C1 \uD615\uC2DD\uB9CC \uB2E4\uB8E8\uACE0, MOGRT \uCD94\uCC9C\uC740 \uB2E4\uC74C \uAC80\uC218 \uB2E8\uACC4\uB85C \uBD84\uB9AC\uB429\uB2C8\uB2E4.</p></div>}
            </aside>
          </div>
        )}
      </section>
      {isSettingsOpen ? <div className="modal-backdrop" onClick={() => setIsSettingsOpen(false)}><div className="modal-panel panel-surface" onClick={(event) => event.stopPropagation()}><div className="modal-header"><div><p className="section-kicker">{T.settings}</p><h2>{T.providerKeys}</h2></div><button className="button button-secondary" onClick={() => setIsSettingsOpen(false)}>{T.close}</button></div><div className="settings-grid single-column-grid">{mockApiKeyFields.map((field) => <label className="settings-block" key={field.id}><span>{field.label}</span><input type="password" placeholder={field.placeholder} value={apiKeys[field.id] ?? ""} onChange={(event) => setApiKeys((current) => ({ ...current, [field.id]: event.target.value }))} /><small>{field.help}</small></label>)}</div><div className="modal-footer"><span>{supabaseReady ? `${projectRef} ${T.ready}` : "Supabase settings required"}</span><button className="button button-primary" onClick={() => setIsSettingsOpen(false)}>{T.save}</button></div></div></div> : null}
      {isSrtModalOpen && selectedProject ? <div className="modal-backdrop" onClick={() => setIsSrtModalOpen(false)}><div className="modal-panel modal-panel-wide panel-surface" onClick={(event) => event.stopPropagation()}><div className="modal-header"><div><p className="section-kicker">{T.srtInput}</p><h2>{selectedProject.name}</h2></div><div className="inline-actions"><button className="button button-secondary" onClick={() => fileInputRef.current?.click()}>{T.upload}</button><button className="button button-primary" onClick={applySrtText}>{T.save}</button></div></div><textarea className="editor-textarea editor-textarea-large" placeholder="SRT contents" value={selectedProject.srtText} onChange={(event) => updateProjectSrtText(event.target.value)} /></div></div> : null}
    </main>
  );
}