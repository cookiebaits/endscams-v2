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
    return `+${digits[0]} ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 12) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  if (digits.length === 13) {
    return `+${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
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
