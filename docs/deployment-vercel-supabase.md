# Vercel + Supabase Deploy

## 권장 구성

- Frontend/API: Vercel
- Database: Supabase Postgres
- File storage: Supabase Storage 또는 Google Cloud Storage
- Background jobs: 별도 worker 권장

## Vercel에 넣을 환경변수

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_PROJECT_ID`
- `ENCRYPTION_SECRET`
- `NANOBANANA_API_KEY`
- `GOOGLE_CLOUD_PROJECT_ID`
- `GOOGLE_CLOUD_LOCATION`
- `GOOGLE_APPLICATION_CREDENTIALS_JSON`
- `OPENAI_API_KEY`

## Supabase 설정 순서

1. 새 프로젝트 생성
2. `supabase/schema.sql` 실행
3. Storage 버킷 생성
   - `source-srt`
   - `generated-assets`
   - `exports`
4. 서비스 롤 키와 URL 확보

## Vercel 설정 순서

1. Git 저장소 연결
2. Framework Preset은 `Next.js`
3. Root Directory는 현재 프로젝트 루트
4. 환경변수 입력
5. 첫 배포 실행

## 운영 메모

- Veo 같은 장기 실행 작업은 Vercel 서버리스 함수 단독으로 처리하지 말고 worker로 넘기는 편이 안전합니다.
- Vercel은 웹/API 진입점으로 쓰고, 생성 작업은 별도 큐/워커에서 처리하는 구성이 좋습니다.
- API 키는 Vercel 환경변수 또는 DB 암호화 저장을 병행합니다.

## 실제 배포 방법

### 방법 1. Git 연동

- GitHub에 push
- Vercel에서 import
- 환경변수 입력
- deploy

### 방법 2. CLI

```powershell
npm.cmd i -g vercel
vercel
vercel --prod
```

## 추천

초기에는 `Git 연동 + Vercel 대시보드 환경변수 설정`이 가장 안전합니다.