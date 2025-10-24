import { create, type StateCreator } from 'zustand';

export interface AuthState {
  token: string | null;
  setToken(token: string | null): void;
}

const authStore: StateCreator<AuthState> = (set) => ({
  token: null,
  setToken: (token: string | null) => set({ token })
});

export const useAuthStore = create<AuthState>(authStore);
