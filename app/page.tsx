"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";
import { getMissingPublicEnvKeys, getSupabaseBrowserConfig, getSupabaseProjectRefFromUrl } from "../lib/env";
import { mockApiKeyFields, sampleSrt } from "../lib/mock-data";
import {
  buildRecommendations,
  createXmlExport,
  parseSrt,
  RecommendationDraft,
  RecommendationKind,
  SubtitleSegment
} from "../lib/srt";

type RecommendationState = RecommendationDraft & {
  decision: "selected" | "excluded" | "pending";
  generated: boolean;
};

const statusSteps = [
  "1. SRT 업로드",
  "2. 소재 추천 생성",
  "3. 이미지/영상 생성",
  "4. Premiere XML 내보내기"
];

const kindClassMap: Record<RecommendationKind, string> = {
  image_real: "badge-image",
  image_illustration: "badge-illustration",
  video: "badge-video",
  point_caption: "badge-point"
};

const sampleProjectName = "episode_01_auto_build";

export default function HomePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const missingEnvKeys = getMissingPublicEnvKeys();
  const supabaseConfig = getSupabaseBrowserConfig();
  const projectRef = getSupabaseProjectRefFromUrl(supabaseConfig.url);
  const supabaseReady = missingEnvKeys.length === 0;

  const [projectName, setProjectName] = useState(sampleProjectName);
  const [srtText, setSrtText] = useState(sampleSrt);
  const [segments, setSegments] = useState<SubtitleSegment[]>(() => parseSrt(sampleSrt));
  const [recommendations, setRecommendations] = useState<RecommendationState[]>(() =>
    buildRecommendations(parseSrt(sampleSrt)).map((item) => ({ ...item, decision: "pending", generated: false }))
  );
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [bannerMessage, setBannerMessage] = useState("샘플 SRT가 로드되어 있습니다. 파일을 올리면 바로 교체됩니다.");
  const [isGenerating, setIsGenerating] = useState(false);

  const selectedCount = useMemo(
    () => recommendations.filter((item) => item.decision === "selected").length,
    [recommendations]
  );
  const generatedCount = useMemo(
    () => recommendations.filter((item) => item.generated).length,
    [recommendations]
  );
  const currentStep = useMemo(() => {
    if (generatedCount > 0) {
      return 4;
    }

    if (selectedCount > 0 || recommendations.length > 0) {
      return 3;
    }

    if (segments.length > 0) {
      return 2;
    }

    return 1;
  }, [generatedCount, recommendations.length, segments.length, selectedCount]);

  const activeRecommendations = recommendations.filter((item) => item.decision !== "excluded");

  function applySrt(raw: string, sourceLabel: string) {
    try {
      const parsed = parseSrt(raw);

      if (parsed.length === 0) {
        setBannerMessage("SRT가 비어 있어서 반영하지 못했습니다.");
        return;
      }

      setSrtText(raw);
      setSegments(parsed);
      setRecommendations([]);
      setBannerMessage(`${sourceLabel} SRT ${parsed.length}개 구간을 불러왔습니다.`);
    } catch (error) {
      setBannerMessage(error instanceof Error ? error.message : "SRT 파싱에 실패했습니다.");
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const raw = await file.text();
    applySrt(raw, file.name);
    event.target.value = "";
  }

  function handleGenerateRecommendations() {
    if (segments.length === 0) {
      setBannerMessage("먼저 SRT를 업로드하거나 입력해 주세요.");
      return;
    }

    const nextRecommendations: RecommendationState[] = buildRecommendations(segments).map((item) => ({
      ...item,
      decision: item.kind === "point_caption" ? "selected" : "pending",
      generated: false
    }));

    setRecommendations(nextRecommendations);
    setBannerMessage(`추천 소재 ${nextRecommendations.length}개를 생성했습니다.`);
  }

  function updateDecision(id: string, decision: RecommendationState["decision"]) {
    setRecommendations((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              decision,
              generated: decision === "excluded" ? false : item.generated
            }
          : item
      )
    );
  }

  function handleGenerateAssets() {
    const targets = recommendations.filter((item) => item.decision === "selected");

    if (targets.length === 0) {
      setBannerMessage("생성할 추천 항목을 먼저 선택해 주세요.");
      return;
    }

    setIsGenerating(true);
    window.setTimeout(() => {
      setRecommendations((current) =>
        current.map((item) =>
          item.decision === "selected"
            ? {
                ...item,
                generated: true
              }
            : item
        )
      );
      setBannerMessage(`선택한 ${targets.length}개 항목에 대한 생성 작업을 준비했습니다.`);
      setIsGenerating(false);
    }, 900);
  }

  function handleExportXml() {
    const selectedIds = recommendations
      .filter((item) => item.decision === "selected")
      .map((item) => item.id);

    if (selectedIds.length === 0) {
      setBannerMessage("XML로 내보낼 추천 항목을 먼저 선택해 주세요.");
      return;
    }

    const xml = createXmlExport(segments, selectedIds, recommendations);
    const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${projectName || "premiere-automation"}.xml`;
    link.click();
    URL.revokeObjectURL(url);
    setBannerMessage("Premiere용 XML을 다운로드했습니다.");
  }

  return (
    <main className="page-shell">
      <section className="hero hero-toss">
        <div className="hero-copy-wrap">
          <p className="eyebrow">Premiere Automation</p>
          <h1>SRT 업로드부터 추천, 생성, XML까지 실제로 굴러가게</h1>
          <p className="hero-copy">
            추천 버튼을 누르면 구간별 실사, 일러스트, 영상, 포인트 자막 후보가 생성되고,
            선택한 항목만 생성 단계로 넘긴 뒤 XML로 바로 내보낼 수 있습니다.
          </p>
          <div className="hero-actions">
            <button className="button button-primary button-large" onClick={() => fileInputRef.current?.click()}>
              SRT 올리기
            </button>
            <button className="button button-secondary button-large" onClick={handleGenerateRecommendations}>
              추천 생성
            </button>
          </div>
        </div>

        <div className="hero-summary card-float">
          <div>
            <span className="summary-label">프로젝트</span>
            <strong>{projectName}</strong>
          </div>
          <div>
            <span className="summary-label">SRT 구간</span>
            <strong>{segments.length}개</strong>
          </div>
          <div>
            <span className="summary-label">선택 항목</span>
            <strong>{selectedCount}개</strong>
          </div>
          <div>
            <span className="summary-label">생성 상태</span>
            <strong>{generatedCount}개 완료</strong>
          </div>
        </div>
      </section>

      <input accept=".srt" className="hidden-input" onChange={handleFileChange} ref={fileInputRef} type="file" />

      <section className="banner-row">
        <div className="banner-card">
          <strong>현재 상태</strong>
          <p>{bannerMessage}</p>
        </div>
        <div className={supabaseReady ? "banner-card banner-card-ready" : "banner-card banner-card-warning"}>
          <strong>Supabase</strong>
          <p>
            {supabaseReady ? `${projectRef} 연결 준비 완료` : `누락된 env: ${missingEnvKeys.join(", ")}`}
          </p>
        </div>
      </section>

      <section className="grid grid-toss">
        <article className="panel panel-large">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Workspace</p>
              <h2>SRT 업로드와 타임라인 미리보기</h2>
            </div>
            <div className="inline-actions">
              <button className="button button-secondary" onClick={() => applySrt(sampleSrt, "샘플")}>샘플 불러오기</button>
              <button className="button button-primary" onClick={() => fileInputRef.current?.click()}>SRT 업로드</button>
            </div>
          </div>

          <label className="settings-field">
            <span>프로젝트 이름</span>
            <input onChange={(event) => setProjectName(event.target.value)} value={projectName} />
          </label>

          <div className="timeline-status">
            {statusSteps.map((step, index) => (
              <span className={index + 1 <= currentStep ? "chip active" : "chip"} key={step}>
                {step}
              </span>
            ))}
          </div>

          <label className="settings-field">
            <span>SRT 원문</span>
            <textarea className="srt-textarea" onChange={(event) => setSrtText(event.target.value)} value={srtText} />
          </label>

          <div className="inline-actions inline-actions-spread">
            <button className="button button-secondary" onClick={() => applySrt(srtText, "직접 입력")}>SRT 반영</button>
            <button className="button button-primary" onClick={handleGenerateRecommendations}>소재 추천 생성</button>
          </div>

          <div className="srt-table">
            <div className="srt-row srt-head">
              <span>ID</span>
              <span>구간</span>
              <span>텍스트</span>
              <span>추천 액션</span>
            </div>
            {segments.map((row) => {
              const recommendation = recommendations.find((item) => item.segmentId === row.id);
              return (
                <div className="srt-row" key={row.id}>
                  <span>{row.id}</span>
                  <span>
                    {row.startTimecode}
                    <br />
                    {row.endTimecode}
                  </span>
                  <span>{row.text}</span>
                  <span>{recommendation ? recommendation.label : "추천 대기"}</span>
                </div>
              );
            })}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Analysis</p>
              <h2>추천 소재 리스트</h2>
            </div>
            <button className="button button-secondary" onClick={handleGenerateRecommendations}>추천 다시 만들기</button>
          </div>

          <div className="recommendation-list">
            {activeRecommendations.length > 0 ? (
              activeRecommendations.map((item) => (
                <div className="recommendation-card" key={item.id}>
                  <div className="recommendation-topline">
                    <span className={`badge ${kindClassMap[item.kind]}`}>{item.label}</span>
                    <span>{item.timecode}</span>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.prompt}</p>
                  <small>{item.reason}</small>
                  <div className="recommendation-actions">
                    <button
                      className={item.decision === "selected" ? "button button-primary" : "button button-secondary"}
                      onClick={() => updateDecision(item.id, item.decision === "selected" ? "pending" : "selected")}
                    >
                      {item.decision === "selected" ? "선택됨" : "선택"}
                    </button>
                    <button className="button" onClick={() => updateDecision(item.id, "excluded")}>제외</button>
                  </div>
                  <div className="recommendation-footer">
                    <span>{item.generated ? "생성 준비 완료" : "생성 전"}</span>
                    <span>세그먼트 {item.segmentId}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-card">
                <strong>추천 결과가 아직 없습니다.</strong>
                <p>SRT를 반영한 뒤 `소재 추천 생성` 버튼을 눌러주세요.</p>
              </div>
            )}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Settings</p>
              <h2>사용자별 API 키</h2>
            </div>
            <button className="button button-secondary">암호화 저장 예정</button>
          </div>

          <div className="settings-list">
            {mockApiKeyFields.map((field) => (
              <label className="settings-field" key={field.id}>
                <span>{field.label}</span>
                <input
                  onChange={(event) =>
                    setApiKeys((current) => ({
                      ...current,
                      [field.id]: event.target.value
                    }))
                  }
                  placeholder={field.placeholder}
                  type="password"
                  value={apiKeys[field.id] ?? ""}
                />
                <small>{field.help}</small>
              </label>
            ))}
          </div>
        </article>

        <article className="panel panel-wide">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Run</p>
              <h2>생성과 XML export</h2>
            </div>
            <div className="inline-actions">
              <button className="button button-secondary" disabled={isGenerating} onClick={handleGenerateAssets}>
                {isGenerating ? "생성 준비 중..." : "이미지/영상 생성"}
              </button>
              <button className="button button-primary" onClick={handleExportXml}>Premiere XML 다운로드</button>
            </div>
          </div>

          <div className="export-grid">
            <div className="export-card">
              <h3>선택된 추천</h3>
              <p>{selectedCount}개 항목이 다음 생성 배치에 포함됩니다.</p>
            </div>
            <div className="export-card">
              <h3>생성 완료</h3>
              <p>{generatedCount}개 항목이 생성 준비 완료 상태입니다.</p>
            </div>
            <div className="export-card">
              <h3>MOGRT 전략</h3>
              <p>포인트 자막은 현재 XML에 태그로 포함되며, 이후 UXP 플러그인과 연결할 수 있습니다.</p>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}