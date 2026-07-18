export function getConsent() {
  try {
    const val = localStorage.getItem('barobom_user_consent');
    return val === 'true';
  } catch (e) {
    return false;
  }
}

export function setConsent(value) {
  try {
    localStorage.setItem('barobom_user_consent', String(value));
  } catch (e) {
    // Ignore Storage errors (e.g., private browsing)
  }
}
