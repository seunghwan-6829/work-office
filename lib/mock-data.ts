export const mockSrtRows = [
  {
    id: "001",
    range: "00:00:02,000 - 00:00:05,200",
    text: "이 기능을 넣으면 편집 시간이 크게 줄어듭니다.",
    action: "포인트 자막 + 실사 자료 추천"
  },
  {
    id: "002",
    range: "00:00:05,800 - 00:00:09,000",
    text: "예시 화면은 일러스트 스타일로 보여주는 게 좋습니다.",
    action: "일러스트 자료 추천"
  },
  {
    id: "003",
    range: "00:00:09,300 - 00:00:13,000",
    text: "실제 결과는 짧은 모션 클립으로 보여주는 게 더 강합니다.",
    action: "영상 자료 추천"
  }
];

export const mockRecommendations = [
  {
    id: "rec-1",
    label: "실사 형식",
    type: "image",
    timecode: "00:00:02,000",
    title: "편집자가 프리미어 타임라인을 보며 속도 개선을 체감하는 장면",
    prompt: "따뜻한 스튜디오 조명, 모니터 두 대, 한국어 UI 느낌, 현실적인 촬영 스타일"
  },
  {
    id: "rec-2",
    label: "일러스트 형식",
    type: "illustration",
    timecode: "00:00:06,200",
    title: "복잡한 편집 프로세스가 자동화 흐름으로 정리되는 다이어그램",
    prompt: "클린 인포그래픽, 베이지와 딥그린, 단계별 화살표, 프레젠테이션 스타일"
  },
  {
    id: "rec-3",
    label: "영상 형식",
    type: "video",
    timecode: "00:00:09,300",
    title: "Premiere 타임라인 위에 소재가 자동으로 채워지는 시네마틱 모션",
    prompt: "UI 기반 모션 그래픽, 부드러운 카메라 이동, 4초 길이, 프레임 안정성 우선"
  }
];

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
