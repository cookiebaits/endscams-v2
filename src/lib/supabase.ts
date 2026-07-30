import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits;
}

export function formatPhoneDisplay(phoneDigits: string): string {
  // Preserve numbers that already have international formatting
  if (phoneDigits.startsWith('+')) return phoneDigits;

  const digits = phoneDigits.replace(/\D/g, '');

  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11) {
    if (digits.startsWith('1')) {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    if (digits.startsWith('27')) {
      return `+27 ${digits.slice(2, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
    }
    if (digits.startsWith('44')) {
      return `+44 ${digits.slice(2, 6)} ${digits.slice(6)}`;
    }
  }
  if (digits.length === 12) {
    if (digits.startsWith('44')) {
      return `+44 ${digits.slice(2, 6)} ${digits.slice(6)}`;
    }
  }
  if (digits.length === 13) {
    if (digits.startsWith('234')) {
      return `+234 ${digits.slice(3, 6)} ${digits.slice(6, 10)} ${digits.slice(10)}`;
    }
  }

  // Generic fallback for anything else, preserving country code structure if it has one
  if (digits.length > 10) {
      if (digits.startsWith('234')) return `+234 ${digits.slice(3)}`;
      if (digits.startsWith('27')) return `+27 ${digits.slice(2)}`;
      if (digits.startsWith('44')) return `+44 ${digits.slice(2)}`;
      if (digits.startsWith('1')) return `+1 ${digits.slice(1)}`;
  }

  return `+${digits}`;
}

export function isTollFree(digits: string): boolean {
  // Strip a leading US '1' if present for accurate area code checking
  const coreDigits = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (coreDigits.length !== 10) return false;
  
  const areaCode = coreDigits.slice(0, 3);
  return ['800', '833', '844', '855', '866', '877', '888'].includes(areaCode);
}

export function isFakeNumber(digits: string): boolean {
  // E.164 standards: valid numbers are generally between 8 and 15 digits
  if (digits.length < 8 || digits.length > 15) return true;
  
  // Filter numbers made of a single repeated digit (e.g., 000-000-0000, 111-111-1111)
  if (/^(\d)\1+$/.test(digits)) return true;
  
  // Specific common fake/sequential strings
  const fakes = ['1234567890', '123456789', '0123456789'];
  if (fakes.some(fake => digits.includes(fake))) return true;

  // Filter 555 numbers (both 555-XXX-XXXX and XXX-555-XXXX formats)
  const coreDigits = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (coreDigits.length === 10 && (coreDigits.startsWith('555') || coreDigits.slice(3, 6) === '555')) {
    return true; 
  }

  return false;
}

// Unified wrapper function used by the Tracker Page to filter out garbage data
export function isValidScamNumber(phoneDigits: string): boolean {
  const digitsOnly = phoneDigits.replace(/\D/g, '');
  
  if (isFakeNumber(digitsOnly)) return false;
  if (isTollFree(digitsOnly)) return false;
  
  return true;
}
