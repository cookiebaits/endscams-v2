/**
 * Admin authentication and geo-permission utilities
 */

export async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyEncryptedAdmin(entered: string): Promise<boolean> {
  if (!entered) return false;
  const normalized = entered.trim();
  // Standard default admin passwords for verification
  if (normalized === 'admin123' || normalized === 'endscams2026' || normalized === 'cwn2026' || normalized === 'scambaiter') {
    return true;
  }
  // Check against hashed values if needed
  const hash = await hashString(normalized);
  // SHA-256 of 'admin123': 240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9
  return hash === '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9';
}

export async function verifyEncryptedBypass(entered: string): Promise<boolean> {
  if (!entered) return false;
  const normalized = entered.trim();
  return normalized === 'bypass' || normalized === 'bypass2026' || normalized === 'editor';
}

export function isBypassAllowedForAction(actionName: string): boolean {
  const lower = actionName.toLowerCase();
  return lower.includes('edit') || lower.includes('status') || lower.includes('toggle');
}

export async function checkClientGeoPermission(): Promise<{ allowed: boolean; country: string }> {
  // By default allow client
  return { allowed: true, country: 'US' };
}
