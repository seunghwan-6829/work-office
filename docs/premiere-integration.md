# Premiere Integration

## 결론

사용자가 미리 등록한 MOGRT 파일을 추천 위치에 자동으로 넣는 것은 가능합니다. 다만 구현 방식은 두 갈래입니다.

1. XML 중심 방식
2. Premiere UXP 플러그인 방식

## 1. XML 중심 방식

### 가능한 것

- 생성 이미지/영상 클립을 타임라인에 배치
- 자막 파일 또는 일반 텍스트 트랙 export
- 컷 길이와 인아웃 포인트 배치

### 제한

- MOGRT 내부 파라미터 제어가 제한적임
- Premiere 버전별 호환성 검증 필요
- 타이틀/그래픽 계층 자동화 유연성이 낮음

## 2. UXP 플러그인 방식

### 가능한 것

- 등록된 MOGRT를 타임라인에 삽입
- 타임코드 기반 자동 배치
- 텍스트 치환
- 템플릿 유형별 삽입 로직 분기

### 추천 이유

포인트 자막은 템플릿 통일성과 수정 가능성이 중요하므로, 웹이 `어느 위치에 어떤 MOGRT를 넣을지`를 결정하고 Premiere 플러그인이 실제 삽입을 담당하는 구조가 가장 안전합니다.

## 권장 데이터 흐름

1. 웹이 SRT를 분석
2. 포인트 자막 구간에 `mogrtTemplateId` 부여
3. 웹이 export manifest 생성
4. Premiere UXP 플러그인이 manifest를 읽음
5. 플러그인이 로컬 MOGRT 라이브러리에서 파일을 찾아 타임라인에 삽입

## Manifest 예시

```json
{
  "sequenceName": "episode_01_auto_build",
  "segments": [
    {
      "segmentId": "seg-001",
      "startMs": 2000,
      "endMs": 5200,
      "captionText": "이 기능을 넣으면 편집 시간이 크게 줄어듭니다.",
      "pointCaption": {
        "mogrtTemplateId": "highlight_box_v2",
        "text": "편집 시간이 크게 줄어듭니다"
      },
      "asset": {
        "type": "video",
        "path": "assets/seg-001-veo.mp4"
      }
    }
  ]
}
```

## 운영상 추천

- 1차: XML + manifest + assets ZIP
- 2차: Premiere UXP 플러그인 추가
- 3차: 플러그인이 MOGRT 자동 삽입과 텍스트 매핑까지 처리
