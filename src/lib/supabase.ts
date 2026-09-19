import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = atob('aHR0cHM6Ly9qb3hlcWxna3V2Z3Zqb3NobWpxdS5zdXBhYmFzZS5jbw==');
const DEFAULT_SUPABASE_KEY = atob('c2JfcHVibGlzaGFibGVfdU5FSXZHX1BnNjllc25uVTIyRm1nUV8wRGMwQlJLOQ==');

export function resolveSupabaseUrl(rawUrl?: string): string {
  if (!rawUrl) return DEFAULT_SUPABASE_URL;
  const url = rawUrl.trim();
  if (!url) return DEFAULT_SUPABASE_URL;

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  if (url.startsWith('postgresql://') || url.startsWith('postgres://')) {
    const matchCo = url.match(/db\.([a-z0-9]+)\.supabase\.co/i);
    if (matchCo && matchCo[1]) {
      return `https://${matchCo[1]}.supabase.co`;
    }
    const matchPooler = url.match(/postgres\.([a-z0-9]+):/i);
    if (matchPooler && matchPooler[1]) {
      return `https://${matchPooler[1]}.supabase.co`;
    }
    const matchHost = url.match(/@([^:/]+)/);
    if (matchHost && matchHost[1] && matchHost[1].includes('supabase')) {
      const parts = matchHost[1].split('.');
      if (parts.length >= 3) {
        return `https://${parts[1]}.supabase.co`;
      }
    }
  }

  return DEFAULT_SUPABASE_URL;
}

const rawSupabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.VITE_DB ||
  DEFAULT_SUPABASE_URL;

const supabaseUrl = resolveSupabaseUrl(rawSupabaseUrl);

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_DB_KEY ||
  import.meta.env.VITE_DB_Key ||
  DEFAULT_SUPABASE_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Formats phone numbers for display, handling North American & International formats (+xx, +xxx)
 */
export function formatPhoneDisplay(phoneDigits: string): string {
  if (!phoneDigits) return '';
  if (phoneDigits.startsWith('+')) return phoneDigits;

  const digits = phoneDigits.replace(/\D/g, '');

  // Standard US / NANP (10 digits or 11 digits starting with 1)
  if (digits.length === 10) {
    return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  // Common country codes formatted explicitly
  if (digits.startsWith('234')) return `+234 ${digits.slice(3, 6)} ${digits.slice(6, 10)} ${digits.slice(10)}`; // Nigeria
  if (digits.startsWith('44'))  return `+44 ${digits.slice(2, 6)} ${digits.slice(6)}`;                           // UK
  if (digits.startsWith('27'))  return `+27 ${digits.slice(2, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;      // S. Africa
  if (digits.startsWith('91'))  return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;                           // India

  // Generic international fallback (+xx / +xxx)
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
