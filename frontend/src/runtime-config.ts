declare global {
  interface Window {
    __ONLYCATS_CONFIG__?: { apiUrl?: string };
  }
}

export const apiBaseUrl = (
  window.__ONLYCATS_CONFIG__?.apiUrl ||
  import.meta.env.VITE_API_URL ||
  '/api'
).replace(/\/+$/, '');

export function apiImageUrl(url: string | null): string | null {
  if (!url || !url.startsWith('/api/')) return url;
  return `${apiBaseUrl}${url.slice('/api'.length)}`;
}
