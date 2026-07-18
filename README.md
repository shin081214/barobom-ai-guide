# 바로봄 — Next.js 고령층 AI 디지털 사용 도우미

어려운 키오스크·가전·앱 화면을 사진으로 올리면, AI가 할 일을 고르고 눌러야 할 위치를 큰 하이라이트와 쉬운 한국어·음성으로 한 단계씩 안내하는 **Next.js App Router** MVP입니다.

## 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:4173`을 엽니다. 사진을 촬영하거나 올리면 Gemini가 실제 화면을 분석합니다.

## 환경변수 (`.env.local`)

```bash
cp .env.example .env.local
```

`.env.local`에 실제 Gemini 키와 백엔드 주소를 입력합니다.

```env
GEMINI_API_KEY=your_api_key_here          # ✅ 필수 — Gemini Vision + Live API
# GEMINI_MODEL=gemini-3.5-flash           # 선택 — Gemini 모델 선택
# NEXT_PUBLIC_API_BASE_URL=...             # 선택 — 텔레메트리 + 기기 식별 백엔드
# FASTAPI_URL=http://localhost:8000        # 선택 — M2+ AI 백엔드
```

| 변수 | 필수 | 용도 | 기본값 |
|---|---|---|---|
| `GEMINI_API_KEY` | ✅ | Gemini Vision 분석 + Live API 실시간 음성 | — |
| `GEMINI_MODEL` | ❌ | Gemini 모델명 | `gemini-3.5-flash` |
| `NEXT_PUBLIC_API_BASE_URL` | ❌ | 텔레메트리 백엔드 + 기기 식별 API | `https://dev.amanhasfallenintotheriver.space` |
| `FASTAPI_URL` | ❌ | M2+ AI 백엔드 주소 | `http://localhost:8000` |

Next.js 개발 서버를 다시 시작하면 실제 사진 분석이 활성화됩니다. API 키는 `app/api/analyze/route.js`와 `app/api/live-key/route.js`의 서버 Route Handler에서만 읽으며 브라우저 번들에 포함되지 않습니다. 업로드 이미지는 로컬 디스크에 저장하지 않습니다.

## 주요 기능

### 📸 사진 분석 (Gemini Vision)
- 사진 촬영·업로드와 미리보기
- Gemini Vision 기반 목표 및 단계별 bbox JSON 생성
- 목표 목록에 원하는 일이 없을 때 **한국어 음성인식 또는 직접 입력**
- 사용자가 말한 목표 하나를 사진과 함께 Gemini에 다시 보내 맞춤 단계 생성
- 음성인식 미지원 브라우저를 위한 직접 입력 폴백
- AI 분석 실패 시 부정확한 예시를 만들지 않고 재촬영 안내
- 사진 위 pulse 하이라이트와 좌표 정규화
- **보통 → 크게 → 아주 크게** 3단계 글자 크기 조절
- Web Speech API 한국어 단계 음성 안내
- 이전·다음·완료 단계 흐름
- AI가 대신 결제하지 않는 human-in-the-loop 안전 안내

### 🎤 실시간 음성 + 카메라 (Gemini Live API)
- **"음성으로 물어보기"** 버튼 — 가이드 단계 중에 실시간 음성 대화 시작
- Gemini Live API WebSocket으로 양방향 음성+영상 스트리밍
- 후면 카메라로 화면을 보여주면서 자연어로 질문 가능
- **카메라 fallback**: 카메라가 없으면 정적 이미지를 1 FPS video frame으로 전송
- `speakWithVision()` 통합 모드 — 카메라 시도 후 실패 시 자동 fallback
- 음소거/해제 토글 지원

### 🧠 SKILL.md 기반 기기 안내 (백엔드 연동)
- 사진 분석 시 FastAPI 백엔드 `POST /v1/identify` 호출로 기기 식별
- `skills/` 디렉토리의 SKILL.md 파일에서 매칭된 기기 가이드 검색
- 식별된 기기 정보(이름·브랜드·모델)를 화면에 배지로 표시
- Live API 세션에 매칭된 Skill 내용을 시스템 프롬프트에 주입 → 더 정확한 안내

## 추천 사진 테스트

가장 추천하는 조합은 **키오스크 + 세탁기 + 보일러 + 스마트폰 스크린샷**입니다. 이 조합으로 특정 기기 전용이 아니라 처음 보는 디지털 인터페이스 전반을 안내한다는 점을 검증할 수 있습니다.

| 대상 | 추천 목표 |
| --- | --- |
| 세탁기 조작부 | 표준 코스로 세탁 시작하기, 탈수만 하기, 예약 세탁하기 |
| 보일러·온도조절기 | 난방 켜기, 온도 23도로 올리기, 외출 모드 설정하기 |
| TV 리모컨 | 유튜브 켜기, 소리 키우기, 외부입력 바꾸기 |
| 전자레인지 | 1분 데우기, 해동하기, 취소하기 |
| 에어컨 리모컨 | 냉방 켜기, 온도 낮추기, 풍량 조절하기 |
| 스마트폰 화면 | 사진 보내기, 와이파이 연결하기, 밝기 키우기, 앱 권한 허용하기 |
| 병원·약국 무인기기 | 접수하기, 번호표 발급하기, 처방전 관련 메뉴 찾기 |

목표 목록에 테스트하려는 일이 없다면 **원하는 일이 목록에 없어요 → 말하기 시작**을 누르거나 직접 입력합니다.

## 명령어

```bash
npm run dev      # Next.js 개발 서버, 포트 4173
npm test         # Vitest 테스트
npm run lint     # ESLint
npm run build    # Next.js 프로덕션 빌드
npm start        # 빌드 결과 실행, 포트 4173
```

## Next.js 구조

```
barobom-ai-guide/
├── app/
│   ├── api/analyze/route.js      # Gemini Vision Route Handler (서버 전용)
│   ├── api/live-key/route.js     # Live API 키 제공 Route Handler
│   ├── layout.jsx                # 루트 레이아웃과 메타데이터
│   └── page.jsx                  # 홈 페이지 Server Component
├── server/
│   └── analyzer.js               # AI 프롬프트와 JSON 좌표 검증
├── src/
│   ├── App.jsx                   # 메인 Client Component (전체 UI 상태)
│   ├── styles.css                # 고령 친화 반응형 디자인
│   └── lib/
│       ├── liveVoice.js          # Gemini Live API WebSocket (실시간 음성+카메라)
│       ├── feedback.js           # 텔레메트리 이벤트 + 기기 식별 (/v1/identify)
│       ├── anonId.js             # 익명 사용자 ID (localStorage 기반)
│       └── imageBounds.js        # 이미지 좌표 정규화 (object-fit: contain)
├── skills/                       # SKILL.md 기기 가이드 (YAML frontmatter + 한국어 매뉴얼)
│   ├── kiosk/                    #   키오스크
│   ├── appliance/                #   가전
│   └── boiler/                   #   보일러/온도조절기
├── docs/api/analyze.md           # POST /api/analyze API 레퍼런스
└── .env.example                  # 환경변수 템플릿
```

## AI 응답 형식

```json
{
  "goals": [
    {
      "label": "주문하기",
      "hint": "메뉴를 골라 담아요",
      "icon": "🍽️",
      "steps": [
        {
          "text": "왼쪽의 메뉴를 눌러주세요.",
          "label": "메뉴",
          "box": { "x": 5, "y": 20, "w": 30, "h": 20 }
        }
      ]
    }
  ]
}
```

좌표는 원본 이미지 전체를 기준으로 한 0~100 퍼센트입니다.
