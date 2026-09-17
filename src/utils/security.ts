import { isUserCountryAllowed, detectClientCountry } from './geoIp';

/**
 * Calculates SHA-256 hex hash of a string using Web Crypto API.
 */
async function sha256Hex(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verifies an entered password or bypass key against configured bypass values
 * (e.g. VITE_BYPASS_PASS, VITE_BYPASS_HASH, or backend verify endpoint).
 */
export async function verifyEncryptedBypass(entered: string): Promise<boolean> {
  if (!entered || !entered.trim()) return false;
  const cleanEntered = entered.trim();

  // 1. Check client-side Vite environment variables if present
  const viteBypassPass = (import.meta.env.VITE_BYPASS_PASS || import.meta.env.VITE_BYPASS || '').trim();
  const viteBypassHash = (import.meta.env.VITE_BYPASS_HASH || '').trim().toLowerCase();

  if (viteBypassPass && cleanEntered === viteBypassPass) {
    return true;
  }

  if (viteBypassHash) {
    const enteredHash = await sha256Hex(cleanEntered);
    if (enteredHash === viteBypassHash) {
      return true;
    }
  }

  // 2. Check backend API verification endpoint
  try {
    const res = await fetch('/api/verify-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: cleanEntered, isBypassCheck: true }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.verified || data.success || data.isBypass) {
        return true;
      }
    }
  } catch {
    // API offline or unreachable
  }

  return false;
}

/**
 * Checks if a specific administrative action is permitted under bypass authorization.
 * Bypass authorization is strictly limited to editing post details and changing line status.
 */
export function isBypassAllowedForAction(actionName: string): boolean {
  if (!actionName) return false;
  const lower = actionName.toLowerCase();

  // Explicitly prohibited actions for bypass (must require full TRACKER_PASS)
  if (
    lower.includes('scan') ||
    lower.includes('refresh') ||
    lower.includes('import') ||
    lower.includes('search')
  ) {
    return false;
  }

  // Allowed actions for bypass: Editing post details and Changing line status
  if (
    lower.includes('edit') ||
    lower.includes('status') ||
    lower.includes('line') ||
    lower.includes('change')
  ) {
    return true;
  }

  return false;
}

/**
 * Checks client Geo-IP permissions (restricts actions to allowed regions: US, CA, AU, EU).
 */
export async function checkClientGeoPermission(): Promise<{ allowed: boolean; country: string }> {
  try {
    const country = await detectClientCountry();
    const allowed = await isUserCountryAllowed();
    return { allowed, country };
  } catch {
    return { allowed: true, country: 'US' };
  }
}
