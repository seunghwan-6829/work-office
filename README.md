# Premiere Asset Orchestrator

SRT 업로드를 시작점으로 해서 다음 단계를 자동화하는 웹앱 MVP입니다.

- SRT 파싱 및 타임코드 표시
- 자료 추천 리스트 생성
- 이미지 생성 요청 분기
- 영상 생성 요청 분기
- Premiere용 XML 또는 플러그인 지시서 export

## 권장 제품 구조

1. 웹앱
2. 작업 큐 워커
3. 스토리지
4. Premiere UXP 플러그인

XML만으로는 일반 자막과 미디어 배치는 가능하지만, MOGRT 자동 삽입은 UXP 플러그인이 훨씬 안정적입니다.

## 로컬 실행

PowerShell 실행 정책 제약이 있으면 `npm.cmd`를 사용합니다.

```powershell
npm.cmd install
npm.cmd run dev
```

## 이번 초기 골격에 포함된 것

- `app/page.tsx`: 운영 대시보드 초기 화면
- `lib/mock-data.ts`: 데모 데이터
- `docs/architecture.md`: 시스템 설계
- `docs/premiere-integration.md`: Premiere 연동 전략
