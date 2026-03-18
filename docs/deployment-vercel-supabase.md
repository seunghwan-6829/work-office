# Vercel + Supabase 배포 가이드

## 추천 구조

- 프론트엔드: Vercel + Next.js
- 인증: Supabase Auth
- 데이터베이스: Supabase Postgres
- 실시간 상태 반영: Supabase Realtime
- 파일 저장: Supabase Storage
- 무거운 AI 작업: 추후 별도 worker 또는 background function

## 왜 이 구조가 맞는가

- Vercel은 웹 프론트와 가벼운 API 진입점에 강합니다.
- Supabase는 로그인, Postgres, Realtime을 한 번에 묶어 주기 때문에 오피스 상태 관리에 잘 맞습니다.
- 캐릭터 상태, CEO 보고 대기열, 중간 관리자 메모리를 DB로 옮기면 여러 기기에서 같은 화면을 볼 수 있습니다.
- 나중에 OpenAI, Anthropic, OpenRouter, 커스텀 엔드포인트를 붙여도 프론트 구조를 바꾸지 않아도 됩니다.

## Vercel 환경 변수

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

추후 서버 라우트를 붙일 때 고려할 변수:

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GOOGLE_API_KEY`
- `OPENROUTER_API_KEY`
- `CUSTOM_API_BASE_URL`
- `ENCRYPTION_SECRET`

## Supabase 설정 순서

1. 새 프로젝트 생성
2. [`supabase/schema.sql`](/C:/Users/user/Desktop/codex_save_file/supabase/schema.sql) 실행
3. Auth에서 Email 로그인 활성화
4. 필요하면 Storage 버킷 생성
   - `reports`
   - `artifacts`
   - `avatars`

## 현재 앱에서 이미 준비된 것

- Supabase 이메일 로그인 화면
- 회사 단위 로컬 시뮬레이션 데이터
- 캐릭터 클릭 후 업무 브리핑 UI
- CEO 보고 대기열
- API 키 입력 UI

## 다음 단계 권장 순서

1. 로컬 시뮬레이션 상태를 Supabase 테이블로 옮기기
2. `agents`, `jobs`, `reports`, `manager_memory`를 실시간 구독으로 연결
3. API 키는 브라우저 로컬 저장 대신 서버 보관 구조로 변경
4. 실제 LLM 호출 라우터를 `/api` 또는 별도 worker로 분리

## 배포 순서

1. GitHub에 push
2. Vercel에서 저장소 import
3. Framework Preset은 `Next.js`
4. 루트 디렉터리는 현재 프로젝트 루트
5. 환경 변수 입력
6. 첫 배포 실행

## 주의할 점

- 이 앱은 장기적으로는 background worker가 필요합니다.
- Vercel 함수 안에서 긴 AI 작업을 모두 처리하려고 하지 않는 편이 좋습니다.
- 먼저 UI와 상태 모델을 올리고, 무거운 실행부만 나중에 분리하는 흐름이 가장 안정적입니다.
