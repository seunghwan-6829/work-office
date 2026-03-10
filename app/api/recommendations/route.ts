import { NextRequest, NextResponse } from "next/server";
import type { RecommendationKind, SubtitleSegment } from "../../../lib/srt";

interface RequestBody {
  apiKey?: string;
  segments?: SubtitleSegment[];
  frequencySeconds?: number;
}

interface ClaudeRecommendation {
  segmentId: string;
  kind: RecommendationKind;
  title: string;
  visualCue: string;
  prompt: string;
  reason: string;
  timecode: string;
}

function extractTextPayload(payload: unknown) {
  const blocks = Array.isArray((payload as { content?: unknown[] })?.content)
    ? ((payload as { content: Array<{ type?: string; text?: string }> }).content)
    : [];

  return blocks
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n");
}

function extractJsonArray(text: string) {
  const fencedMatch = text.match(/```json\s*([\s\S]*?)```/i) ?? text.match(/```\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1] ?? text;
  const start = candidate.indexOf("[");
  const end = candidate.lastIndexOf("]");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Claude 응답에서 JSON 배열을 찾지 못했습니다.");
  }

  return JSON.parse(candidate.slice(start, end + 1)) as ClaudeRecommendation[];
}

function validateKind(kind: string): kind is RecommendationKind {
  return kind === "image_real" || kind === "image_illustration" || kind === "video";
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;
    const apiKey = body.apiKey?.trim();
    const segments = body.segments ?? [];
    const frequencySeconds = Math.max(1, Number(body.frequencySeconds) || 5);

    if (!apiKey) {
      return NextResponse.json({ error: "Claude API 키가 없습니다." }, { status: 400 });
    }

    if (!segments.length) {
      return NextResponse.json({ error: "분석할 SRT 구간이 없습니다." }, { status: 400 });
    }

    const prompt = [
      "너는 프리미어 편집용 보조 소재 추천기다.",
      "지금 전달된 자막 구간 하나에 대해 가장 어울리는 보조 소재를 추천하라.",
      `이 요청은 구간별 순차 호출 중 하나이며, 기준 빈도는 약 ${frequencySeconds}초다.`,
      "각 항목마다 아래 JSON 배열 형식만 반환하라.",
      "[{'segmentId':'001','kind':'image_real|image_illustration|video','title':'...','visualCue':'...','prompt':'...','reason':'...','timecode':'00:00:00,000'}]",
      "title은 짧고 명확하게, visualCue는 화면 설명, prompt는 생성 모델에 바로 넣을 수 있게 구체적으로 작성하라.",
      "문장 그대로 반복하지 말고, 진짜로 어울리는 보조 화면을 추천하라.",
      "응답에는 JSON 외의 설명을 넣지 마라.",
      "분석 대상:",
      JSON.stringify(
        segments.map((segment) => ({
          segmentId: segment.id,
          startMs: segment.startMs,
          startTimecode: segment.startTimecode,
          endTimecode: segment.endTimecode,
          text: segment.text
        }))
      )
    ].join("\n");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 900,
        temperature: 0.4,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json({ error: `Claude 호출 실패: ${detail}` }, { status: 502 });
    }

    const payload = await response.json();
    const text = extractTextPayload(payload);
    const items = extractJsonArray(text)
      .filter((item) => validateKind(item.kind))
      .map((item) => ({
        ...item,
        title: item.title || item.visualCue,
        visualCue: item.visualCue || item.title,
        prompt: item.prompt || item.visualCue,
        reason: item.reason || "AI가 이 구간에 보조 소재가 적합하다고 판단했습니다."
      }));

    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "추천 생성 중 알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
