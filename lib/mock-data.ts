export const sampleSrt = `1
00:00:02,000 --> 00:00:05,200
이 기능을 넣으면 편집 시간이 크게 줄어듭니다.

2
00:00:05,800 --> 00:00:09,000
예시 화면은 일러스트 스타일로 보여주는 게 좋습니다.

3
00:00:09,300 --> 00:00:13,000
실제 결과는 짧은 모션 클립으로 보여주는 게 더 강합니다.`;

export const mockApiKeyFields = [
  {
    id: "anthropic",
    label: "Claude API",
    placeholder: "Anthropic API Key",
    help: "1차 검수 추천과 프롬프트 생성을 Claude로 분석할 때 사용합니다."
  },
  {
    id: "google",
    label: "Google Vertex AI / Veo 3.1",
    placeholder: "Vertex AI service account 또는 API key",
    help: "영상 생성 작업과 장기 실행 상태 조회에 사용합니다."
  },
  {
    id: "nanobanana",
    label: "NanoBanana Pro",
    placeholder: "NanoBanana Pro API Key",
    help: "실사형과 일러스트 이미지 생성에 사용합니다."
  }
];
