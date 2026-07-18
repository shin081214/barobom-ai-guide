import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => cleanup());

Object.defineProperty(window, 'speechSynthesis', {
  value: { speak: () => {}, cancel: () => {} },
  writable: true,
});

global.SpeechSynthesisUtterance = class {
  constructor(text) { this.text = text; }
};

// jsdom v27 + vitest 4 occasionally hands back a `localStorage` object with
// no Storage methods (clear/getItem/setItem are undefined) on an opaque
// origin. anonId.test.js depends on those APIs, so when methods are missing
// we replace it with an in-memory Storage. Production code is unchanged.
function installLocalStoragePolyfill() {
  const store = new Map();
  const memoryStorage = {
    get length() { return store.size; },
    clear() { store.clear(); },
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    key(index) { return Array.from(store.keys())[index] ?? null; },
    removeItem(key) { store.delete(key); },
    setItem(key, value) { store.set(key, String(value)); },
  };
  for (const target of [globalThis, window]) {
    try {
      Object.defineProperty(target, 'localStorage', {
        value: memoryStorage, writable: true, configurable: true,
      });
    } catch {
      // best-effort: in rare sandboxed environments the property is non-configurable
    }
  }
}

function isUsableStorage(value) {
  return value
    && typeof value === 'object'
    && typeof value.clear === 'function'
    && typeof value.getItem === 'function'
    && typeof value.setItem === 'function';
}

if (!isUsableStorage(globalThis.localStorage) || !isUsableStorage(window.localStorage)) {
  installLocalStoragePolyfill();
}
