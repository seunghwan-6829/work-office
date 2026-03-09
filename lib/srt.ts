export interface SubtitleSegment {
  id: string;
  startMs: number;
  endMs: number;
  startTimecode: string;
  endTimecode: string;
  text: string;
}

export type RecommendationKind = "image_real" | "image_illustration" | "video" | "point_caption";

export interface RecommendationDraft {
  id: string;
  segmentId: string;
  kind: RecommendationKind;
  label: string;
  title: string;
  prompt: string;
  reason: string;
  timecode: string;
}

const timecodePattern = /^(\d{2}):(\d{2}):(\d{2})[,\.](\d{3})$/;

function timecodeToMs(value: string) {
  const match = value.trim().match(timecodePattern);

  if (!match) {
    throw new Error(`Invalid SRT timecode: ${value}`);
  }

  const [, hh, mm, ss, ms] = match;
  return Number(hh) * 3600000 + Number(mm) * 60000 + Number(ss) * 1000 + Number(ms);
}

function msToTimecode(value: number) {
  const hours = Math.floor(value / 3600000)
    .toString()
    .padStart(2, "0");
  const minutes = Math.floor((value % 3600000) / 60000)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor((value % 60000) / 1000)
    .toString()
    .padStart(2, "0");
  const milliseconds = Math.floor(value % 1000)
    .toString()
    .padStart(3, "0");

  return `${hours}:${minutes}:${seconds},${milliseconds}`;
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
  const lower = text.toLowerCase();

  if (/(그래프|비교|구조|정리|일러스트|도식)/.test(text)) {
    return "image_illustration";
  }

  if (/(장면|움직|실제|시연|결과|영상|모션)/.test(text)) {
    return "video";
  }

  if (/(강조|핵심|포인트|중요|숫자|효율|시간)/.test(text) || index % 3 === 0) {
    return "point_caption";
  }

  if (/(사람|현실|촬영|오피스|스튜디오|실사)/.test(text) || index % 2 === 0) {
    return "image_real";
  }

  return "video";
}

function buildPrompt(text: string, kind: RecommendationKind) {
  if (kind === "image_illustration") {
    return `깔끔한 인포그래픽 일러스트, 토스 스타일의 명료한 카드형 레이아웃, 핵심 문장: ${text}`;
  }

  if (kind === "video") {
    return `짧은 시네마틱 모션 클립, 4초, 핵심 장면은 '${text}'를 직관적으로 보여주기, 프레임 안정성 우선`;
  }

  if (kind === "point_caption") {
    return `핵심 키워드 강조형 포인트 자막, 1개의 강한 메시지, 큰 숫자나 키워드 중심, 원문: ${text}`;
  }

  return `실사형 이미지, 한국 오피스 촬영 느낌, 밝고 신뢰감 있는 화면, 원문: ${text}`;
}

function kindMeta(kind: RecommendationKind) {
  switch (kind) {
    case "image_real":
      return { label: "실사 형식", reason: "현실적인 보조 컷이 설득력을 높입니다." };
    case "image_illustration":
      return { label: "일러스트 형식", reason: "복잡한 설명을 한 장면으로 정리하기 좋습니다." };
    case "video":
      return { label: "영상 형식", reason: "변화가 있는 장면은 짧은 모션 클립이 더 자연스럽습니다." };
    case "point_caption":
      return { label: "포인트 자막", reason: "핵심 문장을 별도 MOGRT로 강조하면 전달력이 올라갑니다." };
    default:
      return { label: "자료", reason: "보조 자료를 추천합니다." };
  }
}

export function buildRecommendations(segments: SubtitleSegment[]) {
  return segments.map((segment, index) => {
    const kind = pickRecommendationKind(segment.text, index);
    const meta = kindMeta(kind);

    return {
      id: `rec-${segment.id}`,
      segmentId: segment.id,
      kind,
      label: meta.label,
      title: segment.text.length > 38 ? `${segment.text.slice(0, 38)}...` : segment.text,
      prompt: buildPrompt(segment.text, kind),
      reason: meta.reason,
      timecode: segment.startTimecode
    } satisfies RecommendationDraft;
  });
}

export function createXmlExport(segments: SubtitleSegment[], selectedIds: string[], recommendations: RecommendationDraft[]) {
  const selectedMap = new Map(recommendations.filter((item) => selectedIds.includes(item.id)).map((item) => [item.segmentId, item]));
  const items = segments
    .map((segment) => {
      const recommendation = selectedMap.get(segment.id);

      return `  <segment id="${segment.id}" start="${segment.startTimecode}" end="${segment.endTimecode}">\n    <caption>${escapeXml(segment.text)}</caption>${recommendation ? `\n    <asset kind="${recommendation.kind}" label="${recommendation.label}">${escapeXml(recommendation.prompt)}</asset>` : ""}\n  </segment>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<premiereAutomationExport>\n${items}\n</premiereAutomationExport>`;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}