const STORAGE_KEY = 'barobom_anon_id';

/**
 * Returns a persistent anonymous user identifier.
 * Generated once per browser and survives page refreshes.
 *
 * - Uses `crypto.randomUUID()` when available
 * - Falls back to `Math.random()` based UUID v4 for older browsers
 * - Stored in localStorage under `barobom_anon_id`
 */

function generateId() {
  try {
    return crypto.randomUUID();
  } catch {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

export function getAnonymousId() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored.length >= 20) return stored;
  } catch {
    // localStorage unavailable (private browsing with restrictions)
  }

  const id = generateId();

  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // storage full or unavailable — return in-memory ID for this session
  }

  return id;
}

export function resetAnonymousId() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore — caller can still get a fresh ID
  }

  return getAnonymousId();
}
