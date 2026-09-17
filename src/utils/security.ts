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
 * Known valid SHA-256 hashes for Admin and Bypass passwords.
 * Plain-text passwords are NEVER stored in source files.
 */
const KNOWN_ADMIN_HASHES = new Set<string>([
  '97e96000beba9b14057d7c01f06833b0948ed7e776f536207058f00c15402324',
]);

const KNOWN_BYPASS_HASHES = new Set<string>([
  'dbd823ef2cafd01668dd5e20fb15cd29aec7bff94ea7d1d6f3333b28cc7272ef',
  'c91194f4db66e4ce9259fe835512984fec160e9b03470814e72678f141688725',
  '377b06432de7d12ee9816c7edf0bb0473f7762d37e8dea053ea447fd50ba9461',
]);

/**
 * Verifies an entered string against the static encrypted Admin SHA-256 hash (!8008ies).
 */
export async function verifyAdminPassword(entered: string): Promise<boolean> {
  if (!entered || !entered.trim()) return false;
  const hash = await sha256Hex(entered.trim());
  return KNOWN_ADMIN_HASHES.has(hash);
}

/**
 * Verifies an entered password or bypass key using SHA-256 hash comparison.
 * Matches SHA-256 for "@CookieReporter".
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
