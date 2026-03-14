import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').slice(0, 10);
}

export function formatPhoneDisplay(digits: string): string {
  if (digits.length !== 10) return digits;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function isTollFree(digits: string): boolean {
  if (digits.length !== 10) return false;
  const areaCode = digits.slice(0, 3);
  return ['800', '833', '844', '855', '866', '877', '888'].includes(areaCode);
}

export function isFakeNumber(digits: string): boolean {
  if (digits.length !== 10) return false;
  return digits.startsWith('555') || digits === '0000000000' || digits === '1111111111';
}
