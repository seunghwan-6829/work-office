export type OfficeRoomSeed = {
  id: string;
  title: string;
  copy: string;
  zone: "ops" | "exec";
};

export type AgentSeed = {
  id: string;
  name: string;
  role: string;
  tone: string;
  specialty: string;
  provider: string;
  model: string;
  accent: string;
  hairClass: string;
  outfitClass: string;
  homeRoomId: string;
};

export const officeRoomSeeds: OfficeRoomSeed[] = [
  { id: "room-order", title: "주문 확인실", copy: "메일, 발주서, 주문 데이터를 읽고 큐를 정리합니다.", zone: "ops" },
  { id: "room-source", title: "도매 수집실", copy: "도매처, 시트, 경쟁 스토어를 돌며 소스를 모읍니다.", zone: "ops" },
  { id: "room-ocr", title: "OCR 검수실", copy: "이미지의 텍스트와 옵션을 읽고 오인식을 잡아냅니다.", zone: "ops" },
  { id: "room-copy", title: "상품명 작업실", copy: "상품명, 옵션명, 판매 문구를 정리하고 다듬습니다.", zone: "ops" },
  { id: "room-publish", title: "업로드 준비실", copy: "마켓별 양식, 엑셀 export, 업로드 패키지를 만듭니다.", zone: "ops" },
  { id: "room-manager", title: "중간 관리자실", copy: "병목과 리스크를 모니터링하고 메모리를 축적합니다.", zone: "exec" },
  { id: "room-ceo", title: "CEO실", copy: "완료된 담당자가 걸어와 보고를 기다립니다.", zone: "exec" }
];

export const agentSeeds: AgentSeed[] = [
  {
    id: "agent-order",
    name: "하린",
    role: "주문 체크 매니저",
    tone: "차분하고 꼼꼼함",
    specialty: "메일, 발주서, 출고 일정표를 비교하며 누락 업무를 발견합니다.",
    provider: "OpenAI",
    model: "gpt-5.4",
    accent: "#ffcf8b",
    hairClass: "agent-hair-brown",
    outfitClass: "agent-outfit-navy",
    homeRoomId: "room-order"
  },
  {
    id: "agent-source",
    name: "도윤",
    role: "도매 수집 담당",
    tone: "발 빠르고 집요함",
    specialty: "도매 사이트, 경쟁 스토어, 시트에서 신규 소스를 정리합니다.",
    provider: "Anthropic",
    model: "claude-opus-4-6",
    accent: "#b7dbff",
    hairClass: "agent-hair-black",
    outfitClass: "agent-outfit-slate",
    homeRoomId: "room-source"
  },
  {
    id: "agent-ocr",
    name: "유나",
    role: "OCR 검수 리더",
    tone: "집중력이 강함",
    specialty: "이미지 속 상품명, 옵션, 가격표를 읽고 오차를 교정합니다.",
    provider: "Vision",
    model: "claude-vision + rules",
    accent: "#ffd7ef",
    hairClass: "agent-hair-auburn",
    outfitClass: "agent-outfit-rose",
    homeRoomId: "room-ocr"
  },
  {
    id: "agent-copy",
    name: "세아",
    role: "상품명/카피 작성자",
    tone: "센스 있고 빠름",
    specialty: "상품명, 옵션명, 상세페이지 카피를 브랜드 톤으로 정리합니다.",
    provider: "Hybrid",
    model: "gpt-5.4 + claude-sonnet",
    accent: "#ffe59e",
    hairClass: "agent-hair-gold",
    outfitClass: "agent-outfit-green",
    homeRoomId: "room-copy"
  },
  {
    id: "agent-publish",
    name: "준호",
    role: "업로드 운영자",
    tone: "묵직하고 안정적",
    specialty: "카테고리, 업로드 양식, 마켓별 필수값을 맞춰 패키지를 완성합니다.",
    provider: "Marketplace",
    model: "custom api router",
    accent: "#d2c4ff",
    hairClass: "agent-hair-gray",
    outfitClass: "agent-outfit-violet",
    homeRoomId: "room-publish"
  },
  {
    id: "agent-manager",
    name: "민지",
    role: "중간 관리자",
    tone: "명확하고 분석적",
    specialty: "병목, 실패 패턴, 개선 포인트를 축적해서 다음 업무에 반영합니다.",
    provider: "Memory",
    model: "manager brain",
    accent: "#c8f0c4",
    hairClass: "agent-hair-espresso",
    outfitClass: "agent-outfit-charcoal",
    homeRoomId: "room-manager"
  }
];

export const quickBriefTemplates = [
  "오늘 들어온 신규 주문 메일을 읽고, 누락 발주 건을 찾아줘.",
  "도매 사이트 세 곳을 비교해서 신규 상품 후보 10개를 정리해줘.",
  "이미지에서 옵션명과 가격 OCR을 돌리고, 오인식 가능성이 높은 항목만 골라줘.",
  "상품명과 옵션명을 쿠팡/스마트스토어 톤으로 각각 다듬어줘.",
  "마켓 업로드용 엑셀과 이미지 패키지를 완성하고 누락 필드를 체크해줘."
];

export const mockApiKeyFields = [
  {
    id: "openai",
    label: "OpenAI API",
    placeholder: "sk-...",
    help: "업무 요약, 카피 생성, 관리자 브리핑 같은 텍스트 작업에 연결합니다."
  },
  {
    id: "anthropic",
    label: "Anthropic API",
    placeholder: "sk-ant-...",
    help: "깊은 검수, 장문 분석, 보고서 품질 향상용으로 연결합니다."
  },
  {
    id: "google",
    label: "Google / Gemini",
    placeholder: "AIza... 또는 service key",
    help: "멀티모달 처리나 OCR 후속 분석 라우팅에 연결합니다."
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    placeholder: "sk-or-...",
    help: "모델 라우터로 두고 캐릭터별 백업 모델을 연결할 때 사용합니다."
  },
  {
    id: "custom",
    label: "Custom Endpoint",
    placeholder: "https://your-endpoint.example.com/v1",
    help: "OpenAI 호환 커스텀 엔드포인트나 사내 게이트웨이를 연결합니다."
  }
];
