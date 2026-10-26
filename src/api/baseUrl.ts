/** Every remote deployment chooses its own backend; no implicit production fallback. */
export function resolveApiBaseUrl(configured: string | undefined, hostname: string): string {
  const value = configured?.trim();
  if (!value) {
    if (hostname === 'localhost' || hostname === '127.0.0.1') return '/api';
    throw new Error('VITE_API_URL est requis pour cet environnement.');
  }
  const url = new URL(value);
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash) {
    throw new Error('VITE_API_URL doit être une URL HTTPS sans identifiants ni paramètres.');
  }
  const base = url.href.replace(/\/+$/, '');
  return base.endsWith('/api') ? base : `${base}/api`;
}
