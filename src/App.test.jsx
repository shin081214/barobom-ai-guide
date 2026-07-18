import { expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import App, { __testing__ } from './App.jsx';
const { parseBoxFromText } = __testing__;

vi.mock('./lib/feedback.js', () => ({
  publishEvent: vi.fn().mockResolvedValue('mock-session-id'),
  resetSession: vi.fn(),
  identifyDevice: vi.fn().mockResolvedValue(null),
}));
vi.mock('./lib/liveVoice.js', () => ({
  startLiveSession: vi.fn(() => ({
    speak: vi.fn().mockResolvedValue(),
    speakWithVision: vi.fn().mockResolvedValue(),
    mute: vi.fn(),
    unmute: vi.fn(),
    stop: vi.fn(),
    get state() { return 'disconnected'; },
  })),
}));

test('첫 화면에 실시간 AI로 시작만 보여준다', () => {
  render(<App />);

  expect(screen.getByRole('heading', { name: '실시간 AI로 시작하기' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '실시간 AI로 시작' })).toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: '더 나은 안내를 위해 사진 제공에 동의합니다 (선택)' })).toBeInTheDocument();
  expect(screen.queryByRole('textbox', { name: '하고 싶은 일' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '다음 단계' })).not.toBeInTheDocument();
});

test('실시간 AI로 시작을 클릭하면 방식 선택 박스가 나타난다', async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole('button', { name: '실시간 AI로 시작' }));

  expect(screen.getByText('실시간 AI 도움 방식을 선택해주세요')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /카메라 실시간 영상으로 도움받기/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /사진을 먼저 한 장 찍어서 도움받기/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '취소하고 돌아가기' })).toBeInTheDocument();
});

test('카메라 실시간 영상으로 도움받기를 클릭하면 실시간 AI 세션을 연결하고 가이드 화면을 보여준다', async () => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ key: 'mock-gemini-key' }),
  });

  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole('button', { name: '실시간 AI로 시작' }));
  await user.click(screen.getByRole('button', { name: /카메라 실시간 영상으로 도움받기/ }));

  expect(await screen.findByText('화면을 보여주며 음성으로 질문하세요.')).toBeInTheDocument();
});

test('사진을 먼저 한 장 찍어서 도움받기를 클릭하면 사진 등록 화면으로 이동한다', async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole('button', { name: '실시간 AI로 시작' }));
  await user.click(screen.getByRole('button', { name: /사진을 먼저 한 장 찍어서 도움받기/ }));

  expect(screen.getByRole('heading', { name: '도움받을 화면을 찍어주세요' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '사진 찍기' })).toBeInTheDocument();
});

test('글자 크기를 보통에서 아주 크게까지 단계적으로 조절한다', async () => {
  const user = userEvent.setup();
  const { container } = render(<App />);

  expect(container.firstChild).toHaveClass('text-normal');
  expect(screen.getByText('보통')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: '글자 크게' }));
  expect(container.firstChild).toHaveClass('text-large');
  expect(screen.getByText('크게')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: '글자 크게' }));
  expect(container.firstChild).toHaveClass('text-xlarge');
  expect(screen.getByText('아주 크게')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '글자 크게' })).toBeDisabled();
});

test('개인정보 동의 흐름이 체크박스 및 헤더 텍스트와 정상적으로 연동된다', async () => {
  const user = userEvent.setup();
  
  // 1. 초기 렌더링 (동의하지 않음)
  localStorage.removeItem('barobom_user_consent');
  render(<App />);
  
  const checkbox = screen.getByRole('checkbox', { name: '더 나은 안내를 위해 사진 제공에 동의합니다 (선택)' });
  expect(checkbox).not.toBeChecked();
  expect(screen.getByText('사진은 저장하지 않아요')).toBeInTheDocument();
  expect(screen.queryByText('사진은 마스킹 후 개선에 쓰여요')).not.toBeInTheDocument();

  // 2. 체크박스 체크 -> 헤더 변경 및 localStorage 저장
  await user.click(checkbox);
  expect(checkbox).toBeChecked();
  expect(screen.getByText('사진은 마스킹 후 개선에 쓰여요')).toBeInTheDocument();
  expect(screen.queryByText('사진은 저장하지 않아요')).not.toBeInTheDocument();
  expect(localStorage.getItem('barobom_user_consent')).toBe('true');

  // 3. 체크박스 체크 해제 -> 헤더 원복 및 localStorage 저장
  await user.click(checkbox);
  expect(checkbox).not.toBeChecked();
  expect(screen.getByText('사진은 저장하지 않아요')).toBeInTheDocument();
  expect(screen.queryByText('사진은 마스킹 후 개선에 쓰여요')).not.toBeInTheDocument();
  expect(localStorage.getItem('barobom_user_consent')).toBe('false');
});

test('localStorage에 이미 true로 저장된 상태에서 렌더링 시 동의 상태가 적용된다', async () => {
  localStorage.setItem('barobom_user_consent', 'true');
  render(<App />);
  
  const checkbox = screen.getByRole('checkbox', { name: '더 나은 안내를 위해 사진 제공에 동의합니다 (선택)' });
  expect(checkbox).toBeChecked();
  expect(screen.getByText('사진은 마스킹 후 개선에 쓰여요')).toBeInTheDocument();
});

// ────────────────────────────────────────────────────────────────────────
// parseBoxFromText — Live API 응답에서 박스 토큰만 안전하게 추출한다.
// robotics-spatial-understanding의 extractJsonArray / clip01k 패턴을 차용해
// 0~100 강제 클립, NaN→null, not-found([0,0,0,0])→null, 공백·대소문자 변형
// 까지 단위 검증한다.
// ────────────────────────────────────────────────────────────────────────

test('parseBoxFromText: 표준 [box: x, y, w, h] 형식을 그대로 파싱한다', () => {
  expect(parseBoxFromText('여기를 눌러보세요. [box: 7, 20, 40, 31]'))
    .toEqual({ x: 7, y: 20, w: 40, h: 31 });
});

test('parseBoxFromText: 0~100 범위 밖 값은 강제로 클립한다', () => {
  expect(parseBoxFromText('[box: 105, -3, 200, 50]'))
    .toEqual({ x: 100, y: 0, w: 100, h: 50 });
});

test('parseBoxFromText: 모든 좌표가 0인 박스는 not-found로 보고 null을 반환한다', () => {
  expect(parseBoxFromText('[box: 0, 0, 0, 0]')).toBeNull();
});

test('parseBoxFromText: 공백·대소문자·소수점 변형에 모두 견딘다', () => {
  expect(parseBoxFromText('[ Box : 1.5 , 2.5 , 3.5 , 4.5 ]'))
    .toEqual({ x: 1.5, y: 2.5, w: 3.5, h: 4.5 });
});

test('parseBoxFromText: 펜스([])가 없는 일반 문장 안의 box:는 무시한다 (false-positive 방지)', () => {
  expect(parseBoxFromText('box: 7, 20, 40, 31 is just text')).toBeNull();
});

test('parseBoxFromText: onlyFirst 옵션이 켜져 있으면 첫 번째 박스를 채택한다', () => {
  const text = 'first [box: 1, 2, 3, 4] then [box: 5, 6, 7, 8]';
  expect(parseBoxFromText(text, { onlyFirst: true }))
    .toEqual({ x: 1, y: 2, w: 3, h: 4 });
});

test('parseBoxFromText: 기본 동작에서는 마지막 박스를 채택한다', () => {
  const text = 'first [box: 1, 2, 3, 4] then [box: 5, 6, 7, 8]';
  expect(parseBoxFromText(text))
    .toEqual({ x: 5, y: 6, w: 7, h: 8 });
});
