const BLOCKED_COUNTRIES = ['RU', 'CN', 'KP', 'IR'];

// Allowed country codes for /tracker page: United States, UK, Ireland, EU, Canada, Australia
export const ALLOWED_TRACKER_COUNTRIES = new Set([
  // United States & Canada
  'US', 'CA',
  // UK & Ireland
  'GB', 'UK', 'IE',
  // Australia
  'AU',
  // European Union & EU Member States
  'EU', 'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'EL', 'HU', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
]);

export async function isUserCountryAllowed(): Promise<boolean> {
  try {
    const resp = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) });
    if (!resp.ok) return true;
    const data = await resp.json();
    const code = (data.country_code || '').toUpperCase();
    return !BLOCKED_COUNTRIES.includes(code);
  } catch {
    return true;
  }
}

export async function isTrackerCountryAllowed(): Promise<boolean> {
  try {
    const resp = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) });
    if (resp.ok) {
      const data = await resp.json();
      const code = (data.country_code || '').toUpperCase();
      if (code) return ALLOWED_TRACKER_COUNTRIES.has(code);
    }
  } catch {
    // Primary API failed, try fallback
  }

  try {
    const fallbackResp = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(4000) });
    if (fallbackResp.ok) {
      const fallbackData = await fallbackResp.json();
      const code = (fallbackData.country_code || '').toUpperCase();
      if (code) return ALLOWED_TRACKER_COUNTRIES.has(code);
    }
  } catch {
    // Fallback API failed
  }

  // If network lookup completely fails (e.g., offline or adblocker), default to true to avoid locking out valid users
  return true;
}
