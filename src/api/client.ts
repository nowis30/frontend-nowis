import axios, { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';

import { useAuthStore } from '../store/authStore';

// Détermine la base API : priorité à l'env, sinon Render en prod, sinon proxy local.
const envBaseUrl =
  (import.meta as any).env?.VITE_API_URL || (import.meta as any).env?.URL_API_VITE || '';

const isDev = Boolean((import.meta as any).env?.DEV);
const fallbackBaseUrl = isDev ? '' : 'https://backend-nowis-1.onrender.com';
const resolvedBaseUrl = (envBaseUrl || fallbackBaseUrl).replace(/\/$/, '');

export const apiClient = axios.create({
  baseURL: resolvedBaseUrl ? `${resolvedBaseUrl}/api` : '/api'
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().token;
  if (token) {
    const headers = AxiosHeaders.from(config.headers ?? {});
    headers.set('Authorization', `Bearer ${token}`);
    config.headers = headers;
  }
  return config;
});
