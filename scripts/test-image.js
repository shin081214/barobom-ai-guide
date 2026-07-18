#!/usr/bin/env node
// test_image 분석 테스트 스크립트
// 사용법: node scripts/test-image.js

const fs = require('fs');
const path = require('path');

// .env.local에서 GEMINI_API_KEY 로드
function loadEnv(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.+)$/);
    if (match && !match[2].startsWith('#')) {
      env[match[1]] = match[2].trim();
    }
  }
  return env;
}

const env = loadEnv(path.join(__dirname, '..', '.env.local'));
const API_KEY = env.GEMINI_API_KEY;

if (!API_KEY || API_KEY === '여기에_실제_키를_넣으세요' || API_KEY.includes('your_api_key')) {
  console.error('ERROR: GEMINI_API_KEY가 설정되지 않았습니다. .env.local을 확인하세요.');
  process.exit(1);
}

console.log('GEMINI_API_KEY: 설정됨 (' + API_KEY.length + ' chars, 앞4자: ' + API_KEY.slice(0, 4) + '...)');

const imgPath = path.join(__dirname, '..', 'test_image.png');
const img = fs.readFileSync(imgPath);
const b64 = img.toString('base64');

console.log('이미지: ' + imgPath + ' (' + img.length + ' bytes, base64 ' + b64.length + ' chars)');
console.log('프롬프트: 이 사진이 어떤 기기인지 설명 (기기 종류, 브랜드, 모델명 추측)\n');

const model = 'gemini-3.5-flash';
const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

fetch(endpoint, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{
      role: 'user',
      parts: [
        { text: '이 사진이 어떤 기기인지 설명해주세요. 기기 종류, 브랜드, 모델명을 추측해주세요.' },
        { inlineData: { mimeType: 'image/png', data: b64 } }
      ]
    }]
  })
}).then(r => {
  console.log('HTTP 상태:', r.status);
  return r.json();
}).then(data => {
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  console.log('=== Gemini 응답 ===');
  console.log(text);
  console.log('');
  console.log('토큰 사용량:', JSON.stringify(data?.usageMetadata || {}));
}).catch(e => {
  console.error('ERROR:', e.message);
});
