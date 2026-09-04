import { ServerStatusResponse, PhoneResult, EmailResult, IpResult, ScrapeResult } from '../types';

const PROXY_STORAGE_KEY = 'abstract_proxy_base_url';

export function getProxyBaseUrl(): string {
  // If user configured a custom proxy URL (e.g. for external testing)
  const saved = localStorage.getItem(PROXY_STORAGE_KEY);
  if (saved && saved.trim()) {
    return saved.trim().replace(/\/+$/, '');
  }
  // Check explicit custom proxy URL env variable
  const envUrl = (import.meta as any).env?.VITE_PROXY_URL;
  if (envUrl && envUrl.trim()) {
    const clean = envUrl.trim().replace(/\/+$/, '');
    return clean.endsWith('/api') ? clean : `${clean}/api`;
  }
  // Relative /api works for both Vite dev server (on localhost) and Nginx reverse proxy (in Docker/production)
  return '/api';
}

export function setProxyBaseUrl(url: string): void {
  if (!url || !url.trim()) {
    localStorage.removeItem(PROXY_STORAGE_KEY);
  } else {
    localStorage.setItem(PROXY_STORAGE_KEY, url.trim().replace(/\/+$/, ''));
  }
}

async function requestJson<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = getProxyBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const primaryUrl = `${baseUrl}${cleanEndpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  let res: Response;
  try {
    res = await fetch(primaryUrl, { ...options, headers });
  } catch (primaryErr) {
    // If relative /api fails with network error, try fallback to VITE_FETCHER_URL if defined
    const fetcherUrl = (import.meta as any).env?.VITE_FETCHER_URL;
    if (fetcherUrl && fetcherUrl.trim() && !primaryUrl.startsWith('http')) {
      const cleanFetcher = fetcherUrl.trim().replace(/\/+$/, '');
      const fallbackBase = cleanFetcher.endsWith('/api') ? cleanFetcher : `${cleanFetcher}/api`;
      const fallbackUrl = `${fallbackBase}${cleanEndpoint}`;
      try {
        res = await fetch(fallbackUrl, { ...options, headers });
      } catch {
        throw primaryErr;
      }
    } else {
      throw primaryErr;
    }
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const errorMsg = data?.error || `Request failed with status ${res.status}`;
    const err = new Error(errorMsg);
    (err as any).status = res.status;
    (err as any).details = data?.details || data;
    throw err;
  }

  return data as T;
}

export const apiClient = {
  getProxyUrl: getProxyBaseUrl,
  setProxyUrl: setProxyBaseUrl,

  async getStatus(): Promise<ServerStatusResponse> {
    return requestJson<ServerStatusResponse>('/status');
  },

  async queryPhone(phone: string): Promise<{ success: boolean; data: PhoneResult; source: string }> {
    return requestJson<{ success: boolean; data: PhoneResult; source: string }>('/phone', {
      method: 'POST',
      body: JSON.stringify({ phone })
    });
  },

  async queryEmail(email: string): Promise<{ success: boolean; data: EmailResult; source: string }> {
    return requestJson<{ success: boolean; data: EmailResult; source: string }>('/email', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  },

  async queryIp(ip_address?: string): Promise<{ success: boolean; data: IpResult; source: string }> {
    return requestJson<{ success: boolean; data: IpResult; source: string }>('/ip', {
      method: 'POST',
      body: JSON.stringify({ ip_address })
    });
  },

  async scrapeUrl(url: string, render_js = false, country_code?: string): Promise<ScrapeResult> {
    return requestJson<ScrapeResult>('/scrape', {
      method: 'POST',
      body: JSON.stringify({ url, render_js, country_code })
    });
  },

  async encryptSecret(text: string, secret?: string): Promise<{ success: boolean; encrypted: string; isEncrypted: boolean }> {
    return requestJson<{ success: boolean; encrypted: string; isEncrypted: boolean }>('/dokploy/encrypt', {
      method: 'POST',
      body: JSON.stringify({ text, secret })
    });
  },

  async getDokployEnvTemplate(secret?: string): Promise<{ secret: string; env_content: string; keys: any }> {
    const query = secret ? `?secret=${encodeURIComponent(secret)}` : '';
    return requestJson<{ secret: string; env_content: string; keys: any }>(`/dokploy/env-template${query}`);
  }
};
