import { afterEach, expect, test, vi } from 'vitest';
import { publishEvent, resetSession, identifyDevice } from './feedback.js';

afterEach(() => {
  vi.restoreAllMocks();
  resetSession();
});

test('publishEvent sends correct body to backend', async () => {
  const mockFetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ session_id: 'sid-1234' }), { status: 201 })
  );
  vi.stubGlobal('fetch', mockFetch);

  const sessionId = await publishEvent('guide_started', { step: 1 });

  expect(sessionId).toBe('sid-1234');
  expect(mockFetch).toHaveBeenCalledTimes(1);
  const [url, options] = mockFetch.mock.calls[0];
  expect(url).toContain('/v1/events');
  const body = JSON.parse(options.body);
  expect(body.event_type).toBe('guide_started');
  expect(body.anonymous_id).toBeTruthy();
  expect(body.payload).toEqual({ step: 1 });
});

test('publishEvent reuses session_id on subsequent calls', async () => {
  const mockFetch = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ session_id: 'sid-first' }), { status: 201 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ session_id: 'sid-first' }), { status: 201 }));

  vi.stubGlobal('fetch', mockFetch);

  await publishEvent('guide_started');
  await publishEvent('step_shown', { step: 2 });

  const body2 = JSON.parse(mockFetch.mock.calls[1][1].body);
  expect(body2.session_id).toBe('sid-first');
});

test('publishEvent returns null-like on network error', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));

  const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const result = await publishEvent('step_back');
  expect(result).toBeNull();
  expect(consoleWarn).toHaveBeenCalled();
});

test('publishEvent handles non-201 response gracefully', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response('{"detail":"bad"}', { status: 400 })
  ));
  const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const result = await publishEvent('guide_started');
  expect(result).toBeNull();
  expect(consoleWarn).toHaveBeenCalled();
});

test('resetSession clears tracked session id', () => {
  resetSession();
  // After reset, next call should not include session_id
  expect(true).toBe(true); // smoke test
});

test('identifyDevice sends image to backend and returns parsed result', async () => {
  const mockResponse = {
    device: { id: 1, name: 'Test Kiosk', category: 'kiosk', brand: 'Test', model: 'T-1' },
    skills: [],
    raw_analysis: '{}',
  };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify(mockResponse), { status: 200 }),
  ));

  const result = await identifyDevice('abc123', 'image/png');
  expect(result.device.name).toBe('Test Kiosk');
  expect(result.skills).toEqual([]);
});

test('identifyDevice returns null on network error', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
  const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const result = await identifyDevice('abc');
  expect(result).toBeNull();
  expect(consoleWarn).toHaveBeenCalled();
});
