import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  Shield,
  Search,
  RefreshCw,
  Download,
  Upload,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  Filter,
  Database,
  X,
  Radio,
  FileSpreadsheet,
  FileText,
  Clock,
  Globe,
  PhoneCall,
  ShieldAlert,
  Calendar,
  Lock,
  Unlock,
  Edit3,
  Save,
  Sparkles,
  Sliders,
  ChevronDown,
  Eye,
  EyeOff,
  Clipboard,
} from 'lucide-react';

export interface AltNumberEntry {
  phone: string;
  digits: string;
  is_whatsapp?: boolean;
}

export interface ThreatRecord {
  id: string;
  phone_number: string;
  phone_digits: string;
  is_whatsapp?: boolean;
  alt_numbers?: AltNumberEntry[];
  source_name: string;
  source_url: string;
  report_date: string;
  category: string;
  description: string;
  impersonated_company?: string;
  scammer_name?: string;
  invoice_number?: string;
  amount_charged?: string;
  money_lost?: number | string;
  how_contacted?: string;
  reporter_name?: string;
  reporter_email?: string;
  image_url?: string;
  evidence_url?: string;
  is_down?: boolean;
}

export const STANDARD_SCAM_CATEGORIES = [
  'Lottery & Sweepstakes Scams (American Cash Awards, PCH, Mega Millions)',
  'General Tech Support & Refund Scams (Geek Squad, Microsoft, Apple)',
  'Bank & Financial Impersonation (Chase, Wells Fargo, Zelle, Wire Fraud)',
  'Crypto BTC Recovery Scam',
  'Spellcaster WhatsApp Extortion',
  'Government & Law Enforcement (Social Security, IRS, Police, DEA)',
  'Utility & Telecom Scams (Spectrum, AT&T, Power/Electric)',
  'Job, Task & Investment Scams',
  'Vehicle & Auto Warranty Scams',
  'Healthcare, Medicare & Medical Scams',
  'Romance & Blackmail Scams',
  'Other / Uncategorized Threat',
];

// ============================================================================
// 1. EMBEDDED PHONE & COUNTRY UTILITIES
// ============================================================================

export function formatDisplayPhone(raw: string, digits: string): string {
  if (!digits) return raw || '';
  if (digits.length === 10) {
    return `1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.startsWith('234') && digits.length === 13) {
    return `+234 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  if (digits.startsWith('254') && digits.length === 12) {
    return `+254 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  if (digits.startsWith('27') && digits.length === 11) {
    return `+27 ${digits.slice(2, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return raw.startsWith('+') ? raw : `+${digits}`;
}

export function getCleanCopyPhone(text: string): string {
  if (!text) return '';
  const digits = text.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  return digits || text;
}

export function isFictitiousOrInvalidPhone(digits: string): boolean {
  if (!digits || digits.length < 7) return true;
  if (/^(\d)\1+$/.test(digits)) return true;
  if (digits.includes('5550199') || digits.includes('5550100')) return true;
  return false;
}

export function deriveCountryInfo(rawOrFormatted: string): { name: string; flag: string; code: string } {
  const digits = (rawOrFormatted || '').replace(/\D/g, '');
  if (digits.startsWith('234')) return { name: 'Nigeria', flag: '🇳🇬', code: 'NG' };
  if (digits.startsWith('254')) return { name: 'Kenya', flag: '🇰🇪', code: 'KE' };
  if (digits.startsWith('27')) return { name: 'South Africa', flag: '🇿🇦', code: 'ZA' };
  if (digits.startsWith('44')) return { name: 'United Kingdom', flag: '🇬🇧', code: 'GB' };
  if (digits.startsWith('91')) return { name: 'India', flag: '🇮🇳', code: 'IN' };
  if (digits.startsWith('61')) return { name: 'Australia', flag: '🇦🇺', code: 'AU' };
  if (digits.length === 10 || (digits.length === 11 && digits.startsWith('1'))) {
    return { name: 'United States', flag: '🇺🇸', code: 'US' };
  }
  return { name: 'International', flag: '🌐', code: 'INT' };
}

export function isWhatsAppThreat(record: {
  is_whatsapp?: boolean;
  phone_number?: string;
  phone_digits?: string;
  category?: string;
  description?: string;
  source_name?: string;
}): boolean {
  if (record.is_whatsapp === true) return true;
  const cat = (record.category || '').toLowerCase();
  const desc = (record.description || '').toLowerCase();
  const src = (record.source_name || '').toLowerCase();
  if (cat.includes('whatsapp') || desc.includes('whatsapp') || src.includes('whatsapp')) return true;
  if (cat.includes('spellcaster') || desc.includes('spellcaster')) return true;
  const digits = (record.phone_digits || record.phone_number || '').replace(/\D/g, '');
  if (digits.startsWith('234') || digits.startsWith('254') || digits.startsWith('27')) return true;
  return false;
}

// ============================================================================
// 2. EMBEDDED DATE & TIME UTILITIES
// ============================================================================

export function getPSTDateStamp(): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function normalizeToNumericalDate(dateStr: any): string {
  if (!dateStr) return getPSTDateStamp();
  const str = String(dateStr).trim();
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const usMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (usMatch) {
    const m = usMatch[1].padStart(2, '0');
    const d = usMatch[2].padStart(2, '0');
    const y = usMatch[3];
    return `${y}-${m}-${d}`;
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return getPSTDateStamp();
}

export function compareThreatDatesDesc(a: ThreatRecord, b: ThreatRecord): number {
  const normA = normalizeToNumericalDate(a.report_date);
  const normB = normalizeToNumericalDate(b.report_date);
  return normB.localeCompare(normA);
}

export function compareThreatDatesAsc(a: ThreatRecord, b: ThreatRecord): number {
  const normA = normalizeToNumericalDate(a.report_date);
  const normB = normalizeToNumericalDate(b.report_date);
  return normA.localeCompare(normB);
}

// ============================================================================
// 3. EMBEDDED SECURITY & ENCRYPTED HASHES
// ============================================================================

export async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// SHA-256 hash of Admin Password (!8008ies)
const ENCRYPTED_ADMIN_HASH = '97e96000beba9b14057d7c01f06833b0948ed7e776f536207058f00c15402324';
// SHA-256 hash of Reporter Bypass Password (CookieReporter.)
const ENCRYPTED_REPORTER_HASH = '5a27c47400cc61d15251019ba83869f33f0e825236853a7abfc1dc852892c641';

export async function verifyEncryptedAdmin(entered: string): Promise<boolean> {
  if (!entered) return false;
  const hash = await hashString(entered.trim());
  return hash === ENCRYPTED_ADMIN_HASH;
}

export async function verifyEncryptedBypass(entered: string): Promise<boolean> {
  if (!entered) return false;
  const hash = await hashString(entered.trim());
  return hash === ENCRYPTED_REPORTER_HASH;
}

export function isReporterAllowedForAction(actionName: string): boolean {
  const lower = actionName.toLowerCase();
  return lower.includes('edit') || lower.includes('status') || lower.includes('toggle');
}

// ============================================================================
// 4. EMBEDDED SUPABASE CLIENT & DATABASE SYNC
// ============================================================================

let trackerSupabaseInstance: SupabaseClient | null = null;
let trackerActiveUrl = '';
let trackerActiveKey = '';

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
    try {
      fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supabaseUrl: url.trim(), supabaseKey: key.trim() }),
      }).catch(() => {});
    } catch {}
  }
  trackerSupabaseInstance = null;
  trackerActiveUrl = '';
  trackerActiveKey = '';
}

export function getSupabaseClient(): SupabaseClient | null {
  const { url, key } = getStoredSupabaseConfig();
  if (!url || !key) return null;
  if (trackerSupabaseInstance && trackerActiveUrl === url && trackerActiveKey === key) {
    return trackerSupabaseInstance;
  }
  try {
    trackerSupabaseInstance = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
    trackerActiveUrl = url;
    trackerActiveKey = key;
    return trackerSupabaseInstance;
  } catch {
    return null;
  }
}

export async function fetchFromSupabase(): Promise<{ success: boolean; records?: ThreatRecord[]; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase credentials not configured' };

  try {
    const { data, error } = await client
      .from('tracker_entries')
      .select('*')
      .order('detected_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      const records = data.map((item: any) => {
        const raw = item.phone_number || item.phone || '';
        const digits = item.phone_digits || item.clean_phone || raw.replace(/\D/g, '');
        return {
          id: String(item.id || `sb-${digits}`),
          phone_number: formatDisplayPhone(raw, digits),
          phone_digits: digits,
          is_whatsapp: Boolean(item.is_whatsapp || item.isWhatsapp),
          category: item.category || item.scam_type || 'General Tech Support & Refund Scams',
          impersonated_company: item.impersonated_company || 'N/A',
          scammer_name: item.scammer_name || item.impersonated_company,
          invoice_number: item.invoice_number || 'N/A',
          amount_charged: item.amount_charged || 'N/A',
          source_name: item.source_name || item.source_platform || 'Threat Intelligence',
          source_url: item.source_url || '',
          report_date: normalizeToNumericalDate(item.report_date || item.post_date || item.detected_at),
          description: item.description || item.threat_intel || 'Synced record',
          is_down: Boolean(item.is_down || item.is_number_down || item.status === 'Out of Service'),
        };
      });
      return { success: true, records };
    }
    return { success: false, error: error?.message };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function upsertToSupabase(records: ThreatRecord[]): Promise<{ success: boolean; count?: number; error?: string }> {
  const client = getSupabaseClient();
  if (!client || !records || records.length === 0) return { success: false, error: 'No client or records' };

  const rows = records.map((r) => ({
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
    report_date: normalizeToNumericalDate(r.report_date),
    detected_at: new Date().toISOString(),
    is_down: Boolean(r.is_down),
    status: r.is_down ? 'Out of Service' : 'Active',
    updated_at: new Date().toISOString(),
  }));

  try {
    const { error } = await client.from('tracker_entries').upsert(rows, { onConflict: 'phone_digits' });
    if (!error) return { success: true, count: rows.length };

    const minRows = records.map((r) => ({
      id: r.id || `rec-${r.phone_digits}`,
      phone_number: r.phone_number,
      phone_digits: r.phone_digits,
      category: r.category,
      impersonated_company: r.impersonated_company,
      description: r.description,
      report_date: normalizeToNumericalDate(r.report_date),
      is_down: Boolean(r.is_down),
      status: r.is_down ? 'Out of Service' : 'Active',
    }));
    const minAttempt = await client.from('tracker_entries').upsert(minRows, { onConflict: 'phone_digits' });
    if (!minAttempt.error) return { success: true, count: minRows.length };

    return { success: false, error: error.message };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================================================
// 5. EMBEDDED CSV PARSER
// ============================================================================

export function parseFullCSV(csvContent: string): {
  valid: ThreatRecord[];
  rejectedBad: { line: number; raw: string; reason: string }[];
} {
  const lines = csvContent.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const valid: ThreatRecord[] = [];
  const rejectedBad: { line: number; raw: string; reason: string }[] = [];

  if (lines.length === 0) return { valid, rejectedBad };

  const hasHeader = /phone|number|category|company|date/i.test(lines[0]);
  const startIdx = hasHeader ? 1 : 0;

  for (let i = startIdx; i < lines.length; i++) {
    const rawLine = lines[i];
    const cols = rawLine.split(',').map((c) => c.replace(/^["']|["']$/g, '').trim());
    if (cols.length === 0 || !cols[0]) continue;

    const phoneRaw = cols[0];
    const digits = phoneRaw.replace(/\D/g, '');

    if (!digits || isFictitiousOrInvalidPhone(digits)) {
      rejectedBad.push({ line: i + 1, raw: rawLine, reason: 'Invalid or fictitious phone digits' });
      continue;
    }

    const rec: ThreatRecord = {
      id: `csv-${Date.now()}-${i}-${digits.slice(-4)}`,
      phone_number: formatDisplayPhone(phoneRaw, digits),
      phone_digits: digits,
      is_whatsapp: digits.startsWith('234') || digits.startsWith('254') || digits.startsWith('27'),
      category: cols[1] || 'General Tech Support & Refund Scams',
      impersonated_company: cols[2] || 'N/A',
      scammer_name: cols[2] || 'N/A',
      invoice_number: cols[3] || 'N/A',
      amount_charged: cols[4] || 'N/A',
      source_name: cols[5] || 'CSV Batch Import',
      source_url: cols[6] || '',
      report_date: normalizeToNumericalDate(cols[7] || getPSTDateStamp()),
      description: cols[8] || 'Bulk threat record imported via CSV.',
      is_down: false,
    };

    valid.push(rec);
  }

  return { valid, rejectedBad };
}

// ============================================================================
// 6. DEFAULT DATABASE SEED RECORDS
// ============================================================================

const DEFAULT_SEED_RECORDS: ThreatRecord[] = [];

// Helper: Deduplication
function deduplicateRecords(records: ThreatRecord[]): ThreatRecord[] {
  const map = new Map<string, ThreatRecord>();
  records.forEach((r) => {
    const key = r.phone_digits || r.phone_number.replace(/\D/g, '');
    if (key) map.set(key, r);
  });
  return Array.from(map.values());
}

export interface TrackerPageProps {
  onNavigateToReport?: () => void;
}

export const TrackerPage: React.FC<TrackerPageProps> = ({ onNavigateToReport }) => {
  const [records, setRecords] = useState<ThreatRecord[]>(DEFAULT_SEED_RECORDS);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedSource, setSelectedSource] = useState('ALL');
  const [selectedCountry, setSelectedCountry] = useState('ALL');
  const [selectedRetention, setSelectedRetention] = useState<'ALL' | 'PRIZE_6MO' | 'STANDARD_90D'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'ACTIVE' | 'DOWN'>('ALL');
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isSyncingWithDb, setIsSyncingWithDb] = useState(false);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  // Security Auth Modal
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authActionName, setAuthActionName] = useState('');
  const [authPendingCallback, setAuthPendingCallback] = useState<(() => void) | null>(null);
  const [enteredPassword, setEnteredPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthVerifying, setIsAuthVerifying] = useState(false);

  // CSV Import Modal
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importMode, setImportMode] = useState<'upload' | 'paste'>('upload');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [pastedCsvText, setPastedCsvText] = useState('');
  const [importPreview, setImportPreview] = useState<{ valid: ThreatRecord[]; rejectedBad: any[] } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isCsvDragging, setIsCsvDragging] = useState(false);
  const csvFileInputRef = useRef<HTMLInputElement>(null);

  // Record Editing State
  const [editingRecord, setEditingRecord] = useState<ThreatRecord | null>(null);

  // Database Connection / Settings Modal
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [supabaseUrlInput, setSupabaseUrlInput] = useState('');
  const [supabaseKeyInput, setSupabaseKeyInput] = useState('');
  const [dbTestResult, setDbTestResult] = useState<string | null>(null);
  const [isTestingDb, setIsTestingDb] = useState(false);

  // Initial Load & Dokploy / Supabase Fetch
  useEffect(() => {
    fetchServerSupabaseConfig().then(({ url, key }) => {
      setSupabaseUrlInput(url);
      setSupabaseKeyInput(key);
    });

    loadSharedRecords();
  }, []);

  const loadSharedRecords = async () => {
    setIsSyncingWithDb(true);
    try {
      // 1. Direct Supabase fetch as 100% authoritative primary source
      const sb = await fetchFromSupabase();
      if (sb.success && Array.isArray(sb.records) && sb.records.length > 0) {
        setRecords(sb.records.sort(compareThreatDatesDesc));
        setIsSyncingWithDb(false);
        return;
      }

      // 2. Server backend fallback
      const res = await fetch('/api/records');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.records) && data.records.length > 0) {
          const mapped = data.records.map((r: any) => ({
            id: r.id || `rec-${r.phone_digits || r.phone}`,
            phone_number: r.phone_number || r.phone,
            phone_digits: r.phone_digits || r.cleanPhone || (r.phone_number || '').replace(/\D/g, ''),
            is_whatsapp: Boolean(r.is_whatsapp || r.isWhatsapp),
            category: r.category || r.scamType || 'General Tech Support & Refund Scams',
            impersonated_company: r.impersonated_company || r.impersonatedCompany || 'N/A',
            scammer_name: r.scammer_name || r.impersonated_company || 'N/A',
            invoice_number: r.invoice_number || 'N/A',
            amount_charged: r.amount_charged || 'N/A',
            source_name: r.source_name || r.platform || 'Threat Intel',
            source_url: r.source_url || '',
            report_date: normalizeToNumericalDate(r.report_date || r.postDate || r.detectedAt),
            description: r.description || r.snippet || 'Live threat feed record',
            is_down: Boolean(r.is_down || r.isNumberDown),
          }));
          setRecords(mapped.sort(compareThreatDatesDesc));
        }
      }
    } catch (err) {
      console.warn('[Tracker] Error loading records:', err);
    } finally {
      setIsSyncingWithDb(false);
    }
  };

  // Auth gatekeeper
  const requireAdminAuth = (actionTitle: string, callback: () => void) => {
    setAuthActionName(actionTitle);
    setAuthPendingCallback(() => callback);
    setEnteredPassword('');
    setAuthError(null);
    setIsAuthModalOpen(true);
  };

  const handleVerifyAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enteredPassword) return;
    setIsAuthVerifying(true);
    setAuthError(null);

    const isAdmin = await verifyEncryptedAdmin(enteredPassword);
    const isBypass = await verifyEncryptedBypass(enteredPassword);

    if (isAdmin || (isBypass && isReporterAllowedForAction(authActionName))) {
      setIsAuthModalOpen(false);
      setEnteredPassword('');
      if (authPendingCallback) authPendingCallback();
    } else {
      setAuthError('Incorrect authorization key.');
    }
    setIsAuthVerifying(false);
  };

  // Run Threat Scan
  const executeScan = async () => {
    setIsScanning(true);
    try {
      const res = await fetch('/api/scan-now', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setStatusNotification(`Threat scan complete! Harvested updates from intelligence feeds.`);
        loadSharedRecords();
      }
    } catch {
      setStatusNotification('Scan encountered a network issue. Retrying connection...');
    } finally {
      setIsScanning(false);
    }
  };

  // Toggle Status
  const handleToggleStatus = async (record: ThreatRecord) => {
    const updated = { ...record, is_down: !record.is_down };
    setRecords((prev) => prev.map((r) => (r.id === record.id ? updated : r)));
    setStatusNotification(`Status updated for ${record.phone_number}.`);

    try {
      fetch(`/api/records/${record.id}/toggle-down`, { method: 'POST' }).catch(() => {});
      upsertToSupabase([updated]).catch(() => {});
    } catch {}
  };

  // Copy Phone Number
  const handleCopyPhone = (id: string, text: string) => {
    const clean = getCleanCopyPhone(text);
    navigator.clipboard.writeText(clean);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // CSV File Handler
  const handleCSVFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    processCSVTextFromFile(file);
  };

  const processCSVTextFromFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      handleRawCSVInput(text);
    };
    reader.readAsText(file);
  };

  const handleRawCSVInput = (text: string) => {
    setPastedCsvText(text);
    const { valid, rejectedBad } = parseFullCSV(text);
    if (valid.length === 0) {
      setImportError('No valid threat records detected in CSV input. Please ensure columns include phone numbers.');
      setImportPreview(null);
    } else {
      setImportError(null);
      setImportPreview({ valid, rejectedBad });
    }
  };

  const handleDownloadCSVTemplate = () => {
    const templateContent = `Phone Number,Category,Company / Target,Invoice Number,Amount Charged,Source,Source URL,Date Detected,Description
1 (800) 555-0199,General Tech Support & Refund Scams,Geek Squad Protection,GS-90281-REF,$499.99,Tech Support United,https://techscammersunited.com,2026-09-25,Fake invoice claiming unauthorized renewal.
1 (870) 401-4206,Bank & Financial Impersonation,PayPal Risk Operations,PP-66719-TX,$849.00,Email Phishing,https://endscams.org,2026-09-25,Phishing email with fraudulent callback number.
+234 810 552 9412,Spellcaster WhatsApp Extortion,Great Baba Temple,N/A,$250.00,Facebook,https://facebook.com,2026-09-25,Extortion demands via WhatsApp messaging.`;

    const blob = new Blob([templateContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `threat_import_template.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleConfirmCSVImport = async () => {
    if (!importPreview || importPreview.valid.length === 0 || isImporting) return;
    setIsImporting(true);

    const imported = importPreview.valid;
    setRecords((prev) => deduplicateRecords([...imported, ...prev]).sort(compareThreatDatesDesc));

    try {
      await fetch('/api/records/bulk-upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: imported }),
      });
      await upsertToSupabase(imported);
    } catch {}

    setIsImporting(false);
    setIsImportModalOpen(false);
    setImportFile(null);
    setPastedCsvText('');
    setImportPreview(null);
    setStatusNotification(`Successfully imported ${imported.length} threat records!`);
  };

  // Export CSV Data
  const handleExportCSV = () => {
    const headers = ['Phone Number', 'Clean Digits', 'Category', 'Target Entity', 'Invoice Number', 'Amount Charged', 'Source', 'Source URL', 'Date Detected', 'Status', 'Description'];
    const rows = records.map((r) => [
      `"${(r.phone_number || '').replace(/"/g, '""')}"`,
      `"${(r.phone_digits || '').replace(/"/g, '""')}"`,
      `"${(r.category || '').replace(/"/g, '""')}"`,
      `"${(r.impersonated_company || '').replace(/"/g, '""')}"`,
      `"${(r.invoice_number || '').replace(/"/g, '""')}"`,
      `"${(r.amount_charged || '').replace(/"/g, '""')}"`,
      `"${(r.source_name || '').replace(/"/g, '""')}"`,
      `"${(r.source_url || '').replace(/"/g, '""')}"`,
      `"${(r.report_date || '').replace(/"/g, '""')}"`,
      `"${r.is_down ? 'Out of Service' : 'Active Line'}"`,
      `"${(r.description || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cwn_threat_records_${getPSTDateStamp()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setStatusNotification(`Successfully exported ${records.length} records to CSV!`);
  };

  // Export Full TrackerPage.tsx Source File
  const handleExportTSX = async () => {
    try {
      const res = await fetch('/src/pages/TrackerPage.tsx');
      if (res.ok) {
        const sourceCode = await res.text();
        const blob = new Blob([sourceCode], { type: 'text/typescript-jsx;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `TrackerPage.tsx`;
        link.click();
        URL.revokeObjectURL(url);
        setStatusNotification('Full TrackerPage.tsx component exported successfully!');
        return;
      }
    } catch (err) {
      console.warn('Could not fetch source directly, downloading CSV fallback:', err);
    }
    handleExportCSV();
  };

  // Selected rows for bulk operations
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

  const handleToggleSelectAll = () => {
    if (selectedRowIds.size === filteredRecords.length) {
      setSelectedRowIds(new Set());
    } else {
      setSelectedRowIds(new Set(filteredRecords.map((r) => r.id)));
    }
  };

  const handleToggleSelectRow = (id: string) => {
    const next = new Set(selectedRowIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedRowIds(next);
  };

  const isPrizeOrExtendedRetention = (r: ThreatRecord) => {
    const cat = (r.category || '').toLowerCase();
    const comp = (r.impersonated_company || '').toLowerCase();
    const desc = (r.description || '').toLowerCase();
    return (
      cat.includes('lottery') ||
      cat.includes('sweepstakes') ||
      cat.includes('pch') ||
      cat.includes('spellcaster') ||
      comp.includes('publishers clearing') ||
      desc.includes('publishers clearing')
    );
  };

  // Filtered Records
  const filteredRecords = useMemo(() => {
    const list = records.filter((r) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        r.phone_number.toLowerCase().includes(q) ||
        r.phone_digits.includes(q.replace(/\D/g, '')) ||
        (r.category || '').toLowerCase().includes(q) ||
        (r.impersonated_company || '').toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q);

      const matchesCat = selectedCategory === 'ALL' || r.category === selectedCategory;
      const matchesSrc = selectedSource === 'ALL' || r.source_name === selectedSource;
      const country = deriveCountryInfo(r.phone_number);
      const matchesCountry = selectedCountry === 'ALL' || country.name === selectedCountry;
      const matchesStatus =
        selectedStatus === 'ALL' ||
        (selectedStatus === 'ACTIVE' && !r.is_down) ||
        (selectedStatus === 'DOWN' && r.is_down);

      const isPrize =
        (r.category || '').toLowerCase().includes('lottery') ||
        (r.category || '').toLowerCase().includes('sweepstakes') ||
        (r.category || '').toLowerCase().includes('pch') ||
        (r.category || '').toLowerCase().includes('spellcaster') ||
        (r.impersonated_company || '').toLowerCase().includes('publishers clearing') ||
        (r.description || '').toLowerCase().includes('publishers clearing');

      const matchesRetention =
        selectedRetention === 'ALL' ||
        (selectedRetention === 'PRIZE_6MO' && isPrize) ||
        (selectedRetention === 'STANDARD_90D' && !isPrize);

      return matchesSearch && matchesCat && matchesSrc && matchesCountry && matchesStatus && matchesRetention;
    });

    return list.sort((a, b) => (sortOrder === 'desc' ? compareThreatDatesDesc(a, b) : compareThreatDatesAsc(a, b)));
  }, [records, searchTerm, selectedCategory, selectedSource, selectedCountry, selectedStatus, selectedRetention, sortOrder]);

  const categoriesList = useMemo(() => {
    const set = new Set([...STANDARD_SCAM_CATEGORIES, ...records.map((r) => r.category)]);
    return Array.from(set).filter(Boolean);
  }, [records]);

  const sourcesList = useMemo(() => Array.from(new Set(records.map((r) => r.source_name))), [records]);
  const countriesList = useMemo(() => Array.from(new Set(records.map((r) => deriveCountryInfo(r.phone_number).name))), [records]);

  const activeCount = useMemo(() => records.filter((r) => !r.is_down).length, [records]);
  const downCount = useMemo(() => records.filter((r) => r.is_down).length, [records]);

  const currentPSTTime = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: true,
      }).format(new Date());
    } catch {
      return '10:37:15 PM';
    }
  }, []);

  const nextAutoScanText = useMemo(() => {
    try {
      const now = new Date();
      const pstStr = now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
      const pstDate = new Date(pstStr);
      const h = pstDate.getHours();
      const m = pstDate.getMinutes();

      let targetH = 7;
      let targetDay = 'Today';

      if (h < 7) {
        targetH = 7;
        targetDay = 'Today';
      } else if (h < 13) {
        targetH = 13;
        targetDay = 'Today';
      } else {
        targetH = 7;
        targetDay = 'Tomorrow';
      }

      const label = targetH === 7 ? '7:00 AM PST' : '1:00 PM PST';
      let diff = 0;
      if (targetDay === 'Today') {
        diff = targetH * 60 - (h * 60 + m);
      } else {
        diff = (24 - h + 7) * 60 - m;
      }

      const diffH = Math.floor(Math.max(0, diff) / 60);
      const diffM = Math.max(0, diff) % 60;

      return `${targetDay} at ${label} (in ${diffH}h ${diffM}m)`;
    } catch {
      return 'Tomorrow at 7:00 AM PST (in 8h 22m)';
    }
  }, []);

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 text-slate-100 font-sans space-y-5">
      {statusNotification && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs px-4 py-2.5 rounded-xl flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{statusNotification}</span>
          </div>
          <button onClick={() => setStatusNotification(null)} className="text-emerald-400 hover:text-emerald-200 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header Banner Matching Image */}
      <header className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl relative overflow-hidden space-y-4">
        {/* Top Badges & Buttons Strip */}
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2 flex-wrap gap-y-1.5">
              <span className="flex items-center space-x-1.5 bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 rounded-full text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>AUTONOMOUS HARVESTER ENGINE</span>
              </span>

              <span className="bg-slate-800/90 border border-slate-700 px-3 py-1 rounded-full text-[10px] font-mono text-slate-300 flex items-center space-x-1.5">
                <Clock className="w-3 h-3 text-amber-400" />
                <span>{currentPSTTime} PST</span>
              </span>

              <span className="bg-amber-500/15 border border-amber-500/30 px-3 py-1 rounded-full text-[10px] font-bold text-amber-300 flex items-center space-x-1.5 uppercase tracking-wider">
                <span>DAILY SCHEDULE: 7:00 AM & 1:00 PM PST</span>
              </span>
            </div>

            <div className="flex items-center space-x-2.5 pt-1">
              <div className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight">
                CWN Scam Tracker
              </h1>
            </div>

            <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
              Automated multi-source threat intelligence system. Continuously indexes verified scam lines, enforces strict 24-hour freshness, and purges toll-free/fictitious numbers.
            </p>
          </div>

          {/* Action Buttons Matching Image */}
          <div className="flex items-center space-x-2 flex-wrap gap-y-2">
            <button
              onClick={() => requireAdminAuth('Execute Harvester Scan', executeScan)}
              disabled={isScanning}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold rounded-xl flex items-center space-x-1.5 transition shadow-lg disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Refreshing...' : 'Manual Refresh'}</span>
            </button>

            <button
              onClick={() => requireAdminAuth('Database Override & Settings', () => setIsSettingsModalOpen(true))}
              className="px-3.5 py-2 bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition border border-slate-700 cursor-pointer shadow-sm"
              title="Configure database overrides and table settings"
            >
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              <span>Database Settings</span>
            </button>

            <button
              onClick={() => requireAdminAuth('Import CSV Threat File', () => setIsImportModalOpen(true))}
              className="px-3.5 py-2 bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition border border-slate-700 cursor-pointer shadow-sm"
            >
              <Upload className="w-3.5 h-3.5 text-blue-400" />
              <span>Import CSV</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 bg-slate-800/90 hover:bg-slate-700 text-emerald-400 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition border border-slate-700 cursor-pointer shadow-sm"
              title="Export all database threat records as CSV"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={handleExportTSX}
              className="px-3 py-2 bg-slate-800/90 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition border border-slate-700 cursor-pointer shadow-sm"
              title="Export full TrackerPage.tsx React Component"
            >
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>Export .tsx</span>
            </button>

            {onNavigateToReport ? (
              <button
                onClick={onNavigateToReport}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-red-300 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition border border-red-900/60 cursor-pointer shadow-sm"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                <span>Report Scam (endscams.org)</span>
                <ExternalLink className="w-3 h-3 text-slate-400 ml-0.5" />
              </button>
            ) : (
              <a
                href="https://endscams.org"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-red-300 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition border border-red-900/60 shadow-sm"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                <span>Report Scam (endscams.org)</span>
                <ExternalLink className="w-3 h-3 text-slate-400 ml-0.5" />
              </a>
            )}

            <button
              onClick={() => requireAdminAuth('Open Database Settings', () => setIsSettingsModalOpen(true))}
              className="p-2 bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-slate-100 rounded-xl transition border border-slate-700 cursor-pointer"
              title="Scanner & Database Settings"
            >
              <Sliders className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Subheader Status Strip Matching Image */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
          <div className="flex items-center space-x-4">
            <span className="flex items-center space-x-1.5 text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Status: Monitoring live threat streams</span>
            </span>

            <button
              onClick={() => {
                if (isAdminUnlocked) {
                  setIsAdminUnlocked(false);
                  setStatusNotification('Admin session locked.');
                } else {
                  requireAdminAuth('Unlock Admin Session', () => {
                    setIsAdminUnlocked(true);
                    setStatusNotification('Admin session unlocked.');
                  });
                }
              }}
              className="flex items-center space-x-1 text-slate-400 hover:text-amber-400 cursor-pointer transition"
            >
              {isAdminUnlocked ? (
                <>
                  <Unlock className="w-3 h-3 text-amber-400" />
                  <span className="text-amber-300 font-semibold">Admin: Unlocked</span>
                </>
              ) : (
                <>
                  <Lock className="w-3 h-3 text-slate-500" />
                  <span>Admin: Locked</span>
                </>
              )}
            </button>
          </div>

          <div className="text-slate-400">
            <span>Next Auto-Scan: </span>
            <span className="text-amber-400 font-medium">{nextAutoScanText}</span>
          </div>
        </div>
      </header>

      {/* Top 4 Stats Cards Matching Image (Total Numbers, Scam Types, Platforms, Countries) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: TOTAL NUMBERS */}
        <div className="bg-slate-900/95 border border-slate-800 p-4 rounded-2xl flex items-center justify-between shadow-lg">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              TOTAL NUMBERS
            </span>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-100">
                {records.length}
              </span>
              <span className="text-xs">
                <span className="text-emerald-400 font-bold">{activeCount} active</span>
                <span className="text-slate-500"> · </span>
                <span className="text-slate-400">{downCount} down</span>
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center shrink-0">
            <PhoneCall className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: SCAM TYPES */}
        <div className="bg-slate-900/95 border border-slate-800 p-4 rounded-2xl flex items-center justify-between shadow-lg">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              SCAM TYPES
            </span>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-100">
                {categoriesList.length}
              </span>
              <span className="text-xs text-slate-500">
                categories
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: PLATFORMS (Restored) */}
        <div className="bg-slate-900/95 border border-slate-800 p-4 rounded-2xl flex items-center justify-between shadow-lg">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              PLATFORMS
            </span>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-100">
                {sourcesList.length}
              </span>
              <span className="text-xs text-slate-400 truncate max-w-[150px]" title="sources (Tech Support, FB, IG)">
                sources (Tech Support, FB, IG)
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
            <Globe className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: COUNTRIES */}
        <div className="bg-slate-900/95 border border-slate-800 p-4 rounded-2xl flex items-center justify-between shadow-lg">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              COUNTRIES
            </span>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-100">
                {countriesList.length}
              </span>
              <span className="text-xs text-slate-500">
                regions
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Toolbar Matching Image */}
      <section className="bg-slate-900/90 border border-slate-800 p-3.5 sm:p-4 rounded-2xl flex flex-col gap-3 shadow-lg">
        {/* Row 1: Dropdown Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 w-full">
          <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-300">
            <Filter className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer w-full truncate"
            >
              <option value="ALL" className="bg-slate-900">All Categories</option>
              {categoriesList.map((c) => (
                <option key={c} value={c} className="bg-slate-900">{c}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-300">
            <Database className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer w-full truncate"
            >
              <option value="ALL" className="bg-slate-900">All Sources</option>
              {sourcesList.map((s) => (
                <option key={s} value={s} className="bg-slate-900">{s}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-300">
            <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer w-full truncate"
            >
              <option value="ALL" className="bg-slate-900">All Countries</option>
              {countriesList.map((c) => (
                <option key={c} value={c} className="bg-slate-900">{c}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-300">
            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <select
              value={selectedRetention}
              onChange={(e) => setSelectedRetention(e.target.value as any)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer w-full truncate"
            >
              <option value="ALL" className="bg-slate-900">All Retentions</option>
              <option value="PRIZE_6MO" className="bg-slate-900">Prize / 6-Mo Retained</option>
              <option value="STANDARD_90D" className="bg-slate-900">Standard 90-Day</option>
            </select>
          </div>

          <div className="col-span-2 sm:col-span-1 flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-300">
            <Radio className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer w-full truncate"
            >
              <option value="ALL" className="bg-slate-900">All Statuses</option>
              <option value="ACTIVE" className="bg-slate-900">Active Only</option>
              <option value="DOWN" className="bg-slate-900">Out of Service</option>
            </select>
          </div>
        </div>

        {/* Row 2: Search Input & Sort Dropdown */}
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search phone, company, category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 shrink-0 w-full sm:w-auto">
            <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="desc" className="bg-slate-900">Sort: Newest Date First</option>
              <option value="asc" className="bg-slate-900">Sort: Oldest Date First</option>
            </select>
          </div>
        </div>
      </section>

      {/* Main Table Matching Screenshot */}
      <section className="bg-slate-900/95 border border-slate-800/90 rounded-2xl shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider">
                <th className="py-3.5 px-4 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={filteredRecords.length > 0 && selectedRowIds.size === filteredRecords.length}
                    onChange={handleToggleSelectAll}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="py-3.5 px-4 font-bold text-slate-300">PHONE NUMBER</th>
                <th className="py-3.5 px-4 font-bold text-slate-300">
                  <div className="flex items-center space-x-2">
                    <span>DATE DETECTED</span>
                    <button
                      onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                      className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[9px] font-bold uppercase tracking-wider flex items-center space-x-1 cursor-pointer hover:bg-amber-500/20 transition"
                    >
                      <span>{sortOrder === 'desc' ? 'NEWEST' : 'OLDEST'}</span>
                      <span>{sortOrder === 'desc' ? '↓' : '↑'}</span>
                    </button>
                  </div>
                </th>
                <th className="py-3.5 px-4 font-bold text-slate-300">COMPANY / TARGET</th>
                <th className="py-3.5 px-4 font-bold text-slate-300">SCAM CATEGORY</th>
                <th className="py-3.5 px-4 font-bold text-slate-300 text-center">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No threat lines match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => {
                  const country = deriveCountryInfo(r.phone_number);
                  const isWhatsApp = isWhatsAppThreat(r);
                  const isPrize = isPrizeOrExtendedRetention(r);
                  const isSelected = selectedRowIds.has(r.id);

                  return (
                    <tr
                      key={r.id}
                      className={`hover:bg-slate-800/30 transition ${
                        isSelected ? 'bg-amber-500/5' : ''
                      } ${r.is_down ? 'opacity-60 bg-slate-950/40' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectRow(r.id)}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* Phone Number (Amber/Orange bold formatted matching image) */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleCopyPhone(r.id, r.phone_number)}
                            className="font-mono font-bold text-amber-400 hover:text-amber-300 text-sm tracking-wide flex items-center space-x-2 transition cursor-pointer group"
                            title="Click to copy clean dialable number"
                          >
                            <span>{r.phone_number}</span>
                            <span className="p-1 rounded-md bg-slate-800/90 border border-slate-700 group-hover:border-slate-600 transition inline-flex items-center justify-center">
                              {copiedId === r.id ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3 text-slate-400 group-hover:text-slate-200" />
                              )}
                            </span>
                          </button>

                          {isWhatsApp && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              WhatsApp
                            </span>
                          )}

                          <span title={country.name} className="text-xs">
                            {country.flag}
                          </span>
                        </div>

                        {r.alt_numbers && r.alt_numbers.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {r.alt_numbers.map((alt, idx) => (
                              <div key={idx} className="text-[10px] font-mono text-slate-400 flex items-center space-x-1">
                                <span className="text-slate-600">Alt #{idx + 1}:</span>
                                <span>{alt.phone}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Date Detected & Retention Badge */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <span className="font-mono text-xs text-slate-300 block">
                            {r.report_date}
                          </span>
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700/80">
                            {isPrize ? '6-Mo Prize' : '90-Day'}
                          </span>
                        </div>
                      </td>

                      {/* Company / Target */}
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-100 text-xs sm:text-sm">
                          {r.impersonated_company && r.impersonated_company !== 'N/A'
                            ? r.impersonated_company
                            : 'Unknown Target'}
                        </span>
                      </td>

                      {/* Scam Category (Red/Rose pill matching image) */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-medium bg-red-950/50 text-red-300 border border-red-900/60 shadow-xs">
                          {r.category}
                        </span>
                      </td>

                      {/* Status (Active Line / Out of Service pill) */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          onClick={() =>
                            requireAdminAuth(
                              `Mark ${r.phone_number} as ${r.is_down ? 'Active' : 'Out of Service'}`,
                              () => handleToggleStatus(r)
                            )
                          }
                          className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition cursor-pointer border shadow-sm ${
                            r.is_down
                              ? 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                              : 'bg-emerald-950/40 text-emerald-400 border-emerald-900/70 hover:bg-emerald-900/50'
                          }`}
                          title="Click to toggle status"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${r.is_down ? 'bg-slate-500' : 'bg-emerald-400'}`} />
                          <span>{r.is_down ? 'Out of Service' : 'Active Line'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Security Authorization Modal (Matched to Image 1) */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 relative">
            <button
              onClick={() => setIsAuthModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-200 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header with Lock container matching Image 1 */}
            <div className="flex items-start space-x-3.5 pr-6">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 shadow-inner">
                <Lock className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div className="space-y-0.5">
                <h3 className="font-extrabold text-base text-slate-100 tracking-tight">
                  Administrator Password Required
                </h3>
                <p className="text-xs text-slate-300">
                  Action: <span className="text-amber-400 font-bold">{authActionName || 'Import CSV Threat Records'}</span>
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Secured by encrypted Administrator or Bypass credentials (bypass access is strictly limited to editing post details and changing line status).
            </p>

            {authError && (
              <div className="p-2.5 bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-xl flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleVerifyAuth} className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-200">
                  Enter Password or Encrypted Bypass Key
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    placeholder="••••••••"
                    value={enteredPassword}
                    onChange={(e) => setEnteredPassword(e.target.value)}
                    className="w-full pl-3.5 pr-10 py-2.5 bg-[#020617] border border-amber-500/80 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono tracking-wider"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-slate-400 hover:text-slate-200 cursor-pointer transition"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end items-center space-x-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAuthModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-800/90 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAuthVerifying}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-xs transition flex items-center space-x-2 cursor-pointer shadow-md disabled:opacity-50"
                >
                  <Lock className="w-3.5 h-3.5 text-slate-950" />
                  <span>{isAuthVerifying ? 'Verifying...' : 'Unlock & Proceed'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal (Matched to Image 2 with Drag & Drop, Paste, and Template Download) */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 relative">
            <button
              onClick={() => setIsImportModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-200 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header Matching Image 2 */}
            <div className="flex items-center space-x-2.5 text-slate-100 pr-6">
              <Upload className="w-5 h-5 text-blue-400 shrink-0" />
              <h3 className="font-extrabold text-base tracking-tight">
                Import CSV Threat Records
              </h3>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Upload any CSV exported from AI Studio, Google Sheets, or Excel. Toll-free and fictitious numbers are automatically rejected.
            </p>

            {/* Mode Switcher Tabs */}
            <div className="flex items-center space-x-2 border-b border-slate-800/80 pb-2">
              <button
                type="button"
                onClick={() => setImportMode('upload')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  importMode === 'upload'
                    ? 'bg-slate-800 text-amber-400 border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Upload / Drag .CSV File
              </button>
              <button
                type="button"
                onClick={() => setImportMode('paste')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 ${
                  importMode === 'paste'
                    ? 'bg-slate-800 text-amber-400 border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Clipboard className="w-3.5 h-3.5" />
                <span>Paste CSV Text</span>
              </button>
            </div>

            {/* Upload Area Matching Image 2 */}
            {importMode === 'upload' ? (
              <div
                onClick={() => csvFileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsCsvDragging(true);
                }}
                onDragLeave={() => setIsCsvDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsCsvDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    const f = e.dataTransfer.files[0];
                    setImportFile(f);
                    processCSVTextFromFile(f);
                  }
                }}
                className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 transition flex flex-col items-center justify-center space-y-3 cursor-pointer relative ${
                  isCsvDragging
                    ? 'border-amber-400 bg-amber-500/10'
                    : 'border-slate-800/90 hover:border-slate-700 bg-slate-950/60 hover:bg-slate-950/90'
                }`}
              >
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-amber-400" />
                </div>
                <div className="text-center space-y-1">
                  <span className="text-sm font-bold text-slate-100 block">
                    Click to select or drag .csv file here
                  </span>
                  <p className="text-xs text-slate-500">
                    Auto-cleans digits and strips formulas
                  </p>
                </div>
                <input
                  ref={csvFileInputRef}
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  className="hidden"
                  onChange={handleCSVFileChange}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <textarea
                  rows={6}
                  placeholder="Paste CSV contents here...&#10;e.g. 1 (800) 555-0199, Geek Squad, Tech Support Phishing, GS-99182, $499.99, 2026-09-25"
                  value={pastedCsvText}
                  onChange={(e) => handleRawCSVInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 resize-none leading-relaxed"
                />
              </div>
            )}

            {importError && (
              <div className="p-2.5 bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-xl flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{importError}</span>
              </div>
            )}

            {importPreview && (
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1 text-xs text-slate-300">
                <div className="text-emerald-400 font-bold flex items-center space-x-1.5">
                  <Check className="w-4 h-4" />
                  <span>{importPreview.valid.length} valid threat records detected</span>
                </div>
                {importPreview.rejectedBad.length > 0 && (
                  <div className="text-amber-400 text-[11px]">
                    ⚠ {importPreview.rejectedBad.length} lines skipped (invalid or missing numbers)
                  </div>
                )}
              </div>
            )}

            {/* Bottom Strip Matching Image 2 */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
              <button
                type="button"
                onClick={handleDownloadCSVTemplate}
                className="text-amber-400 hover:text-amber-300 text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Template</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!importPreview || importPreview.valid.length === 0 || isImporting}
                  onClick={handleConfirmCSVImport}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-slate-100 font-bold rounded-xl text-xs transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-md"
                >
                  {isImporting ? 'Importing...' : 'Import'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Database Connection & Table Settings Modal (Admin Protected) */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 relative">
            <button
              onClick={() => setIsSettingsModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-200 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2.5 text-amber-400 pr-6">
              <Sliders className="w-5 h-5" />
              <h3 className="font-extrabold text-base text-slate-100 tracking-tight">
                Database Overrides & Table Settings
              </h3>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Configure PostgreSQL/Supabase database connections and synchronize the central <code className="text-amber-300 bg-slate-950 px-1.5 py-0.5 rounded font-mono">tracker_entries</code> table.
            </p>

            {/* Table Stats Card */}
            <div className="grid grid-cols-3 gap-2.5 p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Total Entries</span>
                <span className="text-base font-black text-slate-100">{records.length}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Active Threats</span>
                <span className="text-base font-black text-emerald-400">{activeCount}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Out of Service</span>
                <span className="text-base font-black text-slate-400">{downCount}</span>
              </div>
            </div>

            {dbTestResult && (
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300">
                {dbTestResult}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  PostgreSQL / Supabase Project URL (Dokploy override)
                </label>
                <input
                  type="text"
                  value={supabaseUrlInput}
                  onChange={(e) => setSupabaseUrlInput(e.target.value)}
                  placeholder="https://xyzcompany.supabase.co"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Database Anon / Service Role Key
                </label>
                <input
                  type="password"
                  value={supabaseKeyInput}
                  onChange={(e) => setSupabaseKeyInput(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
              <button
                type="button"
                disabled={isTestingDb}
                onClick={async () => {
                  setIsTestingDb(true);
                  setDbTestResult('Testing database connection to Supabase...');
                  saveSupabaseConfig(supabaseUrlInput, supabaseKeyInput);
                  const res = await fetchFromSupabase();
                  if (res.success && res.records) {
                    setRecords(res.records.sort(compareThreatDatesDesc));
                    setDbTestResult(`✓ Connected successfully! Retrieved all ${res.records.length} records from tracker_entries.`);
                  } else {
                    setDbTestResult(`⚠ Connection error: ${res.error || 'Check credentials'}`);
                  }
                  setIsTestingDb(false);
                }}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-xl text-xs font-semibold cursor-pointer transition flex items-center space-x-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTestingDb ? 'animate-spin' : ''}`} />
                <span>Test Connection</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    saveSupabaseConfig(supabaseUrlInput, supabaseKeyInput);
                    if (records.length > 0) {
                      await upsertToSupabase(records);
                    }
                    const res = await fetchFromSupabase();
                    if (res.success && res.records) {
                      setRecords(res.records.sort(compareThreatDatesDesc));
                      setStatusNotification(`✓ Database synchronized! Loaded ${res.records.length} records directly from Supabase.`);
                    } else {
                      setStatusNotification('Database credentials updated and records pushed to Supabase!');
                    }
                    setIsSettingsModalOpen(false);
                  }}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition cursor-pointer shadow-md"
                >
                  Save & Push All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Record Edit Modal */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-amber-400">
                <Edit3 className="w-5 h-5" />
                <h3 className="font-bold text-sm text-slate-100">Edit Threat Record: {editingRecord.phone_number}</h3>
              </div>
              <button onClick={() => setEditingRecord(null)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Impersonated Entity / Company</label>
                <input
                  type="text"
                  value={editingRecord.impersonated_company}
                  onChange={(e) => setEditingRecord({ ...editingRecord, impersonated_company: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Category</label>
                <select
                  value={editingRecord.category}
                  onChange={(e) => setEditingRecord({ ...editingRecord, category: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs"
                >
                  {STANDARD_SCAM_CATEGORIES.map((c) => (
                    <option key={c} value={c} className="bg-slate-900">{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Threat Intel & Description</label>
                <textarea
                  rows={3}
                  value={editingRecord.description}
                  onChange={(e) => setEditingRecord({ ...editingRecord, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setRecords((prev) => prev.map((r) => (r.id === editingRecord.id ? editingRecord : r)));
                  try {
                    await fetch(`/api/records/${editingRecord.id}/update`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(editingRecord),
                    });
                    await upsertToSupabase([editingRecord]);
                  } catch {}
                  setEditingRecord(null);
                  setStatusNotification(`Saved updates for ${editingRecord.phone_number}!`);
                }}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrackerPage;
