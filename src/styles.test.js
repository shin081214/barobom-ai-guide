import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

test('모바일 사진 프레임은 카드 높이 100%를 상속하지 않고 자체 비율 안에 머문다', () => {
  expect(css).toMatch(
    /\.image-card \.visual-frame\s*\{[^}]*height:\s*auto;[^}]*min-height:\s*0;[^}]*aspect-ratio:\s*4\s*\/\s*3;/,
  );
});

test('사진 카드는 자식 이미지가 경계를 넘어가도 바깥 영역을 침범하지 않는다', () => {
  expect(css).toMatch(/\.image-card\s*\{[^}]*overflow:\s*hidden;/);
});

test('일반 입력 라벨에는 노란 focus-within 테두리를 적용하지 않는다', () => {
  expect(css).not.toMatch(/(^|,)\s*label:focus-within\s*(,|\{)/m);
  expect(css).toMatch(/label\[role=['"]button['"]\]:focus-within/);
});

test('모바일 첫 화면은 장식용 안내 예시를 숨겨 실제 1단계만 보여준다', () => {
  expect(css).toMatch(/@media \(max-width: 620px\)[\s\S]*?\.hero-preview\s*\{[^}]*display:\s*none;/);
});
