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
    id: "google",
    label: "Google Vertex AI / Veo 3.1",
    placeholder: "Vertex AI service account 또는 API 키",
    help: "영상 생성 작업과 장기 실행 작업 조회에 사용됩니다."
  },
  {
    id: "nanobanana",
    label: "NanoBanana Pro",
    placeholder: "NanoBanana Pro API Key",
    help: "실사/일러스트 이미지 생성에 사용됩니다."
  },
  {
    id: "openai",
    label: "텍스트 분석용 LLM",
    placeholder: "선택 입력",
    help: "추천 구간 추출과 포인트 자막 분류 고도화에 사용할 수 있습니다."
  }
];