import { createClient } from '@supabase/supabase-js';
import { formatDisplayPhone, isTollFreeNumber } from '../utils/phoneUtils';

const metaEnv = (import.meta as any).env || {};
const supabaseUrl = metaEnv.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = metaEnv.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export function normalizePhone(input: string): string {
  if (!input) return '';
  return String(input).replace(/\D/g, '');
}

export function formatPhoneDisplay(input: string): string {
  if (!input) return '';
  const digits = normalizePhone(input);
  return formatDisplayPhone(input, digits);
}

export function isTollFree(input: string): boolean {
  return isTollFreeNumber(input);
}
