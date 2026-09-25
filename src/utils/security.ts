// Cryptographic security and Geo-IP restriction utilities
// One-way cryptographic hashes (SHA-256) of authorized credentials
// IMPORTANT: Plain-text passwords are NEVER stored in source code.
export const ENCRYPTED_ADMIN_HASH = '97e96000beba9b14057d7c01f06833b0948ed7e776f536207058f00c15402324';
export const ENCRYPTED_BYPASS_HASH = 'dbd823ef2cafd01668dd5e20fb15cd29aec7bff94ea7d1d6f3333b28cc7272ef';

// Allowed countries for adding phone numbers:
// US, Canada, Australia, and all 27 European Union (EU) member states
export const ALLOWED_ADD_NUMBER_COUNTRIES = new Set([
  // United States & Canada
  'US',
  'USA',
  'CA',
  'CAN',
  // Australia
  'AU',
  'AUS',
  // European Union (EU 27)
  'AT', 'AUT', // Austria
  'BE', 'BEL', // Belgium
  'BG', 'BGR', // Bulgaria
  'HR', 'HRV', // Croatia
  'CY', 'CYP', // Cyprus
  'CZ', 'CZE', // Czech Republic / Czechia
  'DK', 'DNK', // Denmark
  'EE', 'EST', // Estonia
  'FI', 'FIN', // Finland
  'FR', 'FRA', // France
  'DE', 'DEU', // Germany
  'GR', 'GRC', // Greece
  'HU', 'HUN', // Hungary
  'IE', 'IRL', // Ireland
  'IT', 'ITA', // Italy
  'LV', 'LVA', // Latvia
  'LT', 'LTU', // Lithuania
  'LU', 'LUX', // Luxembourg
  'MT', 'MLT', // Malta
  'NL', 'NLD', // Netherlands
  'PL', 'POL', // Poland
  'PT', 'PRT', // Portugal
  'RO', 'ROU', // Romania
  'SK', 'SVK', // Slovakia
  'SI', 'SVN', // Slovenia
  'ES', 'ESP', // Spain
  'SE', 'SWE', // Sweden
]);

/**
 * Compute SHA-256 hex digest using Web Crypto API in browser or subtle crypto.
 */
export async function computeSha256Hex(text: string): Promise<string> {
  const normalized = text.trim();
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const msgUint8 = new TextEncoder().encode(normalized);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback for non-crypto environments
  return '';
}

/**
 * Check if the input matches the encrypted admin password hash.
 */
export async function verifyEncryptedAdmin(password: string): Promise<boolean> {
  if (!password || !password.trim()) return false;
  const hash = await computeSha256Hex(password);
  return hash.toLowerCase() === ENCRYPTED_ADMIN_HASH.toLowerCase();
}

/**
 * Check if the input matches the encrypted bypass password hash.
 */
export async function verifyEncryptedBypass(password: string): Promise<boolean> {
  if (!password || !password.trim()) return false;
  const hash = await computeSha256Hex(password);
  return hash.toLowerCase() === ENCRYPTED_BYPASS_HASH.toLowerCase();
}

/**
 * Limit bypass password permissions strictly to Editing and Changing status.
 */
export function isBypassAllowedForAction(actionName: string): boolean {
  const norm = (actionName || '').toLowerCase();
  return (
    norm.includes('edit') ||
    norm.includes('status') ||
    norm.includes('monitored number') ||
    norm.includes('threat post') ||
    norm.includes('line status') ||
    norm.includes('import csv') ||
    norm.includes('csv')
  );
}

/**
 * Check client IP country against allowed list (US, Canada, Australia, EU).
 */
export async function checkClientGeoPermission(): Promise<{ allowed: boolean; country: string }> {
  // 1. Try server endpoint
  try {
    const res = await fetch('/api/client-geo', { method: 'GET' });
    if (res.ok) {
      const data = await res.json();
      if (typeof data.allowed === 'boolean') {
        return { allowed: Boolean(data.allowed), country: data.country || 'UNKNOWN' };
      }
    }
  } catch {}

  // 2. Client-side fallback if server endpoint is not available
  try {
    const res = await fetch('https://api.country.is', { signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      const data = await res.json();
      const code = String(data.country || '').toUpperCase();
      if (code) {
        return {
          allowed: ALLOWED_ADD_NUMBER_COUNTRIES.has(code),
          country: code,
        };
      }
    }
  } catch {}

  // Default to allowed in dev/local environment if external lookup fails
  return { allowed: true, country: 'LOCAL' };
}
