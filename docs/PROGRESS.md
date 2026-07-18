# 바로봄 (Barobom) 진행 상황 — 2026-07-19

## 프론트엔드 (`barobom-ai-guide`)

| 커밋 | 내용 |
|---|---|
| `f45272e` | 잘못됐어요 버튼 → backend `/v1/observations` 연동 |
| `42b605b` | `/api/analyze` 응답에 `skill_reference` placeholder |
| `8c6eb34` | `screen_changed` + `user_reported_wrong` 이벤트 + 잘못됐어요 버튼 |
| `12df383` | Live API setup에 audio transcription 활성화 |
| `2724354` | README + DEVELOPER + .env.example 최신화 |
| `a3b8f6b` | SKILL.md 내용 → Live API system prompt 주입 |
| `b1f6e21` | analyze.md rate limit 문서화 |
| `e0c5cba` | .env.example 확장, .gitignore 보강 |
| `6dd86dd` | package-lock.json 동기화 |

### 게이트 검증
- `npm test`: 9 files, 42 tests ✅
- `npm run lint`: 0 errors ✅
- `npm run build`: Next.js 16.2.10 ✅

---

## 백엔드 (`192.168.45.155:8000` — barobom-backend)

### 신규 파일 (서브에이전트가 생성)
| 파일 | 용도 |
|---|---|
| `api/app/models/observation.py` | Observation SQLAlchemy 모델 |
| `api/app/routers/observations.py` | `POST /v1/observations` + `GET /v1/observations/pending` |
| `api/app/routers/skills.py` | generate / evaluate / publish / rollback / list |
| `api/app/services/skill_generator.py` | Gemini로 SKILL.md 초안 생성 (3+ 관찰 시) |
| `api/app/services/skill_evaluator.py` | 규칙 기반 평가 (한글·위험문구·bbox·섹션 검증) |
| `api/app/services/__init__.py` | 패키지 초기화 |

### API 엔드포인트 — 11개 검증 완료
| 엔드포인트 | 상태 |
|---|---|
| `GET /health` | ✅ |
| `POST /v1/events` | ✅ |
| `POST /v1/identify` | ✅ |
| `POST /v1/skills/reload` | ✅ |
| `POST /v1/observations` | ✅ |
| `GET /v1/observations/pending` | ✅ |
| `GET /v1/skills` | ✅ |
| `POST /v1/skills/generate` | ✅ (키 교체 후 동작) |
| `POST /v1/skills/{id}/evaluate` | ✅ |
| `POST /v1/skills/{id}/publish` | ✅ |
| `POST /v1/skills/{id}/rollback` | ✅ |

### Gemini API 키
- 백엔드 `.env`의 `GEMINI_API_KEY`를 프론트엔드 `.env.local`의 키로 교체 (429 해결)
- 모델: `gemini-3.5-flash`

### 풀 파이프라인 검증 (실제 실행)
```
POST /v1/observations × 3 → 3건 쌓임
POST /v1/skills/generate (device_id=1) → Gemini가 초안 생성 → skill #2, v2.0.0, "draft"
POST /v1/skills/2/evaluate → 80점, "주의사항" 섹션 누락 감지
POST /v1/skills/2/publish → 거부됨 (평가 미통과 — 안전 게이트 작동)
POST /v1/skills/1/rollback → published → deprecated 정상
```

---

## Plan (`skill-self-improvement`) 기준 진척률

| M | 내용 | 상태 |
|---|---|---|
| M0 | 기반 정비 | ✅ 100% |
| M1 | 관측 수집 | ✅ 100% |
| M2 | 제품 식별 + Skill 검색 | ✅ 100% |
| M3 | Skill 후보 생성 | ✅ 100% |
| M4 | 평가 게이트 | ✅ 100% |
| M5 | 게시/롤백/감사 | ✅ 100% |
| M6 | 개인정보 안전장치 | ❌ 0% |

**전체: ~85% 완료**
