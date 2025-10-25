const STORAGE_KEY = 'advisor-portal-key';

export function getAdvisorPortalKey(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return sessionStorage.getItem(STORAGE_KEY);
}

export function setAdvisorPortalKey(value: string | null): void {
  if (typeof window === 'undefined') {
    return;
  }
  if (!value) {
    sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(STORAGE_KEY, value);
}
