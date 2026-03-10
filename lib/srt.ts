export interface SubtitleSegment {
  id: string;
  startMs: number;
  endMs: number;
  startTimecode: string;
  endTimecode: string;
  text: string;
}

export type RecommendationKind = "image_real" | "image_illustration" | "video";

export interface RecommendationDraft {
  id: string;
  segmentId: string;
  kind: RecommendationKind;
  label: string;
  title: string;
  prompt: string;
  visualCue: string;
  reason: string;
  timecode: string;
}

export interface RecommendationSettings {
  frequencySeconds: number;
}

export interface ExportSettings {
  variantsPerSegment: number;
  aspectRatio: string;
}

const FPS = 30;
const timecodePattern = /^(\d{2}):(\d{2}):(\d{2})[,\.](\d{3})$/;

function timecodeToMs(value: string) {
  const match = value.trim().match(timecodePattern);

  if (!match) {
    throw new Error(`잘못된 SRT 타임코드입니다: ${value}`);
  }

  const [, hh, mm, ss, ms] = match;
  return Number(hh) * 3600000 + Number(mm) * 60000 + Number(ss) * 1000 + Number(ms);
}

function msToTimecode(value: number) {
  const hours = Math.floor(value / 3600000).toString().padStart(2, "0");
  const minutes = Math.floor((value % 3600000) / 60000).toString().padStart(2, "0");
  const seconds = Math.floor((value % 60000) / 1000).toString().padStart(2, "0");
  const milliseconds = Math.floor(value % 1000).toString().padStart(3, "0");

  return `${hours}:${minutes}:${seconds},${milliseconds}`;
}

function msToFrames(value: number) {
  return Math.max(0, Math.round((value / 1000) * FPS));
}

export function parseSrt(input: string) {
  const normalized = input.replace(/\r/g, "").trim();

  if (!normalized) {
    return [] as SubtitleSegment[];
  }

  return normalized.split(/\n\n+/).map((block, index) => {
    const lines = block.split("\n").filter(Boolean);
    const hasNumericIndex = /^\d+$/.test(lines[0] ?? "");
    const timecodeLine = hasNumericIndex ? lines[1] : lines[0];
    const textLines = hasNumericIndex ? lines.slice(2) : lines.slice(1);
    const [start, end] = (timecodeLine ?? "").split(/\s+-->\s+/);
    const startMs = timecodeToMs(start);
    const endMs = timecodeToMs(end);

    return {
      id: String(index + 1).padStart(3, "0"),
      startMs,
      endMs,
      startTimecode: msToTimecode(startMs),
      endTimecode: msToTimecode(endMs),
      text: textLines.join(" ").trim()
    };
  });
}

function pickRecommendationKind(text: string, index: number): RecommendationKind {
  if (/(비교|구조|정리|일러스트|도식|설명도)/.test(text)) {
    return "image_illustration";
  }

  if (/(장면|실제|시연|결과|움직임|모션|변화|보여)/.test(text)) {
    return "video";
  }

  if (/(사람|오피스|현실|촬영|손|표정|환경)/.test(text) || index % 2 === 0) {
    return "image_real";
  }

  return "video";
}

function buildVisualCue(text: string, kind: RecommendationKind) {
  if (kind === "image_illustration") {
    return `핵심 개념 '${text}'를 한 장의 구조도나 카드형 인포그래픽으로 보여주는 장면`;
  }

  if (kind === "video") {
    return `문장 '${text}'를 직관적으로 이해할 수 있는 움직임 있는 짧은 장면`;
  }

  return `문장 '${text}'를 현실적인 인물, 공간, 손동작, 표정으로 전달하는 실사 장면`;
}

function buildPrompt(text: string, kind: RecommendationKind, visualCue: string) {
  if (kind === "image_illustration") {
    return `설명형 일러스트 장면. ${visualCue}. 군더더기 없는 구성, 정보 전달 우선, 텍스트는 최소화.`;
  }

  if (kind === "video") {
    return `짧은 영상 장면. ${visualCue}. 4초 내외, 프레임 안정성 우선, 핵심 메시지가 바로 읽히는 연출.`;
  }

  return `실사 이미지 장면. ${visualCue}. 한국형 오피스 또는 생활 공간, 자연광 느낌, 과장 없는 현실적 화면.`;
}

function kindMeta(kind: RecommendationKind) {
  switch (kind) {
    case "image_real":
      return { label: "실사 형식", reason: "현실감 있는 보조 장면이 문장의 설득력을 높입니다." };
    case "image_illustration":
      return { label: "일러스트 형식", reason: "복잡한 개념을 한 장면으로 정리하기 좋습니다." };
    case "video":
      return { label: "영상 형식", reason: "변화가 느껴지는 문장은 짧은 영상이 더 자연스럽습니다." };
    default:
      return { label: "자료 형식", reason: "보조 자료를 추천합니다." };
  }
}

export function filterSegmentsByFrequency(segments: SubtitleSegment[], settings?: RecommendationSettings) {
  const minGapMs = Math.max(1, settings?.frequencySeconds ?? 5) * 1000;
  let lastSelectedStart = -Infinity;

  return segments.filter((segment) => {
    if (segment.startMs - lastSelectedStart < minGapMs) {
      return false;
    }

    lastSelectedStart = segment.startMs;
    return true;
  });
}

export function buildRecommendations(segments: SubtitleSegment[], settings?: RecommendationSettings) {
  const minGapMs = Math.max(1, settings?.frequencySeconds ?? 5) * 1000;
  let lastSelectedStart = -Infinity;

  return segments.flatMap((segment, index) => {
    if (segment.startMs - lastSelectedStart < minGapMs) {
      return [] as RecommendationDraft[];
    }

    const kind = pickRecommendationKind(segment.text, index);
    const meta = kindMeta(kind);
    const visualCue = buildVisualCue(segment.text, kind);
    lastSelectedStart = segment.startMs;

    return [
      {
        id: `rec-${segment.id}`,
        segmentId: segment.id,
        kind,
        label: meta.label,
        title: segment.text.length > 44 ? `${segment.text.slice(0, 44)}...` : segment.text,
        prompt: buildPrompt(segment.text, kind, visualCue),
        visualCue,
        reason: meta.reason,
        timecode: segment.startTimecode
      } satisfies RecommendationDraft
    ];
  });
}

export function createXmlExport(
  segments: SubtitleSegment[],
  selectedIds: string[],
  recommendations: RecommendationDraft[],
  settings: ExportSettings
) {
  const selectedMap = new Map(recommendations.filter((item) => selectedIds.includes(item.id)).map((item) => [item.segmentId, item]));
  const endFrame = msToFrames(segments[segments.length - 1]?.endMs ?? 1000);
  const markers = segments
    .map((segment) => {
      const recommendation = selectedMap.get(segment.id);
      if (!recommendation) {
        return "";
      }

      const inFrame = msToFrames(segment.startMs);
      const outFrame = Math.max(inFrame + 1, msToFrames(segment.endMs));
      const commentLines = [
        `kind=${recommendation.kind}`,
        `label=${recommendation.label}`,
        `variants=${Math.max(1, settings.variantsPerSegment || 1)}`,
        `aspectRatio=${settings.aspectRatio}`,
        `visualCue=${recommendation.visualCue}`,
        `prompt=${recommendation.prompt}`
      ].join(" | ");

      return `      <marker>\n        <name>${escapeXml(recommendation.title)}</name>\n        <comment>${escapeXml(commentLines)}</comment>\n        <in>${inFrame}</in>\n        <out>${outFrame}</out>\n      </marker>`;
    })
    .filter(Boolean)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<xmeml version="5">\n  <sequence id="sequence-1">\n    <name>Premiere Automation Export</name>\n    <duration>${Math.max(1, endFrame)}</duration>\n    <rate>\n      <timebase>${FPS}</timebase>\n      <ntsc>FALSE</ntsc>\n    </rate>\n    <timecode>\n      <rate>\n        <timebase>${FPS}</timebase>\n        <ntsc>FALSE</ntsc>\n      </rate>\n      <string>00:00:00:00</string>\n      <frame>0</frame>\n      <displayformat>NDF</displayformat>\n    </timecode>\n    <media>\n      <video>\n        <format>\n          <samplecharacteristics>\n            <width>1920</width>\n            <height>1080</height>\n            <anamorphic>FALSE</anamorphic>\n            <pixelaspectratio>square</pixelaspectratio>\n            <rate>\n              <timebase>${FPS}</timebase>\n              <ntsc>FALSE</ntsc>\n            </rate>\n          </samplecharacteristics>\n        </format>\n        <track />\n      </video>\n      <audio>\n        <track />\n      </audio>\n    </media>\n${markers ? `    <markers>\n${markers}\n    </markers>\n` : ""}  </sequence>\n</xmeml>`;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

