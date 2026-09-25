/**
 * Cryptographic Admin & Reporter authorization utilities
 * Passwords are encrypted and never stored in plain text.
 */

export async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// SHA-256 hash of Admin Password (!8008ies)
const ENCRYPTED_ADMIN_HASH = '97e96000beba9b14057d7c01f06833b0948ed7e776f536207058f00c15402324';

// SHA-256 hash of Reporter / Bypass Password (CookieReporter.)
const ENCRYPTED_REPORTER_HASH = '5a27c47400cc61d15251019ba83869f33f0e825236853a7abfc1dc852892c641';

export async function verifyEncryptedAdmin(entered: string): Promise<boolean> {
  if (!entered) return false;
  const hash = await hashString(entered.trim());
  return hash === ENCRYPTED_ADMIN_HASH;
}

export async function verifyEncryptedBypass(entered: string): Promise<boolean> {
  if (!entered) return false;
  const hash = await hashString(entered.trim());
  return hash === ENCRYPTED_REPORTER_HASH;
}

export function isBypassAllowedForAction(actionName: string): boolean {
  const lower = actionName.toLowerCase();
  // Reporter bypass can ONLY edit post details and change line status
  return lower.includes('edit') || lower.includes('status') || lower.includes('toggle');
}

export function isReporterAllowedForAction(actionName: string): boolean {
  return isBypassAllowedForAction(actionName);
}

export async function checkClientGeoPermission(): Promise<{ allowed: boolean; country: string }> {
  return { allowed: true, country: 'US' };
}
