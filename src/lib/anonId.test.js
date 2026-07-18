import { afterEach, expect, test, vi } from 'vitest';
import { getAnonymousId, resetAnonymousId } from './anonId.js';

afterEach(() => {
  localStorage.clear();
});

test('getAnonymousId는 호출 시 항상 동일한 ID를 반환한다', () => {
  const first = getAnonymousId();
  const second = getAnonymousId();
  expect(first).toBe(second);
});

test('getAnonymousId는 UUID 형식의 문자열을 반환한다', () => {
  const id = getAnonymousId();
  expect(typeof id).toBe('string');
  expect(id.length).toBeGreaterThanOrEqual(20);
  expect(id).toMatch(/^[a-f0-9-]+$/);
});

test('getAnonymousId는 localStorage에 저장된 ID를 재사용한다', () => {
  localStorage.setItem('barobom_anon_id', 'fixed-test-id-000000000000');
  expect(getAnonymousId()).toBe('fixed-test-id-000000000000');
});

test('resetAnonymousId는 새 ID를 발급한다', () => {
  const original = getAnonymousId();
  const fresh = resetAnonymousId();
  expect(fresh).not.toBe(original);
  expect(localStorage.getItem('barobom_anon_id')).toBe(fresh);
});

test('20자 미만의 저장된 ID는 무시하고 새로 발급한다', () => {
  localStorage.setItem('barobom_anon_id', 'short');
  const id = getAnonymousId();
  expect(id).not.toBe('short');
  expect(id.length).toBeGreaterThanOrEqual(20);
});

test('localStorage가 손상되어도 getAnonymousId는 fallback ID를 반환한다', () => {
  const originalGetItem = Storage.prototype.getItem;
  Storage.prototype.getItem = vi.fn(() => { throw new Error('quota exceeded'); });
  try {
    const id = getAnonymousId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThanOrEqual(20);
  } finally {
    Storage.prototype.getItem = originalGetItem;
  }
});
