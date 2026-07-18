import { getAnonymousId } from './anonId.js';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://dev.amanhasfallenintotheriver.space';

let currentSessionId = null;

/**
 * Publish a user event to the Barobom backend telemetry endpoint.
 * Fire-and-forget — never throws, logs errors to console.
 *
 * @param {string} eventType - One of the VALID_EVENT_TYPES
 * @param {object} [payload] - Optional event metadata
 * @returns {Promise<string|null>} session ID or null on failure
 */
export async function publishEvent(eventType, payload = null) {
  const anonymousId = getAnonymousId();
  try {
    const body = { anonymous_id: anonymousId, event_type: eventType };
    if (currentSessionId) body.session_id = currentSessionId;
    if (payload) body.payload = payload;

    const response = await fetch(`${BACKEND_URL}/v1/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.warn(`[telemetry] ${eventType} rejected (${response.status}): ${detail}`);
      return currentSessionId;
    }

    const data = await response.json();
    if (data.session_id) currentSessionId = data.session_id;
    return currentSessionId;
  } catch (err) {
    console.warn(`[telemetry] ${eventType} failed:`, err.message);
    return currentSessionId;
  }
}

/**
 * Reset the current session ID (called on "처음부터" reset).
 */
export function resetSession() {
  currentSessionId = null;
}

/**
 * Identify a device from a base64 image using the backend /v1/identify endpoint.
 *
 * @param {string} imageBase64 - Base64-encoded image (no data: prefix)
 * @param {string} [mimeType='image/jpeg']
 * @returns {Promise<{device: object|null, skills: array, raw_analysis: string}|null>}
 */
export async function identifyDevice(imageBase64, mimeType = 'image/jpeg') {
  try {
    const response = await fetch(`${BACKEND_URL}/v1/identify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageBase64, mime_type: mimeType }),
    });

    if (!response.ok) {
      console.warn(`[identify] request failed (${response.status})`);
      return null;
    }

    return await response.json();
  } catch (err) {
    console.warn('[identify] failed:', err.message);
    return null;
  }
}

/**
 * Report a user observation about a wrong/missing step.
 */
export async function reportObservation({ deviceId, sessionId, observationType, description, stepIndex }) {
  try {
    const response = await fetch(`${BACKEND_URL}/v1/observations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: deviceId,
        session_id: sessionId || currentSessionId || 'unknown',
        observation_type: observationType,
        description: description || '',
        step_index: stepIndex,
      }),
    });
    if (!response.ok) {
      console.warn(`[observation] request failed (${response.status})`);
      return null;
    }
    return await response.json();
  } catch (err) {
    console.warn('[observation] failed:', err.message);
    return null;
  }
}
