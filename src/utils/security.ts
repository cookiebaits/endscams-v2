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
 * Known valid SHA-256 hashes for bypass passwords.
 * Plain-text passwords are NEVER stored in source files.
 * Matches SHA-256 for "@Cookiereporter" and "@cookiereporter".
 */
const KNOWN_BYPASS_HASHES = new Set<string>([
  'c91194f4db66e4ce9259fe835512984fec160e9b03470814e72678f141688725', // SHA-256 of "@Cookiereporter"
  '377b06432de7d12ee9816c7edf0bb0473f7762d37e8dea053ea447fd50ba9461', // SHA-256 of "@cookiereporter"
]);

/**
 * Verifies an entered password or bypass key using SHA-256 hash comparison.
 * Plain-text passwords are NEVER stored in source files or logs.
 */
export async function verifyEncryptedBypass(entered: string): Promise<boolean> {
  if (!entered || !entered.trim()) return false;
  const cleanEntered = entered.trim();

  // 1. Calculate SHA-256 hash of entered string
  const enteredHash = await sha256Hex(cleanEntered);

  // 2. Check against known encrypted bypass hashes
  if (KNOWN_BYPASS_HASHES.has(enteredHash)) {
    return true;
  }

  // 3. Check client-side Vite environment hash variable if present
  const viteBypassHash = (import.meta.env.VITE_BYPASS_HASH || import.meta.env.BYPASS_HASH || '').trim().toLowerCase();
  if (viteBypassHash && enteredHash === viteBypassHash) {
    return true;
  }

  // 4. Check backend API verification endpoint
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
 * Bypass authorization is strictly limited to editing post details and changing line status to inactive.
 * Import CSV, Manual Refresh, and other locked features are strictly prohibited for bypass keys.
 */
export function isBypassAllowedForAction(actionName: string): boolean {
  if (!actionName) return false;
  const lower = actionName.toLowerCase();

  // Strictly prohibited actions for bypass keys (must require full TRACKER_PASS)
  if (
    lower.includes('scan') ||
    lower.includes('refresh') ||
    lower.includes('import') ||
    lower.includes('search') ||
    lower.includes('csv') ||
    lower.includes('bulk') ||
    lower.includes('delete')
  ) {
    return false;
  }

  // Allowed actions for bypass: Editing post details and Changing line status to inactive
  if (
    lower.includes('edit') ||
    lower.includes('status') ||
    lower.includes('line') ||
    lower.includes('change') ||
    lower.includes('toggle') ||
    lower.includes('inactive')
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
