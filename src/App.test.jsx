import { expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import App from './App.jsx';

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
