# Architecture

## 사용자 플로우

1. 사용자가 SRT 파일 업로드
2. 서버가 SRT를 파싱하고 각 자막 구간을 세그먼트로 저장
3. 분석 엔진이 각 세그먼트에 대해 아래 후보를 생성
   - 일반 자막 유지
   - 포인트 자막 필요
   - 실사 이미지 추천
   - 일러스트 이미지 추천
   - 영상 자료 추천
4. 사용자가 추천 리스트를 검수하고 선택
5. 작업 큐가 선택 결과를 받아 외부 생성 API 호출
6. 생성 결과를 스토리지에 저장
7. XML 또는 Premiere 플러그인용 배치 지시서를 생성
8. 사용자가 Premiere에 import 또는 플러그인 동기화 수행

## 시스템 구성

### 1. Frontend

- Next.js App Router
- 업로드 화면
- 세그먼트 검수 화면
- API 키 관리 화면
- 작업 진행률 화면
- export 화면

### 2. API 서버

- 업로드 API
- SRT 파싱 API
- 추천 생성 API
- 작업 시작 API
- 작업 상태 조회 API
- export API

### 3. Worker

- 이미지 생성 작업
- 영상 생성 작업
- 실패 재시도
- 결과 표준화
- XML 생성

### 4. Storage

- 원본 SRT
- 생성 이미지
- 생성 영상
- XML
- 썸네일

### 5. Database

- users
- workspaces
- provider_credentials
- projects
- subtitle_segments
- asset_recommendations
- asset_jobs
- generated_assets
- export_packages

## 배포 권장안

### 가장 현실적인 조합

- Frontend/API: Vercel 또는 Cloud Run
- Worker: Google Cloud Run Jobs 또는 Railway worker
- DB: Supabase Postgres
- Queue: Upstash Redis 또는 Google Pub/Sub
- File storage: Google Cloud Storage
- Secret management: Google Secret Manager 또는 Supabase encrypted vault

### 이유

- Veo가 Google Cloud와 궁합이 좋음
- 장기 실행 비동기 작업 관리가 쉬움
- 다중 사용자별 API 키 저장 정책을 분리하기 좋음

## API 키 저장 전략

다중 사용자 서비스라면 사용자별 외부 API 키를 저장해야 하므로 아래 원칙이 필요합니다.

- 저장 전 서버측 암호화
- 조회 시 원문 재노출 금지
- 작업 시에만 복호화
- 감사 로그 기록
- 팀 워크스페이스 단위 권한 분리

## 추천 데이터 모델 예시

```ts
type RecommendationType = "basic_caption" | "point_caption" | "image_real" | "image_illustration" | "video";

interface AssetRecommendation {
  id: string;
  segmentId: string;
  type: RecommendationType;
  startMs: number;
  endMs: number;
  reason: string;
  prompt: string;
  mogrtTemplateId?: string;
}
```
