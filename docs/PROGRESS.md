# 바로봄 (Barobom) 진행 상황 — 2026-07-19

## 프론트엔드 (`barobom-ai-guide`)

| 커밋 | 내용 |
|---|---|
| `aab4e8f` | fix(live): parse bounding box from speech transcription instead of raw parts text |
| `11159e4` | fix(live): resolve image overlay bounds rendering and generalize box regex pattern |
| `8d8970a` | fix(live): robust last-box matching and noise-resilient VAD clearing for Live mode |
| `73cae80` | feat(live): render live camera feed on the screen during Live API session |
| `ad35e2b` | fix(live): add robustness guard and percentage clamping to parseBoxFromText |
| `b4f4211` | feat(live): update Gemini Live API system prompt and refactor sessions to createLiveSession |
| `46cedd4` | feat(live): integrate liveBox state into VisualGuide for Live API mode |
| `7658bf1` | feat(live): add liveBox state and coordinate parsing in Live API |
| `b6c5ef9` | feat(live): add choice flow for live AI (camera vs static photo) |
| `a3293e6` | feat(consent): add consent flow UI and local persistence |
| `76985b9` | refactor(ui): remove 🧠 스킬 현황 button — footer 링크로만 진입 |
| `cdfe966` | feat(live): add "실시간 AI로 시작" button — instant Live API from home |
| `863833e` | feat(ui): add skills self-improvement dashboard panel |
| `f45272e` | 잘못됐어요 버튼 → backend `/v1/observations` 연동 |
| `42b605b` | `/api/analyze` 응답에 `skill_reference` placeholder |
| `8c6eb34` | `screen_changed` + `user_reported_wrong` 이벤트 + 잘못됐어요 버튼 |
| `12df383` | Live API setup에 audio transcription 활성화 |
| `2724354` | README + DEVELOPER + .env.example 최신화 |

### 게이트 검증
- `npm test`: 10 files, 49 tests ✅
- `npm run lint`: 0 errors ✅
- `npm run build`: Next.js 16.2.10 ✅

---

## 백엔드 (`192.168.45.155:8000` — barobom-backend)

**GitHub:** `https://github.com/amanhasfallenintoriverincity/barobom-backend`  
**커밋:** `125b624` — 37 files, 1817 lines

### 신규 파일 (서브에이전트 + 직접 보강)
| 파일 | 용도 |
|---|---|
| `api/app/safety/redact.py` | PII 마스킹 (전화번호·이메일·주민번호) 및 EXIF 제거 |
| `api/tests/test_redact.py` | PII 및 EXIF 마스킹 유닛/통합 테스트 |
| `api/app/models/observation.py` | Observation SQLAlchemy 모델 |
| `api/app/routers/observations.py` | `POST /v1/observations` + `GET /v1/observations/pending` |
| `api/app/routers/skills.py` | generate / evaluate / publish / rollback / list |
| `api/app/services/skill_generator.py` | Gemini로 SKILL.md 초안 생성 (3+ 관찰 시) |
| `api/app/services/skill_evaluator.py` | 규칙 기반 평가 (한글·위험문구·bbox·섹션 검증) |

### API 엔드포인트 — 11개 검증 완료
| 엔드포인트 | 상태 | 설명 |
|---|---|---|
| `GET /health` | ✅ | liveness, DB ping |
| `POST /v1/events` | ✅ | 실시간 PII 자동 마스킹 (DB/트레이스 보호) |
| `POST /v1/identify` | ✅ | EXIF 메타데이터(GPS/좌표) 실시간 제거 포함 |
| `POST /v1/skills/reload` | ✅ | 로컬 파일 → ChromaDB 갱신 |
| `POST /v1/observations` | ✅ | 사용자 피드백(잘못됐어요) 기록 |
| `GET /v1/observations/pending` | ✅ | 미처리 피드백 조회 |
| `GET /v1/skills` | ✅ | 전체 스킬 이력 조회 |
| `POST /v1/skills/generate` | ✅ | Gemini 초안 생성 |
| `POST /v1/skills/{id}/evaluate` | ✅ | 규칙 기반/LLM 기반 평가 |
| `POST /v1/skills/{id}/publish` | ✅ | 상태 전이 (draft -> published) |
| `POST /v1/skills/{id}/rollback` | ✅ | 롤백 (published -> deprecated) |

### Gemini API 키
- 백엔드 `.env`의 `GEMINI_API_KEY`를 프론트엔드 `.env.local`의 키로 교체 (429 해결)
- 모델: `gemini-3.5-flash`

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
| M6 | 개인정보 안전장치 | ✅ 100% |

**전체: 100% 완료 🎉**
- 이미지/데이터 기본 미보존 정책(Privacy-by-Design)을 완벽히 유지하므로 Storage 보관 만료(Task 6.3)는 원천 배제(N/A)됩니다.
