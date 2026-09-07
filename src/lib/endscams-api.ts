// endscams-api.ts
const DOKPLOY_PROXY_URL = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? ''
  : 'https://endscams.org';

async function safeFetch(endpoint: string, options: RequestInit) {
  try {
    const res = await fetch(`${DOKPLOY_PROXY_URL}${endpoint}`, options);
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // If DOKPLOY_PROXY_URL fails (e.g. local dev or network block), try relative path
  }

  // Fallback to relative path or local fetcher proxy if DOKPLOY_PROXY_URL fails
  const rawFetcherUrl = import.meta.env.DEV
    ? ''
    : (import.meta.env.VITE_FETCHER_URL || 'https://fetcher.endscams.org').replace(/\/+$/, '');

  const fallbackRes = await fetch(`${rawFetcherUrl}${endpoint}`, options);
  return fallbackRes.json();
}

// 1. Phone Intelligence
export async function verifyPhone(phone: string) {
  return safeFetch('/api/phone', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, query: phone })
  });
}

// 2. Email Reputation
export async function verifyEmail(email: string) {
  return safeFetch('/api/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, query: email })
  });
}

// 3. IP Intelligence
export async function verifyIp(ipAddress?: string) {
  return safeFetch('/api/ip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ip_address: ipAddress || '', query: ipAddress || '' })
  });
}

// 4. Web Scraper
export async function scrapeUrl(url: string, renderJs = false) {
  return safeFetch('/api/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, render_js: renderJs, query: url })
  });
}
