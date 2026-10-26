import { create, type StateCreator } from 'zustand';

export interface AuthState {
  token: string | null;
  setToken(token: string | null): void;
}

const TOKEN_STORAGE_KEY = 'nowis.auth.token';

// Local shape/expiry filter only; the backend still verifies the signature and rights.
const JWT_SEGMENT = /^[A-Za-z0-9_-]+$/;
export function isUsableToken(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  // Éviter des valeurs non valides mais "truthy" dans le localStorage
  const lowered = token.trim().toLowerCase();
  if (lowered === 'null' || lowered === 'undefined' || lowered === 'false') return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  if (!parts.every((p) => p.length > 0 && JWT_SEGMENT.test(p))) return false;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' && Number.isFinite(payload.exp) && payload.exp * 1000 > Date.now();
  } catch { return false; }
}

const readInitialToken = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored && isUsableToken(stored)) return stored;
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch { /* Storage may be unavailable in private browsing. */ }
  return null;
};

const authStore: StateCreator<AuthState> = (set) => ({
  token: readInitialToken(),
  setToken: (token: string | null) => {
    if (typeof window !== 'undefined') {
      try {
      if (token && isUsableToken(token)) {
        window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
      } else {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
      } catch { /* Keep this session in memory if storage is unavailable. */ }
    }
    set({ token: token && isUsableToken(token) ? token : null });
  }
});

export const useAuthStore = create<AuthState>(authStore);
