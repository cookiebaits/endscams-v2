import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ThreatRecord } from '../types';
import { formatDisplayPhone, isTollFreeNumber } from '../utils/phoneUtils';
import { normalizeToNumericalDate } from '../utils/dateUtils';

let supabaseInstance: SupabaseClient | null = null;
let activeUrl = '';
let activeKey = '';

export function getStoredSupabaseConfig(): { url: string; key: string } {
  let url =
    (typeof process !== 'undefined' && process.env?.SUPABASE_URL) ||
    (import.meta as any).env?.SUPABASE_URL ||
    (import.meta as any).env?.VITE_SUPABASE_URL ||
    '';

  let key =
    (typeof process !== 'undefined' && (process.env?.SUPABASE_KEY || process.env?.SUPABASE_ANON_KEY)) ||
    (import.meta as any).env?.SUPABASE_KEY ||
    (import.meta as any).env?.SUPABASE_ANON_KEY ||
    (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
    '';

  if (typeof window !== 'undefined') {
    const localUrl = localStorage.getItem('endscams_supabase_url');
    const localKey = localStorage.getItem('endscams_supabase_key');
    if (localUrl && localKey) {
      url = localUrl;
      key = localKey;
    }
  }

  return { url: url.trim(), key: key.trim() };
}

export async function fetchServerSupabaseConfig(): Promise<{ url: string; key: string }> {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const data = await res.json();
      if (data.supabaseUrl && data.supabaseKey) {
        saveSupabaseConfig(data.supabaseUrl, data.supabaseKey);
        return { url: data.supabaseUrl, key: data.supabaseKey };
      }
    }
  } catch {}
  return getStoredSupabaseConfig();
}

export function saveSupabaseConfig(url: string, key: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('endscams_supabase_url', url.trim());
    localStorage.setItem('endscams_supabase_key', key.trim());
  }
  supabaseInstance = null; // reset to force re-instantiation
  activeUrl = '';
  activeKey = '';
}

export function getSupabaseClient(): SupabaseClient | null {
  const { url, key } = getStoredSupabaseConfig();
  if (!url || !key) return null;

  if (supabaseInstance && activeUrl === url && activeKey === key) {
    return supabaseInstance;
  }

  try {
    supabaseInstance = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    activeUrl = url;
    activeKey = key;
    return supabaseInstance;
  } catch (err) {
    console.warn('[Supabase Client] Failed to instantiate:', err);
    return null;
  }
}

/**
 * Dynamic proxy export for modules directly importing `supabase`
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseClient();
    if (client) {
      const val = (client as any)[prop];
      return typeof val === 'function' ? val.bind(client) : val;
    }
    const fallback = createClient('https://placeholder.supabase.co', 'placeholder-key');
    const val = (fallback as any)[prop];
    return typeof val === 'function' ? val.bind(fallback) : val;
  },
});

export const formatPhoneDisplay = (rawPhone: string, cleanDigits?: string) => {
  const digits = cleanDigits || rawPhone.replace(/\D/g, '');
  return formatDisplayPhone(rawPhone, digits);
};

export const normalizePhone = (phone: string) => (phone || '').replace(/\D/g, '');

export const isTollFree = isTollFreeNumber;

export interface SupabaseSyncResult {
  success: boolean;
  count?: number;
  records?: ThreatRecord[];
  tableUsed?: string;
  error?: string;
  isRlsError?: boolean;
}

/**
 * Fetch records from Supabase tables (tries tracker_entries first, then scam_records)
 */
export async function fetchFromSupabase(): Promise<SupabaseSyncResult> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: 'Supabase client not configured (URL & Key needed).' };
  }

  // 1. Try tracker_entries
  try {
    const { data, error } = await client
      .from('tracker_entries')
      .select('*')
      .order('detected_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      const mapped = data.map((item: any) => mapSupabaseRowToThreatRecord(item, 'tracker_entries'));
      return {
        success: true,
        count: mapped.length,
        records: mapped,
        tableUsed: 'tracker_entries',
      };
    }

    if (error) {
      const isRls = error.code === '42501' || error.message.toLowerCase().includes('row-level security');
      console.warn('[Supabase] tracker_entries query error:', error);

      // Try fallback to scam_records
      const fallback = await client
        .from('scam_records')
        .select('*')
        .order('detected_at', { ascending: false });

      if (!fallback.error && Array.isArray(fallback.data)) {
        const mapped = fallback.data.map((item: any) => mapSupabaseRowToThreatRecord(item, 'scam_records'));
        return {
          success: true,
          count: mapped.length,
          records: mapped,
          tableUsed: 'scam_records',
        };
      }

      return {
        success: false,
        error: error.message || 'Error querying tracker_entries',
        isRlsError: isRls,
      };
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error querying Supabase' };
  }

  return { success: false, error: 'Unknown Supabase error' };
}

/**
 * Clean & normalize rows specifically matching standard tracker_entries table schema
 */
function buildTrackerEntriesRows(records: ThreatRecord[]): any[] {
  return records.map((r) => {
    const dateNorm = normalizeToNumericalDate(r.report_date);
    const isoDate = `${dateNorm}T12:00:00.000Z`;

    return {
      id: r.id || `rec-${r.phone_digits}`,
      phone_number: r.phone_number,
      phone_digits: r.phone_digits,
      category: r.category || 'General Tech Support & Refund Scams',
      impersonated_company: r.impersonated_company || 'N/A',
      invoice_number: r.invoice_number || 'N/A',
      amount_charged: r.amount_charged || 'N/A',
      source_name: r.source_name || 'Threat Intelligence',
      source_url: r.source_url || '',
      description: r.description || '',
      threat_intel: r.description || '',
      report_date: dateNorm,
      detected_at: isoDate,
      is_down: Boolean(r.is_down),
      status: r.is_down ? 'Out of Service' : 'Active',
      updated_at: new Date().toISOString(),
    };
  });
}

/**
 * Minimalist fallback row representation to bypass any non-standard column errors
 */
function buildMinimalistRows(records: ThreatRecord[]): any[] {
  return records.map((r) => ({
    id: r.id || `rec-${r.phone_digits}`,
    phone_number: r.phone_number,
    phone_digits: r.phone_digits,
    category: r.category || 'General Tech Support & Refund Scams',
    impersonated_company: r.impersonated_company || 'N/A',
    description: r.description || '',
    report_date: normalizeToNumericalDate(r.report_date),
    is_down: Boolean(r.is_down),
    status: r.is_down ? 'Out of Service' : 'Active',
  }));
}

/**
 * Upsert threat records to Supabase with schema-tolerance
 */
export async function upsertToSupabase(records: ThreatRecord[]): Promise<SupabaseSyncResult> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: 'Supabase client not configured' };
  }

  if (!records || records.length === 0) {
    return { success: true, count: 0 };
  }

  const standardRows = buildTrackerEntriesRows(records);

  // Attempt 1: Standard tracker_entries upsert
  try {
    const { error } = await client
      .from('tracker_entries')
      .upsert(standardRows, { onConflict: 'phone_digits' });

    if (!error) {
      return { success: true, count: standardRows.length, tableUsed: 'tracker_entries' };
    }

    console.warn('[Supabase Upsert tracker_entries error]:', error);

    // If schema cache or column mismatch error, retry with minimalist columns
    if (error.message && (error.message.includes('column') || error.message.includes('schema cache'))) {
      const minRows = buildMinimalistRows(records);
      const minAttempt = await client
        .from('tracker_entries')
        .upsert(minRows, { onConflict: 'phone_digits' });

      if (!minAttempt.error) {
        return { success: true, count: minRows.length, tableUsed: 'tracker_entries' };
      }
    }

    const isRls = error.code === '42501' || error.message.toLowerCase().includes('row-level security');

    // Attempt 2: Fallback to scam_records if table is named scam_records
    const scamRows = records.map((r) => ({
      id: r.id || `rec-${r.phone_digits}`,
      phone: r.phone_number,
      clean_phone: r.phone_digits,
      scam_type: r.category || 'General Tech Support & Refund Scams',
      impersonated_company: r.impersonated_company || 'N/A',
      description: r.description || '',
      report_date: normalizeToNumericalDate(r.report_date),
      is_down: Boolean(r.is_down),
    }));

    const fallback = await client
      .from('scam_records')
      .upsert(scamRows, { onConflict: 'clean_phone' });

    if (!fallback.error) {
      return { success: true, count: scamRows.length, tableUsed: 'scam_records' };
    }

    return {
      success: false,
      error: error.message || fallback.error?.message,
      isRlsError: isRls,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function mapSupabaseRowToThreatRecord(item: any, table: string): ThreatRecord {
  const raw = item.phone_number || item.phone || '';
  const digits = item.phone_digits || item.clean_phone || raw.replace(/\D/g, '');
  const reportDate = normalizeToNumericalDate(item.report_date || item.post_date || item.detected_at || new Date());

  let altNumbers = undefined;
  if (Array.isArray(item.alt_numbers)) {
    altNumbers = item.alt_numbers;
  }

  return {
    id: String(item.id || `sb-${digits}`),
    phone_number: formatDisplayPhone(raw, digits),
    phone_digits: digits,
    is_whatsapp: Boolean(item.is_whatsapp || item.isWhatsapp),
    alt_numbers: altNumbers,
    source_name: item.source_name || item.source_platform || (table === 'tracker_entries' ? 'Supabase Tracker' : 'Supabase Scams'),
    source_url: item.source_url || '',
    report_date: reportDate,
    category: item.category || item.scam_type || 'General Tech Support & Refund Scams',
    impersonated_company: item.impersonated_company || 'N/A',
    scammer_name: item.scammer_name || item.impersonated_company,
    invoice_number: item.invoice_number || 'N/A',
    amount_charged: item.amount_charged || 'N/A',
    money_lost: item.money_lost,
    how_contacted: item.how_contacted,
    reporter_name: item.reporter_name,
    reporter_email: item.reporter_email,
    image_url: item.image_url || item.evidence_url,
    description: item.description || item.threat_intel || item.snippet || 'Record synced from database.',
    is_down: Boolean(item.is_down || item.is_number_down || item.status === 'Out of Service'),
  };
}
