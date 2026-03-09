import { mockApiKeyFields, mockRecommendations, mockSrtRows } from "../lib/mock-data";

const statusSteps = [
  "1. SRT 업로드",
  "2. 소재 추천 생성",
  "3. 이미지/영상 생성",
  "4. Premiere XML 내보내기"
];

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">Premiere Automation MVP</p>
        <h1>SRT에서 소재 추천, 생성, XML export까지 한 번에</h1>
        <p className="hero-copy">
          일반 자막은 SRT 그대로 유지하고, 포인트 자막과 자료 화면은 타임코드 기준으로 추천한 뒤
          이미지와 영상을 생성해 Premiere용 결과물로 묶어내는 운영 화면입니다.
        </p>
      </section>

      <section className="grid">
        <article className="panel panel-large">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Workspace</p>
              <h2>SRT 업로드와 타임라인 미리보기</h2>
            </div>
            <button className="button button-primary">SRT 업로드</button>
          </div>

          <div className="timeline-status">
            {statusSteps.map((step, index) => (
              <span className={index < 2 ? "chip active" : "chip"} key={step}>
                {step}
              </span>
            ))}
          </div>

          <div className="srt-table">
            <div className="srt-row srt-head">
              <span>ID</span>
              <span>구간</span>
              <span>텍스트</span>
              <span>추천 액션</span>
            </div>
            {mockSrtRows.map((row) => (
              <div className="srt-row" key={row.id}>
                <span>{row.id}</span>
                <span>{row.range}</span>
                <span>{row.text}</span>
                <span>{row.action}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Analysis</p>
              <h2>추천 소재 리스트</h2>
            </div>
            <button className="button">추천 다시 만들기</button>
          </div>

          <div className="recommendation-list">
            {mockRecommendations.map((item) => (
              <div className="recommendation-card" key={item.id}>
                <div className="recommendation-topline">
                  <span className={`badge badge-${item.type}`}>{item.label}</span>
                  <span>{item.timecode}</span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.prompt}</p>
                <div className="recommendation-actions">
                  <button className="button button-primary">선택</button>
                  <button className="button">제외</button>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Settings</p>
              <h2>사용자별 API 키</h2>
            </div>
            <button className="button">암호화 저장</button>
          </div>

          <div className="settings-list">
            {mockApiKeyFields.map((field) => (
              <label className="settings-field" key={field.id}>
                <span>{field.label}</span>
                <input placeholder={field.placeholder} type="password" />
                <small>{field.help}</small>
              </label>
            ))}
          </div>
        </article>

        <article className="panel panel-wide">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Export</p>
              <h2>MOGRT와 XML 패키징 전략</h2>
            </div>
            <button className="button button-primary">XML 생성 시작</button>
          </div>

          <div className="export-grid">
            <div className="export-card">
              <h3>안정형</h3>
              <p>웹앱이 XML과 생성 미디어를 묶어 ZIP으로 내보내고, Premiere에서 import 합니다.</p>
            </div>
            <div className="export-card">
              <h3>권장형</h3>
              <p>웹앱은 작업 지시서와 미디어를 만들고, UXP 플러그인이 MOGRT를 타임라인에 자동 삽입합니다.</p>
            </div>
            <div className="export-card">
              <h3>MOGRT 처리</h3>
              <p>사전 등록한 MOGRT 라이브러리와 타임코드 매핑 규칙을 기반으로 추천 위치에 자동 배치합니다.</p>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
