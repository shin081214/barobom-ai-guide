import { afterEach, expect, test, vi } from 'vitest';

const originalKey = process.env.GEMINI_API_KEY;

function createRequest(body = { image: 'abc', mimeType: 'image/png' }) {
  return new Request('http://localhost/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalKey;
  vi.restoreAllMocks();
});

test('GEMINI_API_KEY가 없으면 503과 MISSING_CONFIG를 반환한다', async () => {
  delete process.env.GEMINI_API_KEY;
  const { POST } = await import('./route.js');

  const response = await POST(createRequest());

  expect(response.status).toBe(503);
  await expect(response.json()).resolves.toEqual({
    error: 'MISSING_CONFIG',
    missing: ['GEMINI_API_KEY'],
  });
});

test('빈 문자열 또는 공백으로 설정된 키도 누락으로 처리한다', async () => {
  process.env.GEMINI_API_KEY = '   ';
  const { POST } = await import('./route.js');

  const response = await POST(createRequest());

  expect(response.status).toBe(503);
  await expect(response.json()).resolves.toEqual({
    error: 'MISSING_CONFIG',
    missing: ['GEMINI_API_KEY'],
  });
});

test('GEMINI_API_KEY만 설정되면 정상 분석 흐름으로 진행한다', async () => {
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  const geminiPayload = {
    candidates: [{
      content: {
        parts: [{
          text: JSON.stringify({
            goals: [{
              label: '결제하기',
              hint: '결제 버튼을 찾아요',
              icon: '✅',
              steps: [{
                text: '결제 버튼을 눌러주세요.',
                label: '결제',
                box: { x: 10, y: 20, w: 30, h: 15 },
              }],
            }],
          }),
        }],
      },
    }],
  };
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
    JSON.stringify(geminiPayload),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  ));
  const { POST } = await import('./route.js');

  const response = await POST(createRequest());

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({
    goals: [{
      id: 'goal-1',
      label: '결제하기',
      hint: '결제 버튼을 찾아요',
      icon: '✅',
      steps: [{
        text: '결제 버튼을 눌러주세요.',
        label: '결제',
        box: { x: 10, y: 20, w: 30, h: 15 },
      }],
    }],
  });
  expect(fetch).toHaveBeenCalledOnce();
});

test('Gemini 사용량 제한은 429와 재시도 가능한 오류로 전달한다', async () => {
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
    JSON.stringify({
      error: {
        code: 429,
        status: 'RESOURCE_EXHAUSTED',
        message: 'Quota exceeded. Please retry in 32.2s.',
      },
    }),
    { status: 429, headers: { 'Content-Type': 'application/json' } },
  ));
  const { POST } = await import('./route.js');

  const response = await POST(createRequest());

  expect(response.status).toBe(429);
  expect(response.headers.get('Retry-After')).toBe('35');
  await expect(response.json()).resolves.toEqual({
    error: 'RATE_LIMITED',
    message: 'AI 사용량이 잠시 많아요. 35초 뒤에 다시 시도해주세요.',
    retryAfter: 35,
  });
});
