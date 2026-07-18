# Plan: 실시간 API 안내 상자(바운딩 박스) 표시 기능 구현

## 개요
Gemini Live API (`gemini-3.1-flash-live-preview`) 세션 중 모델이 특정 UI 요소나 클릭 대상을 안내할 때, 텍스트 응답에 `[box: x, y, w, h]` 좌표 태그를 포함하도록 유도하고, 프론트엔드에서 이를 실시간으로 파싱하여 화면에 시각적 안내 상자(바운딩 박스)를 그려주도록 구현합니다.

---

## 작업 목록 (Tasks)

### Task 1: `src/App.jsx`에 `liveBox` 상태 추가 및 실시간 응답 파싱
- **목표:** Live API 응답 텍스트에서 `[box: x, y, w, h]` 패턴을 추출하여 `liveBox` 상태 변수에 저장하고, 세션 리셋 및 사용자 발화 시 초기화합니다.
- **상세 내용:**
  1. `src/App.jsx` 상단에 `const [liveBox, setLiveBox] = useState(null);` 추가.
  2. `liveBox`를 파싱하는 헬퍼 함수 `parseBoxFromText(text)` 작성:
     - 정규식 `/\[box:\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\]/i` 사용.
  3. `createLiveSession` 내부에서 `let accumulatedText = '';` 선언.
  4. `onResponse`가 호출될 때마다 `accumulatedText += text;` 하고, `parseBoxFromText(accumulatedText)` 결과가 있으면 `setLiveBox(box)` 호출.
  5. `onTranscription`에서 `speaker === 'user'` 일 때 `accumulatedText = ''; setLiveBox(null);`를 호출하여 새로운 대화가 시작되면 기존 박스를 지움.
  6. `reset()` 함수가 실행될 때 `setLiveBox(null);` 호출.
- **검증 기준:** `src/App.jsx`에 구문 오류가 없어야 하며, 리셋 흐름이 온전히 작동해야 함.

### Task 2: `VisualGuide` 오버레이 렌더링에 `liveBox` 연동
- **목표:** `selectedGoal?.id === 'goal-live'`일 때 `liveBox` 데이터를 `VisualGuide` 컴포넌트에 주입하여 화면에 안내 상자를 렌더링합니다.
- **상세 내용:**
  1. `src/App.jsx`에서 `VisualGuide`를 렌더링하는 부분의 `step` 속성에 주입하기 전, `displayStep`을 계산하는 `useMemo` 추가:
     ```javascript
     const displayStep = useMemo(() => {
       if (selectedGoal?.id === 'goal-live' && liveBox) {
         return {
           ...step,
           box: liveBox,
           label: '여기예요',
         };
       }
       return step;
     }, [selectedGoal, step, liveBox]);
     ```
  2. `<VisualGuide imageUrl={imageUrl} step={displayStep} />`로 수정.
- **검증 기준:** `selectedGoal`이 실시간이고 `liveBox`가 있을 때 바운딩 박스가 올바르게 렌더링되는지 확인.

### Task 3: Gemini Live API 시스템 프롬프트 업데이트
- **목표:** 모델이 위치 안내 시 퍼센트 좌표 형태의 `[box: x, y, w, h]` 태그를 정확히 붙이도록 가이드라인을 시스템 프롬프트에 제공합니다.
- **상세 내용:**
  1. `src/App.jsx` 내 `createLiveSession` 및 `startLiveFromHome` 함수들의 `prompt` 또는 `systemPrompt` 변수 수정.
  2. 기기 화면의 각 요소(김밥 메뉴, 카드 투입구 등) 위치를 가리키는 예시와 함께, 정확한 컴포넌트 위치에 맞춘 퍼센트 좌표를 `[box: x, y, w, h]` 형식으로 대답 끝에 덧붙이라는 지침을 추가합니다.
- **검증 기준:** 시스템 프롬프트에 관련 문구가 정상 삽입되었는지 소스 검증.

### Task 4: 통합 빌드 및 게이트 테스트 검증
- **목표:** 프로젝트의 빌드와 기존 단위 테스트가 정상 작동하며, 구문 오류나 런타임 버그가 없는지 검증합니다.
- **상세 내용:**
  1. `npm run build`를 실행하여 Next.js 빌드가 성공하는지 검증.
  2. `npm test`를 실행하여 49개의 테스트 케이스가 성공하는지 검증.
- **검증 기준:** 빌드 및 테스트 완전 통과.
