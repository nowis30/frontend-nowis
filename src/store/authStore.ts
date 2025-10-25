import { create, type StateCreator } from 'zustand';

export interface AuthState {
  token: string | null;
  setToken(token: string | null): void;
}

const TOKEN_STORAGE_KEY = 'nowis.auth.token';

const readInitialToken = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  return stored && stored.length > 0 ? stored : null;
};

const authStore: StateCreator<AuthState> = (set) => ({
  token: readInitialToken(),
  setToken: (token: string | null) => {
    if (typeof window !== 'undefined') {
      if (token) {
        window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
      } else {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    }
    set({ token });
  }
});

export const useAuthStore = create<AuthState>(authStore);
