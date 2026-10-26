/* eslint-disable @typescript-eslint/no-explicit-any */
import axios, { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';

import { useAuthStore, isUsableToken } from '../store/authStore';
import { resolveApiBaseUrl } from './baseUrl';
import { getAdvisorPortalKey } from '../utils/advisorPortalKey';

const configuredBase = import.meta.env.VITE_API_URL || import.meta.env.URL_API_VITE;
export const apiClient = axios.create({
  baseURL: resolveApiBaseUrl(configuredBase, typeof window === 'undefined' ? 'localhost' : window.location.hostname)
});

function isAdvisorPortalRoute(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.location.pathname.startsWith('/advisor-portal');
}

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const headers = AxiosHeaders.from(config.headers ?? {});
  let token = useAuthStore.getState().token;
  if (token && !isUsableToken(token)) {
    useAuthStore.getState().setToken(null);
    token = null;
  }

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

apiClient.interceptors.response.use(response => response, error => {
  const currentToken = useAuthStore.getState().token;
  const sentAuthorization = AxiosHeaders.from(error.config?.headers ?? {}).get('Authorization');
  if (error.response?.status === 401 && currentToken && sentAuthorization === `Bearer ${currentToken}`) {
    useAuthStore.getState().setToken(null);
  }
  return Promise.reject(error);
});
