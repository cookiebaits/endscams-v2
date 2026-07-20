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

export function formatPhoneDisplay(digits: string): string {
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
  if (digits.length !== 10) return false;
  const areaCode = digits.slice(0, 3);
  return ['800', '833', '844', '855', '866', '877', '888'].includes(areaCode);
}

export function isFakeNumber(digits: string): boolean {
  if (digits.length < 7 || digits.length > 15) return true;
  if (/^0+$/.test(digits) || /^1+$/.test(digits)) return true;
  if (digits.length === 10 && digits.startsWith('555')) return true;
  return false;
}
