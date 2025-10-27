/* eslint-disable @typescript-eslint/no-explicit-any */
import axios, { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';

import { useAuthStore } from '../store/authStore';
import { getAdvisorPortalKey } from '../utils/advisorPortalKey';

// Détermine la base API : priorité à l'env, sinon Render en prod, sinon proxy local.
const envBaseUrl =
  (import.meta as any).env?.VITE_API_URL || (import.meta as any).env?.URL_API_VITE || '';

// On Vercel on s'appuie sur le rewrite /api -> backend Render, sinon on retombe sur Render.
const resolvedBaseUrl = (() => {
  if (envBaseUrl) {
    return envBaseUrl.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined') {
    const { hostname } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.vercel.app')) {
      return '';
    }
  }

  return 'https://backend-nowis-1.onrender.com';
})();

export const apiClient = axios.create({
  baseURL: resolvedBaseUrl ? `${resolvedBaseUrl}/api` : '/api'
});

function isAdvisorPortalRoute(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.location.pathname.startsWith('/advisor-portal');
}

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const headers = AxiosHeaders.from(config.headers ?? {});
  const token = useAuthStore.getState().token;

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  } else if (isAdvisorPortalRoute()) {
    const portalKey = getAdvisorPortalKey();
    if (portalKey) {
      headers.set('X-Advisor-Portal-Key', portalKey);
    }
  }

  config.headers = headers;
  return config;
});
