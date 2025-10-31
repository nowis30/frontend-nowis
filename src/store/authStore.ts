import { create, type StateCreator } from 'zustand';

export interface AuthState {
  token: string | null;
  setToken(token: string | null): void;
}

const TOKEN_STORAGE_KEY = 'nowis.auth.token';

// Très simple validation de forme d'un JWT (3 segments séparés par des points, chars base64url)
const JWT_SEGMENT = /^[A-Za-z0-9_-]+$/;
function isLikelyJwt(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  // Éviter des valeurs non valides mais "truthy" dans le localStorage
  const lowered = token.trim().toLowerCase();
  if (lowered === 'null' || lowered === 'undefined' || lowered === 'false') return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  return parts.every((p) => p.length > 0 && JWT_SEGMENT.test(p));
}

const readInitialToken = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!stored) return null;
  // N'accepte que les jetons ressemblant à un JWT
  return isLikelyJwt(stored) ? stored : null;
};

const authStore: StateCreator<AuthState> = (set) => ({
  token: readInitialToken(),
  setToken: (token: string | null) => {
    if (typeof window !== 'undefined') {
      if (token && isLikelyJwt(token)) {
        window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
      } else {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    }
    set({ token: token && isLikelyJwt(token) ? token : null });
  }
});

export const useAuthStore = create<AuthState>(authStore);
