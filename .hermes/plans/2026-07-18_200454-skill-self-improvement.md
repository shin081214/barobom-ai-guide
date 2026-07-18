# Barobom SKILL.md Self-Improvement Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.
>
> **⚠️ STATUS (2026-07-19): M0~M5 완료, M6 진행 예정. 최신 진행상황은 `docs/PROGRESS.md` 참조.**

**Goal:** 처음 보는 제품도 AI가 안내할 수 있도록, 안내 세션에서 검증된 사용 지식을 제품별 `SKILL.md`로 누적·평가·게시·재사용하는 자기 발전 시스템을 단계적으로 구축한다.

**Architecture:** Next.js 클라이언트는 그대로 두고, 분석/학습 파이프라인을 별도 **FastAPI** 서비스로 분리한다. ~~Supabase PostgreSQL + pgvector~~ **→ 현재 SQLite + ChromaDB 사용 중** (향후 Supabase 마이그레이션). Skill 후보 생성·평가는 ~~Celery Worker~~ **→ 동기 FastAPI 핸들러**로 처리, AI의 출력은 **draft → published → deprecated** 상태 머신을 거친다.

**Actual Tech Stack (deployed):** Next.js 16 (App Router) · React 19 · FastAPI · SQLAlchemy 2 · SQLite · ChromaDB · Gemini Vision (`generateContent` + Live API WebSocket) · Vitest (FE)

**Note on model metadata:** This plan is authored under active model **MiniMax-M3** (provider: `custom:jitda`).
**Updated:** 2026-07-19 — M0~M5 완료, 14개 서브에이전트 + Live API 통합 + Gemini 키 교체 완료.

---

## 1. 현재 상태와 제약

- 저장소: `/home/itsallgoodman/ERICA-Hackathon/barobom-ai-guide`
- 브랜치: `main`, 커밋 `6d532f8`, 작업 트리 깨끗함
- `package-lock.json`이 `package.json`과 동기화되지 않아 `npm ci` 실패 (이전 보고서의 #1 이슈)
- 단일 Next.js Route Handler `app/api/analyze/route.js`에서 Gemini 호출
- `server/analyzer.js`는 프롬프트/정규화 로직, Route Handler에서 import 해서 사용
- DB/Storage/큐/관측 도구 없음
- Gemini 호출 외 통합 테스트 없음
- 사용자 동의를 받지 않은 상태로 원본 이미지 보관 → 데이터 모델 설계 시 명시적 동의 필수

## 2. 핵심 설계 원칙

1. **AI를 재학습하지 않는다.** 검증된 SKILL.md를 검색해 주입한다.
2. **AI가 만든 Skill은 즉시 운영에 반영하지 않는다.** 버전·평가·승인 단계를 거친다.
3. **사진보다 행동을 학습한다.** 성공/실패/재시도/화면 변화 같은 검증 가능한 증거만 장기 보관한다.
4. **원본 이미지는 동의 시에만 보존한다.** 기본값은 임베딩·OCR·익명 좌표만 저장한다.
5. **Skill 단위는 제품의 UI 계열 단위다.** 모델명 + 펌웨어/UI 변형을 묶고, 화면이 크게 바뀌면 별도 Skill로 분리한다.

## 3. 마일스톤 (단계적 출시)

| # | 마일스톤 | 사용자 가치 | 핵심 변경 |
|---|---------|------------|----------|
| M0 | 기반 정비 | CI/배포가 깨지지 않는 상태로 만들기 | lockfile 동기화, 환경변수 분리, 분석 API 계약을 안정화 |
| M1 | 관측 수집 | 어떤 Skill이 어떤 결과를 냈는지 추적 | 세션/이벤트 로깅, 익명 식별자, Langfuse 트레이싱 |
| M2 | 제품 식별 + Skill 검색 | 처음 보는 제품도 기존 Skill 참고 가능 | devices + skill_versions + pgvector 하이브리드 검색 |
| M3 | Skill 후보 생성 | 여러 세션의 관찰로부터 초안 자동 생성 | observations 집계, Celery 작업, Gemini 초안 생성 |
| M4 | 평가 게이트 | 잘못된 Skill이 게시되지 않도록 | evaluation_cases + 자동 평가 + 관리자 검토 UI |
| M5 | 게시/롤백/감사 | 안전한 운영과 빠른 복구 | 상태 머신, 버전 게시/롤백, 감사 로그 |
| M6 | 개인정보 안전장치 | 사용자 신뢰 확보 | 동의 흐름, EXIF 제거, 마스킹, 보관 만료 |

각 마일스톤은 독립적으로 가치를 가지며, 이전 마일스톤 없이 다음 마일스톤을 시작하지 않는다.

## 4. 디렉터리 변경 계획

```text
barobom-ai-guide/
├── app/                              # Next.js (기존)
│   ├── api/
│   │   ├── analyze/route.js          # FastAPI로 위임하도록 축소
│   │   └── telemetry/route.js        # [신규] 클라이언트 이벤트 수집
│   └── admin/skills/page.jsx         # [신규] 관리자 검토 UI
├── src/                              # React 클라이언트
│   ├── App.jsx                       # 분석 호출을 FastAPI URL로 변경
│   ├── lib/
│   │   ├── apiClient.js              # [신규] API URL 단일화
│   │   ├── consent.js                # [신규] 데이터 수집 동의 흐름
│   │   └── feedback.js               # [신규] 단계별 도움됨/잘못됨 신고
│   └── styles.css
├── server/                           # (기존) 유지하되 역할 축소
│   └── analyzer.js                   # 향후 비공개 또는 제거
├── api/                              # [신규] FastAPI 백엔드
│   ├── pyproject.toml
│   ├── alembic.ini
│   ├── alembic/versions/
│   ├── app/
│   │   ├── main.py                   # FastAPI entrypoint
│   │   ├── config.py                 # Pydantic Settings
│   │   ├── deps.py                   # DB 세션, 인증 의존성
│   │   ├── db.py                     # SQLAlchemy engine/session
│   │   ├── models/                   # SQLAlchemy 모델
│   │   │   ├── device.py
│   │   │   ├── skill.py
│   │   │   ├── skill_version.py
│   │   │   ├── session.py
│   │   │   ├── event.py
│   │   │   ├── observation.py
│   │   │   ├── evaluation_case.py
│   │   │   ├── skill_evaluation.py
│   │   │   ├── media_asset.py
│   │   │   └── audit_log.py
│   │   ├── schemas/                  # Pydantic 스키마
│   │   ├── services/                 # 도메인 서비스 (식별/검색/생성/평가)
│   │   ├── api/v1/                   # 라우터
│   │   ├── workers/                  # Celery 작업
│   │   ├── ai/                       # Gemini 클라이언트, 임베딩
│   │   └── safety/                   # 마스킹, EXIF 제거, PII 검증
│   ├── tests/
│   └── scripts/
├── skills/                           # [신규] 게시된 SKILL.md export 보관소 (mirror)
│   └── README.md
└── .github/workflows/
    ├── web-ci.yml
    └── api-ci.yml
```

## 5. 데이터 모델 (요약)

스키마는 `api/app/models/`에 SQLAlchemy로 작성한다. 마이그레이션은 Alembic으로 관리한다.

```text
devices           # 식별된 제품/UI 계열
  id, category, manufacturer, model_name, firmware_version,
  ui_variant, visual_embedding vector(768), ocr_signature,
  identification_clues jsonb, confidence, timestamps

skills            # 제품별 Skill의 논리 단위
  id, device_id, slug, title, status,
  current_published_version_id, timestamps

skill_versions    # 실제 SKILL.md 버전 (Source of Truth)
  id, skill_id, version, markdown_content,
  status draft|candidate|evaluating|review_required|published|deprecated,
  parent_version_id, generation_reason, evidence_count,
  evaluation_score, created_by, timestamps

guide_sessions    # 사용자 한 명의 안내 세션
  id, anonymous_user_id, device_id, skill_version_id,
  requested_goal, identification_confidence,
  consent_to_learning, started_at, completed_at, outcome

session_events    # 세션 내 행동 로그
  id, session_id, event_type, step_index,
  event_payload jsonb, created_at

observations      # 구조화된 문제 보고
  id, session_id, device_id, skill_version_id,
  observation_type, description, evidence_asset_id,
  model_confidence, user_confirmed, processed_at

evaluation_cases  # Skill 자동 평가용 입력
  id, device_id, goal, input_image_id,
  expected_constraints jsonb, safety_requirements jsonb

skill_evaluations # 평가 실행 결과
  id, skill_version_id, evaluation_case_id,
  evaluator_type llm|rule|human, score, passed,
  failure_reason, details jsonb

media_assets      # 이미지 메타 (실제 바이트는 Storage)
  id, storage_key, content_hash, mime_type,
  width, height, redacted, retention_until, deleted_at

audit_logs        # 모든 상태 변경 추적
  id, actor, action, target_type, target_id,
  before jsonb, after jsonb, created_at
```

## 6. Skill 상태 머신

```text
draft ──▶ candidate ──▶ evaluating ──▶ review_required ──▶ published
  ▲          │              │                │                  │
  │          │              │                └───── published   │
  │          │              └──── fail ─▶ draft (재시도)        │
  │          └──── fail ─▶ draft                              │
  │                                                          │
  └────────────────────── deprecated ◀── published (롤백)    │
```

자동 게시가 가능한 작은 패치는 임계치(예: 평가 점수 + 회귀 통과 + 안전 규칙 + 다중 세션 증거)로만 허용한다.

## 7. 단계별 작업 (Task 단위)

각 작업은 **2~5분 단위**로 쪼개고 TDD 사이클(실패 테스트 → 구현 → 통과 → 커밋)을 따른다. 모든 백엔드 작업은 동일 패턴이다.

> 아래 표시는 압축된 서술이다. 실제 실행 시 각 단계는 `RED → GREEN → REFACTOR → COMMIT`으로 풀어 작성한다.

### M0. 기반 정비

**Task 0.1: lockfile 동기화**
- Files: `package.json`, `package-lock.json`
- Steps: `npm install --package-lock-only` → `npm ci` 검증 → 실패 시 lockfile 삭제 후 재생성 → `npm test && npm run lint && npm run build && npm audit` 통과 커밋.
- Verification: `npm ci` exit 0, 모든 명령 통과, `git status` 깨끗.

**Task 0.2: 환경변수 분리**
- Files: `.env.example` (확장), `.gitignore` (`.env.local` 추가), `app/api/analyze/route.js` (변수 검증 강화).
- Steps: 새 키 `FASTAPI_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `LANGFUSE_PUBLIC_KEY` 추가. `route.js`에서 누락 시 503 + `MISSING_CONFIG` 코드.
- Verification: `.env` 없이 부팅 시 모든 누락 키가 명확한 에러 코드와 함께 응답.

**Task 0.3: 분석 API 계약 문서화**
- Files: `docs/api/analyze.md` [신규].
- Steps: 요청/응답 예시, bbox 정규화 규칙, rate limit 정책 문서화.
- Verification: 라우트 동작과 문서 일치 테스트.

### M1. 관측 수집

**Task 1.1: 익명 사용자 ID 발급**
- Files: `src/lib/anonId.js` [신규], `src/App.jsx` (초기화).
- Verification: 새로고침 후에도 동일 ID 유지, 쿠키/Storage 정리 동작.

**Task 1.2: 세션/이벤트 스키마**
- Files: `api/app/models/session.py`, `api/app/models/event.py`, Alembic 마이그레이션.
- Verification: 마이그레이션 up/down 성공, 모델 단위 테스트.

**Task 1.3: `/api/telemetry` 수집 라우터**
- Files: `app/api/telemetry/route.js` [신규], FastAPI `/v1/events` [신규].
- Verification: 잘못된 payload 거부, 필수 필드 검증, 부하 테스트(100 RPS) 통과.

**Task 1.4: 클라이언트 이벤트 발행**
- Files: `src/lib/feedback.js` [신규], `src/App.jsx` 연동.
- 이벤트: `guide_started`, `step_shown`, `step_back`, `step_repeated`, `new_photo_uploaded`, `screen_changed`, `goal_completed`, `guide_abandoned`, `user_reported_wrong`.
- Verification: 단계 전환, 뒤로, 반복, 잘못된 위치 신고 시 실제 이벤트 전송.

**Task 1.5: Langfuse 트레이싱**
- Files: `api/app/ai/trace.py` [신규].
- Verification: Gemini 호출 trace가 Langfuse에 노출.

### M2. 제품 식별 + Skill 검색

**Task 2.1: devices 스키마와 pgvector 인덱스**
- Files: `api/app/models/device.py`, Alembic.
- Verification: `ivfflat`/`hnsw` 인덱스 생성, KNN 검색 100ms 이내.

**Task 2.2: 제품 식별 서비스**
- Files: `api/app/services/identification.py` [신규].
- 입력: 이미지 + OCR 텍스트 + 제조사 단서.
- 출력: 신뢰도 + 후보 device 목록.
- Verification: 골든 이미지 세트로 정확도 측정.

**Task 2.3: SKILL.md 검증기**
- Files: `api/app/services/skill_validator.py` [신규].
- 검증: frontmatter, 필수 섹션, 안전 규칙 위반 패턴(이상 좌표, “전원을 뽑으세요”, “잠금 해제” 류).
- Verification: 좋은 예/나쁜 예 골든 테스트 통과.

**Task 2.4: 하이브리드 Skill 검색**
- Files: `api/app/services/skill_search.py` [신규].
- 방법: `manufacturer/model` 정확 매칭 + OCR `pg_trgm` + 임베딩 `pgvector`.
- Verification: 동일/유사/무관 device 시나리오 테스트.

**Task 2.5: 분석 API 통합**
- Files: `app/api/analyze/route.js` (FastAPI 프록시로 축소), `api/app/api/v1/analyze.py` [신규].
- 응답에 `skill_reference` 포함: 참조한 SKILL.md 슬러그/버전/신뢰도.
- Verification: 기존 클라이언트 동작 + `skill_reference` 필드 검증.

### M3. Skill 후보 생성

**Task 3.1: observations 스키마**
- Files: `api/app/models/observation.py`, Alembic.

**Task 3.2: 관찰 집계 규칙**
- Files: `api/app/services/observations.py` [신규].
- 규칙: 같은 `observation_type` + 같은 `device_id`가 N개 이상 모이면 후보 생성 트리거.

**Task 3.3: Celery 인프라**
- Files: `api/app/workers/celery_app.py`, `docker-compose.yml` [신규].
- Verification: `identify_device`, `build_visual_embedding` 등 잡 실행 확인.

**Task 3.4: Skill 후보 생성기**
- Files: `api/app/services/skill_generator.py` [신규].
- 입력: 관찰 N건 + 기존 published SKILL.md + 원본 이미지 참조.
- 출력: `draft` SKILL.md + `generation_reason` 필드.

**Task 3.5: 검토 큐 노출**
- Files: `api/app/api/v1/admin/skills.py` [신규].
- Verification: 관리자 토큰으로 후보 목록 조회 가능.

### M4. 평가 게이트

**Task 4.1: evaluation_cases 골든셋**
- Files: `api/scripts/seed_eval_cases.py` [신규], `evaluation_cases` 시드.

**Task 4.2: 규칙 기반 평가기**
- Files: `api/app/evaluation/rules.py` [신규].
- 검증: 좌표 0~100, bbox 최소 크기, 단계 수 ≤ 5, 안전 문구, 한국어 자연스러움 휴리스틱.

**Task 4.3: LLM 평가기**
- Files: `api/app/evaluation/llm_judge.py` [신규].
- LLM-as-a-Judge로 “환각 여부”, “명령 안전성”, “단계 실행 가능성” 점수.

**Task 4.4: 관리자 검토 UI**
- Files: `app/admin/skills/page.jsx` [신규], `src/lib/adminAuth.js` [신규].
- 표시: 원본 SKILL.md, diff, 평가 점수, 근거 관찰.
- 동작: approve / reject / request changes.

### M5. 게시 / 롤백 / 감사

**Task 5.1: 상태 머신 구현**
- Files: `api/app/services/skill_state_machine.py` [신규].
- Verification: 잘못된 전이 거부 테스트.

**Task 5.2: SKILL.md export 동기화**
- Files: `api/app/services/skill_export.py` [신규], `skills/<slug>/vX.Y.Z.md`로 export.
- Verification: published 버전 변경 시 파일이 동기화.

**Task 5.3: 롤백**
- Files: `api/app/api/v1/admin/skills.py`에 `POST /:id/rollback`.
- Verification: 현재 published가 deprecated로, 이전 published가 다시 published로.

**Task 5.4: audit_logs**
- Files: `api/app/models/audit_log.py`, 모든 상태 변경 훅.
- Verification: 모든 전이가 audit_logs에 남는지 테스트.

### M6. 개인정보 안전장치

**Task 6.1: 동의 흐름 UI**
- Files: `src/lib/consent.js` [신규], `src/App.jsx` 초기 단계.
- 기본: 미보관. “더 나은 안내에 기여” 체크 시에만 보관 + 마스킹.

**Task 6.2: PII 마스킹**
- Files: `api/app/safety/redact.py` [신규].
- 얼굴/이름/전화번호/주소/메시지/EXIF 좌표 제거.

**Task 6.3: 보관 만료**
- Files: `api/app/workers/jobs/expire_media.py` [신규], Celery beat.
- Verification: 보관 기간 지난 asset 자동 삭제, 익명 데이터만 보존.

---

## 8. SKILL.md 템플릿

```markdown
---
name: <manufacturer>-<model>-<variant>-guide
description: <짧은 트리거 설명>
version: <SemVer>
device:
  category: <kiosk|washer|boiler|smartphone|...>
  manufacturer: <Brand>
  model_family: <Family>
  firmware_version_range: <optional>
  ui_variant: <optional>
applies_when:
  visual_signals: [...]
  ocr_signals: [...]
  excluded_signals: [...]
safety_rules:
  - <위반 시 거부되는 규칙>
supported_goals:
  - name: <목표>
    hint: <아이콘/짧은 안내>
    steps: [...]
references:
  screens: <optional JSON 경로>
---

# 적용 조건
# 안전 규칙
# 지원 목표
# 목표별 단계
# 화면 변화
# 알려진 변형
# 실패 복구
# 완료 확인
```

자주 변하는 좌표/오버레이 데이터는 별도 JSON(`references/screens.json`)으로 두고 SKILL.md 본문은 행동 중심으로 유지한다.

## 9. API 라우트 초안

### Next.js (얇은 프록시 + UI 전용)

| Method | Path | 책임 |
|---|---|---|
| POST | `/api/analyze` | FastAPI `/v1/analyze`로 위임, 자격증명/스키마 검증 |
| POST | `/api/telemetry` | 클라이언트 이벤트 수집 후 FastAPI 또는 직접 DB |
| GET | `/admin/skills` | 관리자 페이지 SSR |

### FastAPI (`/v1`)

| Method | Path | 책임 |
|---|---|---|
| POST | `/v1/analyze` | 이미지 + 목표 → Skill 참조 + 단계 |
| POST | `/v1/events` | 클라이언트 이벤트 저장 |
| GET  | `/v1/devices/{id}/skill` | 게시된 SKILL.md 조회 |
| POST | `/v1/devices/identify` | 이미지 → device 후보 |
| GET  | `/v1/admin/skills/candidates` | 검토 큐 |
| POST | `/v1/admin/skills/{id}/approve` | 게시 |
| POST | `/v1/admin/skills/{id}/rollback` | 롤백 |
| GET  | `/health` | liveness, DB ping |

## 10. 환경변수 (요약)

### Frontend (`.env.local`)

```text
NEXT_PUBLIC_API_BASE_URL=https://<api-host>
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=<anon>
LANGFUSE_PUBLIC_KEY=<public>
LANGFUSE_SECRET_KEY=<secret>
```

### Backend (`api/.env`)

```text
DATABASE_URL=postgresql+psycopg://...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=<service_role>
REDIS_URL=rediss://...
GEMINI_API_KEY=<gemini>
LANGFUSE_HOST=https://cloud.langfuse.com
LANGFUSE_PUBLIC_KEY=...
LANGFUSE_SECRET_KEY=...
SENTRY_DSN=...
ADMIN_TOKEN=<rotated>
```

## 11. 검증 전략

- **단위 테스트**: 서비스/모델/평가기별 pytest. SKILL.md 검증기는 골든 파일 기반.
- **통합 테스트**: FastAPI `TestClient`로 `/v1/analyze` 라운드트립.
- **계약 테스트**: OpenAPI 스키마 + 응답 스키마 일치.
- **회귀 테스트**: 게시된 모든 Skill에 대해 evaluation_cases로 자동 평가.
- **부하 테스트**: k6로 `/v1/events` 100 RPS, p95 < 300ms.
- **보안 테스트**: 이미지 업로드 MIME 검증, EXIF 제거, PII 마스킹 정확도.
- **수동 점검**: 관리자 UI에서 diff/평가 점수 확인 후 승인.

## 12. 배포 / 운영

- **CI (GitHub Actions)**
  - Frontend: `npm ci` → `npm test` → `npm run lint` → `npm run build`
  - Backend: `ruff` → `mypy` → `pytest` → Docker build
  - 마이그레이션은 PR에서 dry-run, main 머지 시 자동 apply
- **호스팅**
  - Next.js: Vercel 또는 Render Web Service
  - FastAPI: Render Web Service 또는 Fly.io
  - Worker: Render Background Worker 또는 Fly.io worker
  - Postgres + Storage: Supabase
  - Redis: Upstash
- **관측**
  - Langfuse로 Gemini 호출/임베딩/평가 trace
  - Sentry로 프론트/백엔드 예외 수집
  - GitHub Actions에서 `git diff --check`

## 13. 위험과 트레이드오프

| 위험 | 대응 |
|---|---|
| 잘못된 Skill이 빠르게 전파 | draft → 평가 → 사람 승인 게이트 + 자동 롤백 |
| 원본 이미지 유출 | 기본 미보관 + 동의 시에만 Storage, 만료 + 마스킹 |
| 평가 데이터 부족 | evaluation_cases 골든셋을 사람이 작성, 평가기는 점진 확장 |
| 검색이 잘못된 제품을 매칭 | 신뢰도 기반 분기: 높음/중간/낮음/매우 낮음 |
| pgvector 성능 저하 | HNSW로 시작, 데이터 ≥100k 시 Qdrant 분리 검토 |
| AI가 자신의 출력을 자화자찬 | 외부 신호(사용자 성공/실패/재시도)만 학습 근거로 사용 |
| 배포 시 lockfile 불일치 | `npm ci` 배포 게이트, 마이그레이션 dry-run |

## 14. 열린 질문 (구현 전 사용자 확인 필요)

1. **관리자 인증 방식**: Supabase Auth + 이메일 화이트리스트 vs 단순 토큰?
2. **동의 UX 시점**: 첫 화면에서 한 번 묻기 vs 매 세션마다?
3. **다국어**: 현재는 한국어만. 향후 영어/일본어 확장은 SKILL.md 언어별 파일로?
4. **자동 게시 임계치**: 작은 패치(예: 오타 수정)는 자동 게시 가능하게 할지?
5. **모델 미세조정 도입 시점**: 평가 데이터 ≥ N건 이상이고 자동 평가가 안정적이면 고려.
6. **Storage 비용**: 원본 보관 시 Supabase 비용 vs 장기 미보관 시 재학습 데이터 부족 트레이드오프.

## 15. 실행 순서 요약

```text
M0 (기반 정비)
  └─▶ M1 (관측 수집)
        └─▶ M2 (제품 식별 + Skill 검색)
              └─▶ M3 (Skill 후보 생성)
                    └─▶ M4 (평가 게이트)
                          └─▶ M5 (게시/롤백/감사)
                                └─▶ M6 (개인정보 안전장치, 상시 적용)
```

각 마일스톤 끝에서 다음을 만족할 때 다음으로 진행한다.

- [ ] 모든 신규 코드 단위/통합 테스트 통과
- [ ] Lint/타입체크/빌드 성공
- [ ] 평가 골든셋 회귀 통과
- [ ] 운영 위험 메모 업데이트
- [ ] 사용자 검토 후 다음 마일스톤 진입 합의