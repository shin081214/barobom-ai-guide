function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeBox(input = {}) {
  const x = clamp(number(input.x), 0, 96);
  const y = clamp(number(input.y), 0, 96);
  const w = clamp(number(input.w, 18), 4, 100 - x);
  const h = clamp(number(input.h, 12), 4, 100 - y);
  return { x, y, w, h };
}

export function normalizeAnalysis(input) {
  const icons = ['👆', '✅', '↩️', '🔍'];
  const goals = Array.isArray(input?.goals) ? input.goals : [];
  const normalized = goals.slice(0, 4).map((goal, goalIndex) => {
    const label = String(goal?.label ?? '').trim();
    const steps = Array.isArray(goal?.steps) ? goal.steps : [];
    const normalizedSteps = steps.slice(0, 5).map((step) => ({
      text: String(step?.text ?? '').trim(),
      label: String(step?.label ?? '여기').trim().slice(0, 16) || '여기',
      box: normalizeBox(step?.box),
    })).filter((step) => step.text);

    if (!label || normalizedSteps.length === 0) return null;
    return {
      id: `goal-${goalIndex + 1}`,
      label,
      hint: String(goal?.hint ?? '차근차근 안내해 드려요.').trim(),
      icon: String(goal?.icon ?? icons[goalIndex] ?? '👆').trim().slice(0, 4),
      steps: normalizedSteps,
    };
  }).filter(Boolean);

  if (normalized.length === 0) throw new Error('사용 가능한 안내를 찾지 못했습니다.');
  return { goals: normalized };
}

export const GEMINI_PROMPT = `당신은 고령층을 위한 디지털 기기 사용 도우미입니다.
사진 속 키오스크, 앱, 가전제품 화면을 보고 사용자가 할 만한 목표 3개를 찾으세요.
각 목표마다 2~4개의 단계를 만드세요. 문장은 존댓말로, 한 문장에 한 행동만, 초등학생도 이해할 쉬운 한국어로 쓰세요.
각 단계에는 눌러야 할 위치의 사각형을 사진 전체 기준 퍼센트 좌표 x,y,w,h(0~100)로 쓰세요.
x,y는 원본 사진 왼쪽 위에서 시작하는 대상의 왼쪽 위 좌표이고, w,h는 대상의 전체 너비와 높이입니다.
점이나 주변 여백이 아니라 사용자가 실제로 누를 수 있는 버튼·상품 카드 전체를 사각형 안에 포함하세요.
보이지 않는 버튼이나 다음 화면을 상상하지 마세요. 위험한 금융/결제 행동은 대신 실행하지 말고 사용자가 직접 확인하도록 안내하세요.
반드시 다음 JSON만 반환하세요:
{"goals":[{"label":"주문하기","hint":"메뉴를 골라 담아요","icon":"🍽️","steps":[{"text":"왼쪽의 메뉴를 눌러주세요.","label":"메뉴","box":{"x":5,"y":20,"w":30,"h":20}}]}]}`;

export function buildGeminiPrompt(requestedGoal = '') {
  const safeGoal = String(requestedGoal)
    .replace(/\s+/g, ' ')
    .replace(/["\\]/g, '')
    .trim()
    .slice(0, 120);

  if (!safeGoal) return GEMINI_PROMPT;

  return `${GEMINI_PROMPT.replace(
    '사용자가 할 만한 목표 3개를 찾으세요.',
    '아래 사용자가 요청한 일을 사진에서 어떻게 할 수 있는지 찾으세요.',
  )}

사용자가 원하는 일: "${safeGoal}"
목표는 정확히 1개만 반환하고 label은 사용자가 말한 일을 쉬운 표현으로 유지하세요.
사진에 필요한 버튼이 보이지 않으면 위치를 상상하지 말고, 전체 조작부가 보이게 다시 찍어달라는 단계를 반환하세요.`;
}
