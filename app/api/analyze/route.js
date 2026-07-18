import { buildGeminiPrompt, normalizeAnalysis } from '../../../server/analyzer.js';

export const runtime = 'nodejs';

// 현재 분석 라우트에서 실제 사용하는 필수 환경변수는 GEMINI_API_KEY 뿐입니다.
// 아래 변수들은 future use only이므로 아직 required로 추가하지 않습니다:
//   FASTAPI_URL, SUPABASE_URL, SUPABASE_ANON_KEY, LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY
const REQUIRED_ENV = ['GEMINI_API_KEY'];

function getMissingConfig() {
  return REQUIRED_ENV.filter((key) => !process.env[key]?.trim());
}

export async function POST(request) {
  const missing = getMissingConfig();
  if (missing.length > 0) {
    return Response.json({ error: 'MISSING_CONFIG', missing }, { status: 503 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 });
  }

  const { image, mimeType = 'image/jpeg', requestedGoal = '' } = body ?? {};
  if (!image || typeof image !== 'string') {
    return Response.json({ error: '분석할 사진이 없습니다.' }, { status: 400 });
  }
  if (!String(mimeType).startsWith('image/')) {
    return Response.json({ error: '이미지 파일만 분석할 수 있습니다.' }, { status: 400 });
  }

  try {
    const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const geminiResponse = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { text: buildGeminiPrompt(requestedGoal) },
            { inlineData: { mimeType, data: image } },
          ],
        }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: {
            type: 'object',
            required: ['goals'],
            properties: {
              goals: {
                type: 'array',
                minItems: 1,
                maxItems: 4,
                items: {
                  type: 'object',
                  required: ['label', 'hint', 'icon', 'steps'],
                  properties: {
                    label: { type: 'string' },
                    hint: { type: 'string' },
                    icon: { type: 'string' },
                    steps: {
                      type: 'array',
                      minItems: 1,
                      maxItems: 5,
                      items: {
                        type: 'object',
                        required: ['text', 'label', 'box'],
                        properties: {
                          text: { type: 'string' },
                          label: { type: 'string' },
                          box: {
                            type: 'object',
                            required: ['x', 'y', 'w', 'h'],
                            properties: {
                              x: { type: 'number' }, y: { type: 'number' },
                              w: { type: 'number' }, h: { type: 'number' },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          temperature: 0.1,
          maxOutputTokens: 8192,
        },
      }),
    });

    if (!geminiResponse.ok) {
      const detail = await geminiResponse.text();
      console.error('Gemini API error:', geminiResponse.status, detail.slice(0, 500));

      if (geminiResponse.status === 429) {
        const retryMatch = detail.match(/retry in\s+([0-9.]+)s/i);
        const requestedWait = retryMatch ? Number(retryMatch[1]) : 30;
        const retryAfter = Math.max(5, Math.ceil(requestedWait / 5) * 5);
        return Response.json({
          error: 'RATE_LIMITED',
          message: `AI 사용량이 잠시 많아요. ${retryAfter}초 뒤에 다시 시도해주세요.`,
          retryAfter,
        }, {
          status: 429,
          headers: { 'Retry-After': String(retryAfter) },
        });
      }

      return Response.json({ error: 'AI가 사진을 분석하지 못했습니다.' }, { status: 502 });
    }

    const payload = await geminiResponse.json();
    const text = payload?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || '')
      .join('') || '';
    const parsed = JSON.parse(text.replace(/^```json\s*|\s*```$/g, '').trim());
    const result = normalizeAnalysis(parsed);
    result.skill_reference = [];  // populated when backend /v1/identify integration completed
    return Response.json(result);
  } catch (error) {
    console.error('Analysis error:', error);
    return Response.json({ error: '사진 분석 중 문제가 생겼습니다.' }, { status: 500 });
  }
}
