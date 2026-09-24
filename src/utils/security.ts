async function sha256(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const cryptoObj = typeof window !== 'undefined' ? window.crypto : (globalThis as any).crypto;
  const hashBuffer = await cryptoObj.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

const ADMIN_HASH = '97e96000beba9b14057d7c01f06833b0948ed7e776f536207058f00c15402324';
const BYPASS_HASH = 'dbd823ef2cafd01668dd5e20fb15cd29aec7bff94ea7d1d6f3333b28cc7272ef';

export async function verifyEncryptedAdmin(input: string): Promise<boolean> {
  if (!input) return false;
  try {
    const hash = await sha256(input);
    return hash === ADMIN_HASH;
  } catch {
    return false;
  }
}

export async function verifyEncryptedBypass(input: string): Promise<boolean> {
  if (!input) return false;
  try {
    const hash = await sha256(input);
    return hash === BYPASS_HASH;
  } catch {
    return false;
  }
}

export function isBypassAllowedForAction(actionName: string): boolean {
  if (!actionName) return false;
  const name = actionName.toLowerCase();
  if (name.includes('edit') || name.includes('status') || name.includes('toggle') || name.includes('change line status') || name.includes('edit monitored number') || name.includes('edit threat post')) {
    return true;
  }
  return false;
}

export async function checkClientGeoPermission(): Promise<{ allowed: boolean; country: string }> {
  try {
    const resp = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) });
    if (!resp.ok) return { allowed: true, country: 'US' };
    const data = await resp.json();
    const code = (data.country_code || 'US').toUpperCase();
    const blocked = ['RU', 'CN', 'KP', 'IR'];
    return { allowed: !blocked.includes(code), country: code };
  } catch {
    return { allowed: true, country: 'US' };
  }
}
