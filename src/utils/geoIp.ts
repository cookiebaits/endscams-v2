const BLOCKED_COUNTRIES = ['RU', 'CN', 'KP', 'IR'];

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
