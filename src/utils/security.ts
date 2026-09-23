/**
 * Security, password hashing, and geo-location permission checks.
 */

// Pre-computed SHA-256 hashes for admin & bypass authentication
const ADMIN_HASH = '97e96000beba9b14057d7c01f06833b0948ed7e776f536207058f00c15402324';
const BYPASS_HASH = 'dbd823ef2cafd01668dd5e20fb15cd29aec7bff94ea7d1d6f3333b28cc7272ef';

async function sha256Hex(text: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return text;
}

export async function verifyEncryptedAdmin(entered: string): Promise<boolean> {
  if (!entered) return false;
  const hash = await sha256Hex(entered.trim());
  return hash.toLowerCase() === ADMIN_HASH;
}

export async function verifyEncryptedBypass(entered: string): Promise<boolean> {
  if (!entered) return false;
  const hash = await sha256Hex(entered.trim());
  return hash.toLowerCase() === BYPASS_HASH;
}

export function isBypassAllowedForAction(actionName: string): boolean {
  if (!actionName) return false;
  const act = actionName.toLowerCase();
  if (
    act.includes('edit') ||
    act.includes('change line status') ||
    act.includes('status') ||
    act.includes('toggle status')
  ) {
    return true;
  }
  return false;
}

export async function checkClientGeoPermission(): Promise<{ allowed: boolean; country: string }> {
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      const code = (data.country_code || '').toUpperCase();
      const blocked = ['RU', 'CN', 'KP', 'IR'];
      return {
        allowed: !blocked.includes(code),
        country: code || 'US',
      };
    }
  } catch {}
  return { allowed: true, country: 'US' };
}
