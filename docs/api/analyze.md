# POST /api/analyze

AI 이미지 분석 API. Gemini Vision 모델을 사용해 사진 속 인터페이스(키오스크·앱·가전제품)를 분석하고, 사용자가 목표를 달성하기 위해 눌러야 할 위치를 단계별로 안내하는 과제(goal) 목록을 반환합니다.

> **버전**: 0.2.1 | **유지보수자**: `app/api/analyze/route.js` | **최종 갱신**: 2026-07-19

## 요청

### HTTP
```http
POST /api/analyze
Content-Type: application/json
```

### Body (JSON)

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `image` | `string` | ✅ | Base64 인코딩 이미지 데이터 (`data:` 프리픽스 **제외**) |
| `mimeType` | `string` |  | 이미지 MIME 타입 (기본값: `"image/jpeg"`). `"image/"`로 시작하지 않으면 거부됨 |
| `requestedGoal` | `string` |  | 사용자가 직접 입력한 목표 설명 (예: "메뉴 주문하고 싶어요"). 없으면 자동 추천 |

### 유효성 검증
- `body`가 JSON이 아니면 → `400`
- `image`가 누락되었거나 `string`이 아니면 → `400`
- `mimeType`이 `"image/"`로 시작하지 않으면 → `400`

### 예시
```json
{
  "image": "iVBORw0KGgoAAAA...",
  "mimeType": "image/png",
  "requestedGoal": "메뉴판 사진을 찍어서 주문하고 싶어요"
}
```

## 응답

### 200 OK — 분석 성공

```json
{
  "goals": [
    {
      "id": "goal-1",
      "label": "메뉴 고르기",
      "hint": "원하는 음식을 선택하고 장바구니에 담으세요",
      "icon": "🍽️",
      "steps": [
        {
          "text": "화면 왼쪽의 메뉴 이름을 눌러 주세요.",
          "label": "메뉴",
          "box": { "x": 5, "y": 20, "w": 30, "h": 20 }
        },
        {
          "text": "장바구니 버튼을 눌러 확인해 주세요.",
          "label": "담기",
          "box": { "x": 75, "y": 80, "w": 20, "h": 15 }
        }
      ]
    }
  ]
}
```

#### 응답 스키마 상세

| 필드 | 타입 | 설명 |
|---|---|---|
| `goals` | `Array<Goal>` | 분석된 목표 목록, 최대 4개 |
| `goals[].id` | `string` | `"goal-1"`, `"goal-2"` … 순차 ID |
| `goals[].label` | `string` | 목표 요약 제목 (중복 시 empty → 해당 goal 제거됨) |
| `goals[].hint` | `string` | 추가 조언 문구 (기본값: `"차근차근 안내해 드려요."`) |
| `goals[].icon` | `string` | 이모지 아이콘, 최대 4자 (기본값: `"👆"` → `"✅"` → `"↩️"` → `"🔍"` 순환) |
| `goals[].steps` | `Array<Step>` | 수행 단계, 목표당 최대 5개 |

**Step:**

| 필드 | 타입 | 설명 |
|---|---|---|
| `text` | `string` | 단계 설명 (빈 문자열이면 해당 step은 필터링됨) |
| `label` | `string` | 눈금표/말풍선에 표시할 짧은 레이블, 최대 16자 (기본값: `"여기"`) |
| `box` | `Box` | 사진 위에 그릴 사각형 영역 |

**Box (퍼센트 좌표계)**

| 필드 | 타입 | 범위 | 설명 |
|---|---|---|---|
| `x` | `number` | 0–96 | 좌상단 X 좌표 (%) |
| `y` | `number` | 0–96 | 좌상단 Y 좌표 (%) |
| `w` | `number` | 4–100−x | 너비 (%) |
| `h` | `number` | 4–100−y | 높이 (%) |

### BBox 정규화 규칙
- 실수 입력은 `Number()`로 변환, 유한하지 않은 값은 `x:0, y:0, w:18, h:12`로 대체
- 각 축을 `clamp(min, max)`로 0~96 범위로 제한
- 너비/높이는 최소 4%, 최대 `100−x`/`100−y`로 제한하여 사진 바깥으로 벗어나지 않도록 보장

## 오류 응답

| 상태 코드 | `error` 값 | `missing` | 설명 |
|---|---|---|---|
| `400` | `"요청 형식이 올바르지 않습니다."` | — | Body가 JSON이 아님 |
| `400` | `"분석할 사진이 없습니다."` | — | `image` 필드 누락 또는 string 아님 |
| `400` | `"이미지 파일만 분석할 수 있습니다."` | — | `mimeType`이 `"image/"`로 시작하지 않음 |
| `429` | `"RATE_LIMITED"` | — | Gemini API 할당량 초과 (`Retry-After` 헤더 포함) |
| `500` | `"사진 분석 중 문제가 생겼습니다."` | — | 예기치 않은 내부 오류 |
| `502` | `"AI가 사진을 분석하지 못했습니다."` | — | Gemini API 호출 실패 (429 제외) |
| `503` | `"MISSING_CONFIG"` | `["GEMINI_API_KEY"]` | 필수 환경변수 누락 |

### 503 MISSING_CONFIG
`REQUIRED_ENV` 목록(`GEMINI_API_KEY`) 중 하나라도 비어있거나 설정되지 않으면 **모든 요청에 대해** 503을 반환합니다. `missing` 배열로 누락된 키 이름을 명시하여 클라이언트가 진단할 수 있도록 합니다.

```json
{
  "error": "MISSING_CONFIG",
  "missing": ["GEMINI_API_KEY"]
}
```

### 429 RATE_LIMITED
Gemini API가 할당량 초과(Quota exceeded)를 반환하면 429 상태 코드와 함께 클라이언트에 응답합니다. `Retry-After` 헤더에 재시도 가능한 초(5초 단위, 최소 5초)를 포함하며, 응답 본문에는 `retryAfter` 필드와 사용자 친화적인 메시지가 포함됩니다.

```json
{
  "error": "RATE_LIMITED",
  "message": "AI 사용량이 잠시 많아요. 30초 뒤에 다시 시도해주세요.",
  "retryAfter": 30
}
```

| 응답 헤더 | 설명 |
|---|---|
| `Retry-After` | 재시도까지 기다려야 할 초 (예: `30`) |

## Rate Limit

현재 명시적 rate limit은 없습니다. Gemini API 자체의 free-tier 할당량(분당 요청 수)에 따라 제한되며, 할당량 초과 시 429 RATE_LIMITED 응답이 반환됩니다.

향후 API Gateway 도입 시 계획:
- IP당 30 req/min 초과 시 `429` + `Retry-After` 헤더
- Gemini API 429 전파 시 back-off 재시도

## 환경변수

| 키 | 필수 | 기본값 | 설명 |
|---|---|---|---|
| `GEMINI_API_KEY` | ✅ | — | Gemini API 키 **(유일한 필수 변수)** |
| `GEMINI_MODEL` |  | `"gemini-3.5-flash"` | Gemini 모델 이름 (선택) |
| `FASTAPI_URL` |  | — | M2+ AI 백엔드 주소 (선택, 향후 사용) |
| `PORT` |  | 4173 | Vite dev 서버 포트 (Next.js와 무관) |

환경변수는 `.env.local`에 설정하며, `.env.example`을 참고하세요.

## 서버 내부 동작

1. 요청 수신
2. `MISSING_CONFIG` 검사 → 누락 시 `503`
3. JSON 파싱 → 실패 시 `400`
4. `image`·`mimeType` 검증 → 실패 시 `400`
5. `GET https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` 호출
6. Gemini 응답이 `!ok` → `502`
7. 응답에서 `candidates[0].content.parts[].text` 추출
8. ``` ```json ``` ``` 코드 블록 제거 후 JSON 파싱
9. `normalizeAnalysis()`로 정규화
10. 성공 → `200`

## 변경 이력

| 날짜 | 버전 | 변경 |
|---|---|---|
| 2026-07-19 | 0.2.1 | `FASTAPI_URL` 선택(향후 사용)으로 변경, 429 RATE_LIMITED 문서화, `GEMINI_MODEL` 선택 변수 명시 |
| 2026-07-18 | 0.2.0 | `MISSING_CONFIG` 응답 추가, `FASTAPI_URL` 필수, bbox 정규화 문서화 |
| 2026-07-17 | 0.1.0 | 최초 배포 (Gemini 키 503, 요청 검증, JSON 스키마) |
