import axios, { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';

import { useAuthStore } from '../store/authStore';

// Détermine la base API via variable d'env Vite en prod (Vercel) ou fallback local.
const API_BASE = (import.meta as any).env?.VITE_API_URL || (import.meta as any).env?.URL_API_VITE || '';

export const apiClient = axios.create({
  baseURL: API_BASE ? `${API_BASE.replace(/\/$/, '')}/api` : '/api'
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
