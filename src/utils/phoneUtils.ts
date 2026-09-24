/**
 * Universal Phone Formatting and Clipboard Operations Utility
 *
 * Rules:
 * 1. US numbers MUST ALWAYS display as: 1 (xxx) xxx-xxxx
 *    Even if provided as +1 (xxx) xxx-xxxx, xxx-xxx-xxxx, 1-xxx-xxx-xxxx, (xxx) xxx-xxxx, or raw 10/11 digits.
 * 2. Copy Button logic:
 *    - For numbers within the USA: copy the 10 digits as xxxxxxxxxx (no parenthesis, no hyphens, no country code 1)
 *    - For international numbers outside USA: always copy +xxxxxxxxxxxx (leading plus with clean digits)
 */

export function formatDisplayPhone(rawPhone?: string | null, cleanDigits?: string | null): string {
  if (!rawPhone && !cleanDigits) return '';
  const raw = String(rawPhone || '').replace(/^=\+?/, '').replace(/^"/, '').replace(/"$/, '').trim();
  const digits = String(cleanDigits || raw).replace(/\D/g, '');

  // US Phone Formatting: 1 (xxx) xxx-xxxx
  if (digits.length === 10) {
    return `1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  // African Nations Formatting
  if (digits.startsWith('234') && digits.length === 13) {
    return `+234 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  if (digits.startsWith('254') && digits.length === 12) {
    return `+254 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  if (digits.startsWith('27') && digits.length === 11) {
    return `+27 ${digits.slice(2, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  if (digits.startsWith('233') && digits.length === 12) {
    return `+233 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }

  if (raw.startsWith('+')) {
    return raw;
  }
  return `+${digits}`;
}

export function getCleanCopyPhone(phoneInput?: string | null): string {
  if (!phoneInput) return '';
  const digits = String(phoneInput).replace(/\D/g, '');
  if (!digits) return '';

  // Within the USA: 10 digits (or 11 digits starting with 1)
  if (digits.length === 10) {
    return digits; // Exactly 10 digits xxxxxxxxxx
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1); // Strips country code 1, exactly 10 digits xxxxxxxxxx
  }

  // International numbers outside the USA: always copy +xxxxxxxxxxxx
  return `+${digits}`;
}

export function isTollFreeNumber(_phone: string): boolean {
  return false;
}
