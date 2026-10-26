import { afterEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { resolveApiBaseUrl } from '../baseUrl';
import { apiClient } from '../client';
import { useAuthStore } from '../../store/authStore';

const encode = (value: string) => btoa(value).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const token = (seconds: number, id = 1) => `${encode('{}')}.${encode(JSON.stringify({ userId: id, exp: Math.floor(Date.now() / 1000) + seconds }))}.signature`;
afterEach(() => { useAuthStore.getState().setToken(null); vi.restoreAllMocks(); });

describe('deployment isolation', () => {
  it('uses the explicit staging backend on Vercel previews', () => {
    expect(resolveApiBaseUrl('https://staging.example.test/', 'branch.vercel.app')).toBe('https://staging.example.test/api');
    expect(resolveApiBaseUrl('https://staging.example.test/api', 'branch.vercel.app')).toBe('https://staging.example.test/api');
  });
  it('requires explicit configuration away from localhost', () => {
    expect(() => resolveApiBaseUrl(undefined, 'branch.vercel.app')).toThrow('VITE_API_URL');
    expect(() => resolveApiBaseUrl(undefined, 'nowis.example.test')).toThrow('VITE_API_URL');
    expect(resolveApiBaseUrl(undefined, 'localhost')).toBe('/api');
  });
  it('rejects credentials and insecure remote API URLs', () => {
    expect(() => resolveApiBaseUrl('https://user:secret@example.test', 'localhost')).toThrow();
    expect(() => resolveApiBaseUrl('http://example.test', 'localhost')).toThrow();
  });
});

describe('expired sessions', () => {
  it('refuses an expired token and clears its persisted copy', () => {
    useAuthStore.getState().setToken(token(-20));
    expect(useAuthStore.getState().token).toBeNull();
    expect(localStorage.getItem('nowis.auth.token')).toBeNull();
  });
  it('invalidates the session that receives a 401', async () => {
    useAuthStore.getState().setToken(token(600));
    expect(useAuthStore.getState().token).not.toBeNull();
    await expect(apiClient.get('/profile', { adapter: async config => {
      throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, { status: 401, statusText: 'Unauthorized', data: {}, headers: new AxiosHeaders(), config });
    } })).rejects.toBeInstanceOf(AxiosError);
    expect(useAuthStore.getState().token).toBeNull();
  });
  it('does not clear a newer login when an old request returns 401', async () => {
    const oldToken = token(600, 1), newToken = token(600, 2);
    useAuthStore.getState().setToken(oldToken);
    await expect(apiClient.get('/profile', { adapter: async config => {
      useAuthStore.getState().setToken(newToken);
      throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, { status: 401, statusText: 'Unauthorized', data: {}, headers: new AxiosHeaders(), config });
    } })).rejects.toBeInstanceOf(AxiosError);
    expect(useAuthStore.getState().token).toBe(newToken);
  });
});
