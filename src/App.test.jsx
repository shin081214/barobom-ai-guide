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

function installSpeechRecognition(transcript) {
  class FakeSpeechRecognition {
    constructor() { window.__recognition = this; }
    start() {
      this.onstart?.();
      this.onresult?.({ results: [[{ transcript }]] });
      this.onend?.();
    }
    stop() { this.onend?.(); }
  }
  window.SpeechRecognition = FakeSpeechRecognition;
  window.webkitSpeechRecognition = undefined;
}

async function renderWithAnalyzedPhoto(goal, filename = 'device.png') {
  URL.createObjectURL = vi.fn(() => `blob:${filename}`);
  URL.revokeObjectURL = vi.fn();
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ goals: [goal] }) });
  const user = userEvent.setup();
  const view = render(<App />);
  await user.type(screen.getByRole('textbox', { name: '하고 싶은 일' }), goal.label);
  await user.click(screen.getByRole('button', { name: '다음 단계' }));
  await user.upload(view.container.querySelector('input[type="file"]'), new File(['photo'], filename, { type: 'image/png' }));
  await screen.findByText(goal.steps[0].text);
  return { user, ...view };
}

test('먼저 하고 싶은 일을 묻고 목적을 정한 뒤에만 사진 촬영을 보여준다', async () => {
  const user = userEvent.setup();
  render(<App />);

  expect(screen.getByRole('heading', { name: '무엇을 하고 싶으세요?' })).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: '하고 싶은 일' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '말로 입력하기' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '다음 단계' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '사진 찍기' })).not.toBeInTheDocument();
  expect(screen.queryByText(/사진은 브라우저에서만 미리 봅니다/)).not.toBeInTheDocument();

  await user.type(screen.getByRole('textbox', { name: '하고 싶은 일' }), '빅맥 주문하기');
  await user.click(screen.getByRole('button', { name: '다음 단계' }));

  expect(screen.getByRole('heading', { name: '이제 화면을 찍어주세요' })).toBeInTheDocument();
  expect(screen.getByText('빅맥 주문하기')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '사진 찍기' })).toBeInTheDocument();
});

test('실제 사진에서 분석된 목표를 고르고 단계별 안내를 진행한다', async () => {
  const goal = {
    id: 'goal-1', label: '표준 세탁하기', hint: '기본 코스로 세탁해요', icon: '🧺',
    steps: [
      { text: '전원 버튼을 눌러주세요.', label: '전원', box: { x: 10, y: 20, w: 15, h: 15 } },
      { text: '표준 코스를 눌러주세요.', label: '표준', box: { x: 35, y: 20, w: 20, h: 15 } },
      { text: '동작 버튼을 눌러주세요.', label: '동작', box: { x: 70, y: 20, w: 15, h: 15 } },
    ],
  };
  const { user } = await renderWithAnalyzedPhoto(goal, 'washer.png');
  expect(screen.getByText('1 / 3 단계')).toBeInTheDocument();
  expect(screen.getByText('전원 버튼을 눌러주세요.')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: '다음 단계' }));
  expect(screen.getByText('2 / 3 단계')).toBeInTheDocument();
  expect(screen.getByText('표준 코스를 눌러주세요.')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: '다음 단계' }));
  expect(screen.getByText('3 / 3 단계')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '다 했어요' }));
  expect(screen.getByRole('heading', { name: '잘하셨어요!' })).toBeInTheDocument();
});

test('세로 사진의 강조 네모는 object-fit 여백이 아닌 실제 사진 영역을 좌표계로 사용한다', async () => {
  const goal = {
    id: 'goal-1', label: '결제하기', hint: '결제 버튼을 찾아요', icon: '💳',
    steps: [{ text: '결제하기 버튼을 눌러주세요.', label: '결제하기', box: { x: 70, y: 80, w: 20, h: 10 } }],
  };
  const { container } = await renderWithAnalyzedPhoto(goal, 'portrait-kiosk.png');

  const frame = container.querySelector('.guide-image .visual-frame');
  const image = frame.querySelector('img');
  vi.spyOn(frame, 'getBoundingClientRect').mockReturnValue({
    width: 400, height: 300, left: 0, top: 0, right: 400, bottom: 300, x: 0, y: 0, toJSON: () => ({}),
  });
  Object.defineProperty(image, 'naturalWidth', { configurable: true, value: 300 });
  Object.defineProperty(image, 'naturalHeight', { configurable: true, value: 600 });

  fireEvent.load(image);

  const overlay = container.querySelector('.visual-image-overlay');
  expect(overlay).toHaveStyle({ left: '125px', top: '0px', width: '150px', height: '300px' });
  expect(overlay.querySelector('.target-box')).toHaveStyle({ left: '70%', top: '80%', width: '20%', height: '10%' });
});

test('현재 안내를 음성으로 다시 들을 수 있다', async () => {
  const speak = vi.fn();
  window.speechSynthesis.speak = speak;
  const goal = {
    id: 'goal-1', label: '난방 켜기', hint: '난방을 시작해요', icon: '🔥',
    steps: [{ text: '난방 버튼을 눌러주세요.', label: '난방', box: { x: 40, y: 30, w: 20, h: 20 } }],
  };
  const { user } = await renderWithAnalyzedPhoto(goal, 'boiler.png');
  await user.click(screen.getByRole('button', { name: '다시 듣기' }));

  expect(speak).toHaveBeenCalled();
});

test('먼저 정한 목적과 사진을 함께 보내고 목표 목록 없이 바로 안내를 시작한다', async () => {
  URL.createObjectURL = vi.fn(() => 'blob:test-image');
  URL.revokeObjectURL = vi.fn();
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ goals: [{
      id: 'goal-1', label: '빅맥 주문하기', hint: '빅맥을 주문해요', icon: '🍔',
      steps: [{ text: '빅맥 메뉴를 눌러주세요.', label: '빅맥', box: { x: 50, y: 40, w: 20, h: 20 } }],
    }] }),
  });
  const user = userEvent.setup();
  const { container } = render(<App />);

  await user.type(screen.getByRole('textbox', { name: '하고 싶은 일' }), '빅맥 주문하기');
  await user.click(screen.getByRole('button', { name: '다음 단계' }));
  await user.upload(container.querySelector('input[type="file"]'), new File(['photo'], 'kiosk.png', { type: 'image/png' }));

  expect(await screen.findByText('빅맥 메뉴를 눌러주세요.')).toBeInTheDocument();
  expect(screen.getByText('1 / 1 단계')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /빅맥 주문하기/ })).not.toBeInTheDocument();
  const request = JSON.parse(global.fetch.mock.calls[0][1].body);
  expect(request.requestedGoal).toBe('빅맥 주문하기');
  expect(request.image).toBeTruthy();
});

test('AI 분석이 실패하면 부정확한 예시 목표를 만들지 않고 오류를 보여준다', async () => {
  URL.createObjectURL = vi.fn(() => 'blob:failed-image');
  URL.revokeObjectURL = vi.fn();
  global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'failed' }) });
  const user = userEvent.setup();
  const { container } = render(<App />);

  await user.type(screen.getByRole('textbox', { name: '하고 싶은 일' }), '김밥 주문하기');
  await user.click(screen.getByRole('button', { name: '다음 단계' }));
  await user.upload(container.querySelector('input[type="file"]'), new File(['photo'], 'unknown.png', { type: 'image/png' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('사진을 분석하지 못했어요');
  expect(screen.queryByRole('button', { name: /김밥 주문하기/ })).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '이제 화면을 찍어주세요' })).toBeInTheDocument();
});

test('AI 사용량 제한은 사진 전송 실패가 아니라 잠시 후 재시도 안내로 보여준다', async () => {
  URL.createObjectURL = vi.fn(() => 'blob:rate-limited-image');
  URL.revokeObjectURL = vi.fn();
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 429,
    json: async () => ({
      error: 'RATE_LIMITED',
      message: 'AI 사용량이 잠시 많아요. 35초 뒤에 다시 시도해주세요.',
      retryAfter: 35,
    }),
  });
  const user = userEvent.setup();
  const { container } = render(<App />);

  await user.type(screen.getByRole('textbox', { name: '하고 싶은 일' }), '결제하기');
  await user.click(screen.getByRole('button', { name: '다음 단계' }));
  await user.upload(container.querySelector('input[type="file"]'), new File(['photo'], 'kiosk.png', { type: 'image/png' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('AI 사용량이 잠시 많아요. 35초 뒤에 다시 시도해주세요.');
  expect(global.fetch).toHaveBeenCalledWith('/api/analyze', expect.objectContaining({ method: 'POST' }));
});

test('첫 화면에서 하고 싶은 일을 음성으로 말한 뒤 사진 단계로 간다', async () => {
  installSpeechRecognition('결제하기');
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole('button', { name: '말로 입력하기' }));
  expect(screen.getByRole('textbox', { name: '하고 싶은 일' })).toHaveValue('결제하기');

  await user.click(screen.getByRole('button', { name: '다음 단계' }));
  expect(screen.getByRole('heading', { name: '이제 화면을 찍어주세요' })).toBeInTheDocument();
  expect(screen.getByText('결제하기')).toBeInTheDocument();
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

test('사진을 찍기 전에 뒤로 가서 하고 싶은 일을 수정할 수 있다', async () => {
  URL.createObjectURL = vi.fn(() => 'blob:washer');
  URL.revokeObjectURL = vi.fn();
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ goals: [{
      id: 'goal-1', label: '탈수만 하기', hint: '탈수 코스만 실행해요', icon: '🌀',
      steps: [{ text: '탈수 버튼을 눌러주세요.', label: '탈수', box: { x: 55, y: 30, w: 18, h: 16 } }],
    }] }),
  });
  const user = userEvent.setup();
  const { container } = render(<App />);

  await user.type(screen.getByRole('textbox', { name: '하고 싶은 일' }), '표준 세탁하기');
  await user.click(screen.getByRole('button', { name: '다음 단계' }));
  await user.click(screen.getByRole('button', { name: '할 일 다시 적기' }));
  await user.clear(screen.getByRole('textbox', { name: '하고 싶은 일' }));
  await user.type(screen.getByRole('textbox', { name: '하고 싶은 일' }), '탈수만 하기');
  await user.click(screen.getByRole('button', { name: '다음 단계' }));
  await user.upload(container.querySelector('input[type="file"]'), new File(['photo'], 'washer.png', { type: 'image/png' }));

  expect(await screen.findByText('탈수 버튼을 눌러주세요.')).toBeInTheDocument();
  const request = JSON.parse(global.fetch.mock.calls[0][1].body);
  expect(request.requestedGoal).toBe('탈수만 하기');
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

