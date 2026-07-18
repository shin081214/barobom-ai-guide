/**
 * Skills API client — fetches skill & observation data from the backend.
 */
const BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://dev.amanhasfallenintotheriver.space';

export async function fetchSkills(deviceId = null) {
  try {
    const params = deviceId ? `?device_id=${deviceId}` : '';
    const res = await fetch(`${BACKEND_URL}/v1/skills${params}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function fetchObservations(deviceId = null) {
  try {
    const params = deviceId ? `?device_id=${deviceId}` : '';
    const res = await fetch(`${BACKEND_URL}/v1/observations/pending${params}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function fetchSkillContent(skillId) {
  try {
    const res = await fetch(`${BACKEND_URL}/v1/skills/${skillId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
