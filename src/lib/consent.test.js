import { afterEach, expect, test, vi } from 'vitest';
import { getConsent, setConsent } from './consent.js';

afterEach(() => {
  localStorage.clear();
});

test('getConsent는 기본적으로 false를 반환한다', () => {
  expect(getConsent()).toBe(false);
});

test('setConsent는 true를 설정하면 getConsent가 true를 반환한다', () => {
  setConsent(true);
  expect(getConsent()).toBe(true);
});

test('setConsent는 false를 설정하면 getConsent가 false를 반환한다', () => {
  setConsent(true);
  expect(getConsent()).toBe(true);
  setConsent(false);
  expect(getConsent()).toBe(false);
});

test('getConsent는 localStorage에 저장된 값을 읽어온다', () => {
  localStorage.setItem('barobom_user_consent', 'true');
  expect(getConsent()).toBe(true);
});

test('localStorage가 비정상적일 때도 getConsent는 안전하게 false를 반환한다', () => {
  const originalGetItem = Storage.prototype.getItem;
  Storage.prototype.getItem = vi.fn(() => { throw new Error('localStorage unavailable'); });
  try {
    expect(getConsent()).toBe(false);
  } finally {
    Storage.prototype.getItem = originalGetItem;
  }
});
