import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { startLiveSession } from './liveVoice.js';

class FakeWebSocket {
  static OPEN = 1;
  static instances = [];

  constructor() {
    this.readyState = FakeWebSocket.OPEN;
    this.sent = [];
    FakeWebSocket.instances.push(this);
  }

  send(message) {
    this.sent.push(JSON.parse(message));
  }

  close() {
    this.readyState = 3;
    this.onclose?.();
  }
}

class FakeAudioContext {
  constructor() {
    this.state = 'running';
    this.audioWorklet = { addModule: vi.fn().mockResolvedValue(undefined) };
    this.destination = {};
  }

  resume() { return Promise.resolve(); }
  close() { this.state = 'closed'; return Promise.resolve(); }
  createGain() { return { gain: { value: 1 }, connect: vi.fn() }; }
  createMediaStreamSource() { return { connect: vi.fn() }; }
}

class FakeAudioWorkletNode {
  constructor() {
    this.port = { onmessage: null, postMessage: vi.fn() };
  }

  connect() {}
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeWebSocket);
  vi.stubGlobal('AudioContext', FakeAudioContext);
  vi.stubGlobal('AudioWorkletNode', FakeAudioWorkletNode);
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:test'),
    revokeObjectURL: vi.fn(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('클릭 직후 마이크 권한을 요청하고 setupComplete 뒤 이미지를 먼저 전송한다', async () => {
  const getUserMedia = vi.fn().mockResolvedValue({
    getTracks: () => [{ stop: vi.fn() }],
  });
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia },
  });

  const session = startLiveSession('test-key');
  const speakPromise = session.speak('base64-image');

  // Permission must be requested from the original button-click call stack,
  // without waiting for the remote WebSocket setup handshake.
  await waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce(), { timeout: 200 });

  await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
  const socket = FakeWebSocket.instances[0];
  socket.onopen();
  expect(socket.sent.some((message) => message.clientContent)).toBe(false);

  await socket.onmessage({ data: JSON.stringify({ setupComplete: {} }) });
  await speakPromise;

  const imageIndex = socket.sent.findIndex((message) => message.clientContent);
  expect(imageIndex).toBeGreaterThan(0);
  expect(socket.sent.slice(0, imageIndex).some((message) => message.realtimeInput?.audio)).toBe(false);
  session.stop();
});

test('카메라가 없으면 정적 이미지를 video 프레임으로 1FPS 전송하고 마이크를 시작한다', async () => {
  const onError = vi.fn();
  const audioTrack = { stop: vi.fn() };
  const getUserMedia = vi.fn().mockImplementation((constraints) => {
    if (constraints.video && constraints.audio === false) {
      return Promise.reject(new DOMException('NotAllowedError', 'NotAllowedError'));
    }
    return Promise.resolve({ getTracks: () => [audioTrack] });
  });
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia },
  });

  const session = startLiveSession('test-key', { onError });
  const speakPromise = session.speakWithVision('static-b64', 'image/png');

  await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2), { timeout: 200 });
  expect(getUserMedia.mock.calls.some(([constraints]) => constraints.audio && !constraints.video)).toBe(true);
  expect(getUserMedia.mock.calls.some(([constraints]) => constraints.video && constraints.audio === false)).toBe(true);

  await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
  const socket = FakeWebSocket.instances[0];
  socket.onopen();
  await socket.onmessage({ data: JSON.stringify({ setupComplete: {} }) });
  await speakPromise;

  // Should NOT use clientContent (old single-image mode).
  expect(socket.sent.some((message) => message.clientContent)).toBe(false);

  // Should send the static image as a video frame.
  const videoMessage = socket.sent.find((message) => message.realtimeInput?.video);
  expect(videoMessage?.realtimeInput.video).toEqual({
    data: 'static-b64',
    mimeType: 'image/png',
  });

  // No errors — mic init completed (no PermissionDenied for audio)
  expect(onError).not.toHaveBeenCalled();

  session.stop();
  expect(audioTrack.stop).toHaveBeenCalled();
});
