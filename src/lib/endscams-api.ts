// endscams-api.ts
const DOKPLOY_PROXY_URL = import.meta.env.VITE_DOKPLOY_PROXY_URL || import.meta.env.VITE_FETCHER_URL || '';

// 1. Phone Intelligence
export async function verifyPhone(phone: string) {
  const res = await fetch(`${DOKPLOY_PROXY_URL}/api/phone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone })
  });
  return res.json();
}

// 2. Email Reputation
export async function verifyEmail(email: string) {
  const res = await fetch(`${DOKPLOY_PROXY_URL}/api/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  return res.json();
}

// 3. IP Intelligence
export async function verifyIp(ipAddress?: string) {
  const res = await fetch(`${DOKPLOY_PROXY_URL}/api/ip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ip_address: ipAddress || '' })
  });
  return res.json();
}

// 4. Web Scraper
export async function scrapeUrl(url: string, renderJs = false) {
  const res = await fetch(`${DOKPLOY_PROXY_URL}/api/scrape`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, render_js: renderJs })
  });
  return res.json();
}
