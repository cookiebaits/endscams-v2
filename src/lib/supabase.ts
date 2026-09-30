import { createClient } from '@supabase/supabase-js';

function resolveSupabaseApiUrl(rawValue: string): string {
  const value = rawValue.trim();
  if (value.startsWith('http://') || value.startsWith('https://')) return value;

  const directHost = value.match(/(?:@|db\.)([a-z0-9]+)\.supabase\.co/i);
  if (directHost?.[1]) return `https://${directHost[1]}.supabase.co`;

  const poolerHost = value.match(/postgres\.([a-z0-9]+):/i);
  if (poolerHost?.[1]) return `https://${poolerHost[1]}.supabase.co`;

  return '';
}

const supabaseUrl = resolveSupabaseApiUrl(
  import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_DB || ''
);

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_DB_KEY ||
  import.meta.env.VITE_DB_Key ||
  '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase] Missing a valid Supabase URL or publishable key. Database features will not work.');
}

export const supabase = createClient(
  supabaseUrl || 'https://invalid.supabase.co',
  supabaseAnonKey || 'missing-publishable-key'
);

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Formats phone numbers for display, handling North American & International formats (+xx, +xxx like +256)
 */
export function formatPhoneDisplay(phoneDigits: string): string {
  if (!phoneDigits) return '';
  const raw = phoneDigits.trim();
  const isPlus = raw.startsWith('+');
  const digits = raw.replace(/\D/g, '');
  if (!digits) return raw;

  // International format if starts with '+' or has country code length > 10 (not standard 10/11 US)
  if (isPlus || (digits.length > 10 && !digits.startsWith('1')) || (digits.length >= 11 && !digits.startsWith('1'))) {
    let ccLength = 3;
    if (digits.startsWith('1')) {
      ccLength = 1;
    } else if (
      ['44', '33', '49', '39', '34', '31', '32', '41', '43', '46', '47', '45', '48', '61', '64', '81', '82', '86', '91', '20', '27', '55', '52', '54'].some(p => digits.startsWith(p))
    ) {
      ccLength = 2;
    } else if (isPlus) {
      ccLength = Math.min(3, digits.length);
    } else if (digits.length <= 10) {
      ccLength = Math.min(3, Math.max(2, digits.length - 7));
    }

    if (ccLength === 1 && digits.length === 11) {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }

    const cc = digits.slice(0, ccLength);
    const rest = digits.slice(ccLength);
    if (!rest) {
      return `+(${cc})`;
    }
    if (rest.length <= 3) {
      return `+(${cc}) ${rest}`;
    }
    if (rest.length <= 8) {
      return `+(${cc}) ${rest.slice(0, 3)}-${rest.slice(3)}`;
    }
    return `+(${cc}) ${rest.slice(0, 3)}-${rest.slice(3, 8)}${rest.length > 8 ? '-' + rest.slice(8) : ''}`;
  }

  // Standard US / NANP (10 digits or 11 digits starting with 1)
  if (digits.length === 10) {
    return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  return `+${digits}`;
}

/**
 * Filters out US Toll-Free prefixes (800, 833, 844, 855, 866, 877, 888)
 */
export function isTollFree(digits: string): boolean {
  const coreDigits = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (coreDigits.length !== 10) return false;

  const areaCode = coreDigits.slice(0, 3);
  return ['800', '833', '844', '855', '866', '877', '888'].includes(areaCode);
}

/**
 * Filters out dummy, fake, test, and placeholder phone numbers
 */
export function isFakeNumber(digits: string): boolean {
  const clean = digits.replace(/\D/g, '');

  // Valid E.164 international numbers are 8 to 15 digits
  if (clean.length < 8 || clean.length > 15) return true;

  // Repeated single digits (e.g., 0000000000, 1111111111, 9999999999)
  if (/^(\d)\1+$/.test(clean)) return true;

  // Common sequential or dummy patterns
  const knownFakes = [
    '1234567890',
    '0123456789',
    '123456789',
    '9876543210',
    '00000000',
    '12345678'
  ];
  if (knownFakes.some(fake => clean.includes(fake))) return true;

  // US 555 exchange check (e.g. 555-0199 or 800-555-0199)
  const core = clean.length === 11 && clean.startsWith('1') ? clean.slice(1) : clean;
  if (core.length === 10 && (core.startsWith('555') || core.slice(3, 6) === '555')) {
    return true;
  }

  return false;
}

/**
 * Combined validator for phone numbers
 */
export function isValidScamNumber(phoneDigits: string): boolean {
  const digitsOnly = phoneDigits.replace(/\D/g, '');
  if (isFakeNumber(digitsOnly)) return false;
  if (isTollFree(digitsOnly)) return false;
  return true;
}
