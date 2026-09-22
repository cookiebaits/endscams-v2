import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Shield,
  Search,
  RefreshCw,
  Download,
  Upload,
  Plus,
  ExternalLink,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  Filter,
  Database,
  X,
  Radio,
  Clock,
  Globe,
  PhoneCall,
  ShieldAlert,
  Calendar,
  Sliders,
  Play,
  Key,
  Trash2,
  ArrowDown,
  ArrowUp,
  Lock,
  Unlock,
  Edit3,
  Save,
  Eye,
  EyeOff,
  Info,
} from 'lucide-react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getPSTDateStamp } from '../utils/dateUtils';
import { parseFullCSV } from '../utils/csvHandler';
import { syncBridge } from '../utils/syncBridge';
import { getCleanCopyPhone } from '../utils/phoneUtils';
import { resolveTargetCompany } from '../utils/targetUtils';
import { ScamPhoneRecord } from '../types';
import {
  verifyEncryptedAdmin,
  verifyEncryptedBypass,
  isBypassAllowedForAction,
  checkClientGeoPermission,
} from '../utils/security';

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
  invoice_number?: string;
  amount_charged?: string;
  is_down?: boolean;
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
  if (
    digits.startsWith('234') ||
    digits.startsWith('254') ||
    digits.startsWith('27') ||
    digits.startsWith('233') ||
    digits.startsWith('260') ||
    digits.startsWith('256') ||
    digits.startsWith('237') ||
    digits.startsWith('229') ||
    digits.startsWith('263')
  ) {
    return true;
  }
  return false;
}

export interface ScanTargetConfig {
  id: string;
  name: string;
  platform: string;
  category: string;
  searchDomain: string;
  targetQuery: string;
  requiresAfricanNumbers: boolean;
  rejectTollFree: boolean;
  rejectFictitious: boolean;
  timeConstraintHours: number;
}

// Configured targets for Facebook, Instagram, and Google Search Parameters
export const SCAN_TARGETS: ScanTargetConfig[] = [
  {
    id: 'fb-spellcaster',
    name: 'Facebook: Spellcaster Scams',
    platform: 'Facebook',
    category: 'Spellcaster WhatsApp Extortion',
    searchDomain: 'facebook.com',
    targetQuery: 'site:facebook.com ("bring back lost lover" OR "love spell" OR "money spell") ("whatsapp" OR "call me") -inurl:help',
    requiresAfricanNumbers: true,
    rejectTollFree: true,
    rejectFictitious: true,
    timeConstraintHours: 24,
  },
  {
    id: 'fb-btc-recovery',
    name: 'Facebook: BTC & Crypto Recovery Scams',
    platform: 'Facebook',
    category: 'Crypto BTC Recovery Scam',
    searchDomain: 'facebook.com',
    targetQuery: 'site:facebook.com ("crypto recovery" OR "recover lost btc" OR "blockchain refund") ("whatsapp" OR "+234" OR "+27") -inurl:help',
    requiresAfricanNumbers: true,
    rejectTollFree: true,
    rejectFictitious: true,
    timeConstraintHours: 24,
  },
  {
    id: 'ig-spellcaster',
    name: 'Instagram: Spiritualist & Spellcaster Scams',
    platform: 'Instagram',
    category: 'Spellcaster WhatsApp Extortion',
    searchDomain: 'instagram.com',
    targetQuery: 'site:instagram.com "spellcaster" ("Whatsapp" OR "call")',
    requiresAfricanNumbers: true,
    rejectTollFree: true,
    rejectFictitious: true,
    timeConstraintHours: 24,
  },
  {
    id: 'ig-btc-recovery',
    name: 'Instagram: Crypto Recovery Scams',
    platform: 'Instagram',
    category: 'Crypto BTC Recovery Scam',
    searchDomain: 'instagram.com',
    targetQuery: 'site:instagram.com ("btc recovery" OR "crypto retrieval") "Whatsapp"',
    requiresAfricanNumbers: true,
    rejectTollFree: true,
    rejectFictitious: true,
    timeConstraintHours: 24,
  },
  {
    id: 'ig-stake-giveaway',
    name: 'Instagram: Social Media Prize & Sweepstakes',
    platform: 'Instagram',
    category: 'Social Media Prize & Giveaway Scam',
    searchDomain: 'instagram.com',
    targetQuery: 'site:instagram.com ("stake.us" OR "giveaway prize" OR "lottery winner") "Whatsapp"',
    requiresAfricanNumbers: true,
    rejectTollFree: true,
    rejectFictitious: true,
    timeConstraintHours: 24,
  },
  {
    id: 'google-guestbook',
    name: 'Google Search: Guestbook Comment Scams',
    platform: 'Google Search',
    category: 'Spellcaster WhatsApp Extortion',
    searchDomain: 'google.com',
    targetQuery: 'inurl:"guestbook" ("spell" OR "traditional healer") ("whatsapp" OR "+234" OR "+254")',
    requiresAfricanNumbers: true,
    rejectTollFree: true,
    rejectFictitious: true,
    timeConstraintHours: 24,
  },
  {
    id: 'google-tech-support',
    name: 'Google Search: Fake Support & Invoices',
    platform: 'Google Search',
    category: 'General Tech Support & Refund Scams',
    searchDomain: 'google.com',
    targetQuery: 'intext:"Geek Squad invoice" OR intext:"Norton cancellation" OR intext:"PayPal refund desk" "call" -site:microsoft.com',
    requiresAfricanNumbers: false,
    rejectTollFree: false,
    rejectFictitious: true,
    timeConstraintHours: 24,
  },
];

export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function isFictitiousOrInvalidPhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return true;
  const clean = phone.replace(/[^0-9+]/g, '');
  const digits = clean.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return true;
  if (digits.includes('555')) return true;

  const usLocal = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (usLocal.length === 10) {
    const areaCode = usLocal.slice(0, 3);
    const exchange = usLocal.slice(3, 6);
    if (areaCode.startsWith('0') || areaCode.startsWith('1')) return true;
    if (exchange.startsWith('0') || exchange.startsWith('1')) return true;
  }
  if (/(\d)\1{4,}/.test(digits)) return true;
  return false;
}

export function deriveCountryInfo(phone: string): { code: string; name: string; isAfrican: boolean; allowed: boolean } {
  if (!phone || isFictitiousOrInvalidPhone(phone)) {
    return { code: 'GLOBAL', name: 'International', isAfrican: false, allowed: false };
  }
  const digits = phone.replace(/\D/g, '');
  const africanPrefixes: Record<string, { code: string; name: string }> = {
    '234': { code: 'NG', name: 'Nigeria' },
    '254': { code: 'KE', name: 'Kenya' },
    '233': { code: 'GH', name: 'Ghana' },
    '27': { code: 'ZA', name: 'South Africa' },
    '260': { code: 'ZM', name: 'Zambia' },
    '256': { code: 'UG', name: 'Uganda' },
  };

  for (const [prefix, info] of Object.entries(africanPrefixes)) {
    if (digits.startsWith(prefix)) {
      return { code: info.code, name: info.name, isAfrican: true, allowed: true };
    }
  }

  if (digits.length === 10 || (digits.length === 11 && digits.startsWith('1'))) {
    return { code: 'US', name: 'United States', isAfrican: false, allowed: true };
  }
  return { code: 'GLOBAL', name: 'International', isAfrican: false, allowed: true };
}

export function formatDisplayPhone(rawPhone: string, cleanDigits: string): string {
  const cleaned = rawPhone.replace(/^=\+?/, '').replace(/^"/, '').replace(/"$/, '').trim();
  if (cleanDigits.length === 10) {
    return `1 (${cleanDigits.slice(0, 3)}) ${cleanDigits.slice(3, 6)}-${cleanDigits.slice(6)}`;
  }
  if (cleanDigits.length === 11 && cleanDigits.startsWith('1')) {
    return `1 (${cleanDigits.slice(1, 4)}) ${cleanDigits.slice(4, 7)}-${cleanDigits.slice(7)}`;
  }
  if (cleanDigits.startsWith('234') && cleanDigits.length === 13) {
    return `+234 ${cleanDigits.slice(3, 6)} ${cleanDigits.slice(6, 9)} ${cleanDigits.slice(9)}`;
  }
  return cleaned.startsWith('+') ? cleaned : `+${cleanDigits}`;
}

export function normalizeToNumericalDate(dateInput?: string | number | Date | null): string {
  if (!dateInput) return getPSTDateStamp();
  if (dateInput instanceof Date) return isNaN(dateInput.getTime()) ? getPSTDateStamp() : getPSTDateStamp(dateInput);
  const str = String(dateInput).trim().replace(/^["']+|["']+$/g, '').replace(/^=/, '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const parsed = new Date(str);
  return !isNaN(parsed.getTime()) ? getPSTDateStamp(parsed) : getPSTDateStamp();
}

export function compareThreatDatesDesc(a: Partial<ThreatRecord>, b: Partial<ThreatRecord>): number {
  const dateA = normalizeToNumericalDate(a.report_date);
  const dateB = normalizeToNumericalDate(b.report_date);
  const timeA = new Date(`${dateA}T12:00:00.000Z`).getTime();
  const timeB = new Date(`${dateB}T12:00:00.000Z`).getTime();
  if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) return timeB - timeA;
  return (b.id || '').localeCompare(a.id || '');
}

export function getPacificParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: parseInt(get('hour'), 10),
    minute: parseInt(get('minute'), 10),
    second: parseInt(get('second'), 10),
    dateStr: `${get('year')}-${get('month')}-${get('day')}`,
  };
}

export function formatPSTTimeOnly(date = new Date()): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(date) + ' PST';
}

export function getNextScheduledPSTInfo(): { label: string; countdown: string } {
  const { hour, minute, second } = getPacificParts();
  let targetHour = 7;
  let isTomorrow = false;
  if (hour < 7) {
    targetHour = 7;
  } else if (hour < 13) {
    targetHour = 13;
  } else {
    targetHour = 7;
    isTomorrow = true;
  }

  const currentSec = hour * 3600 + minute * 60 + second;
  let targetSec = targetHour * 3600;
  if (isTomorrow) targetSec += 24 * 3600;
  const diffSec = targetSec - currentSec;
  const diffHours = Math.floor(diffSec / 3600);
  const diffMins = Math.floor((diffSec % 3600) / 60);

  const label = isTomorrow ? 'Tomorrow at 7:00 AM PST' : targetHour === 7 ? 'Today at 7:00 AM PST' : 'Today at 1:00 PM PST';
  return { label, countdown: `in ${diffHours}h ${diffMins}m` };
}

export function TrackerPage() {
  // Pure in-memory state: NO localStorage caching
  const [records, setRecords] = useState<ThreatRecord[]>([]);
  const [isLoadingLive, setIsLoadingLive] = useState(true);
  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient | null>(null);

  const [currentPST, setCurrentPST] = useState<string>(formatPSTTimeOnly(new Date()));
  const [scheduleInfo, setScheduleInfo] = useState<{ label: string; countdown: string }>(getNextScheduledPSTInfo());

  const [isScanning, setIsScanning] = useState(false);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const autoTriggeredSlots = useRef<Set<string>>(new Set());

  // 1. Fetch live records from Dokploy Database without any browser cache
  const fetchDatabaseRecords = useCallback(async (sbInstance?: SupabaseClient | null) => {
    try {
      const activeSb = sbInstance || supabaseClient;
      if (activeSb) {
        const { data, error } = await activeSb
          .from('tracker_entries')
          .select('*')
          .order('detected_at', { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          const mapped: ThreatRecord[] = data.map((item: any) => ({
            id: String(item.id || `rec-${item.phone_digits}`),
            phone_number: item.phone_number || item.phone,
            phone_digits: item.phone_digits || item.clean_phone || '',
            source_name: item.source_name || item.source_platform || 'Dokploy Database',
            source_url: item.source_url || '',
            report_date: normalizeToNumericalDate(item.report_date || item.detected_at),
            category: item.category || item.scam_type || 'General Tech Support & Refund Scams',
            description: item.description || item.threat_intel || 'Verified threat record.',
            impersonated_company: item.impersonated_company || 'N/A',
            invoice_number: item.invoice_number || 'N/A',
            amount_charged: item.amount_charged || 'N/A',
            is_down: Boolean(item.is_down || item.status === 'Out of Service'),
          }));
          setRecords(mapped.sort(compareThreatDatesDesc));
          setIsLoadingLive(false);
          return;
        }
      }

      // Fallback: Fetch directly from backend endpoint with no-store
      const res = await fetch('/api/records', {
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' },
      });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.records)) {
          const mapped: ThreatRecord[] = json.records.map((item: any) => ({
            id: String(item.id || `rec-${item.cleanPhone || item.phone}`),
            phone_number: item.phone,
            phone_digits: (item.cleanPhone || item.phone || '').replace(/\D/g, ''),
            source_name: item.platform || 'Dokploy Backend',
            source_url: item.sourceUrl || '',
            report_date: normalizeToNumericalDate(item.postDate || item.detectedAt),
            category: item.scamType || 'General Tech Support & Refund Scams',
            description: item.detailedSummary || item.snippet || '',
            impersonated_company: item.impersonatedCompany || 'N/A',
            invoice_number: item.invoiceNumber || 'N/A',
            amount_charged: item.amountCharged || 'N/A',
            is_down: Boolean(item.isNumberDown),
          }));
          setRecords(mapped.sort(compareThreatDatesDesc));
        }
      }
    } catch (err) {
      console.warn('[Tracker] Live fetch error:', err);
    } finally {
      setIsLoadingLive(false);
    }
  }, [supabaseClient]);

  // 2. Real-time channel listener & connection
  useEffect(() => {
    let channel: any = null;

    const setupDatabase = async () => {
      try {
        const res = await fetch('/api/config', {
          headers: { 'Cache-Control': 'no-cache, no-store' },
        });
        let sb: SupabaseClient | null = null;
        if (res.ok) {
          const cfg = await res.json();
          if (cfg.supabaseUrl && cfg.supabaseKey) {
            sb = createClient(cfg.supabaseUrl, cfg.supabaseKey);
            setSupabaseClient(sb);
          }
        }

        await fetchDatabaseRecords(sb);

        if (sb) {
          channel = sb
            .channel('tracker_entries_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tracker_entries' }, () => {
              fetchDatabaseRecords(sb);
            })
            .subscribe();
        }
      } catch (err) {
        console.warn('Dokploy setup error, falling back to polling:', err);
        fetchDatabaseRecords();
      }
    };

    setupDatabase();
    const pollInterval = setInterval(() => fetchDatabaseRecords(), 12000);

    return () => {
      clearInterval(pollInterval);
      if (channel && supabaseClient) {
        supabaseClient.removeChannel(channel);
      }
    };
  }, [fetchDatabaseRecords]);

  // 3. Daily Schedule Auto-trigger at 7:00 AM & 1:00 PM PST
  useEffect(() => {
    const checkSchedule = () => {
      const parts = getPacificParts(new Date());
      setCurrentPST(formatPSTTimeOnly(new Date()));
      setScheduleInfo(getNextScheduledPSTInfo());

      if (parts.hour === 7 || parts.hour === 13) {
        const slotKey = `${parts.dateStr}_${parts.hour}`;
        if (!autoTriggeredSlots.current.has(slotKey) && !isScanning) {
          autoTriggeredSlots.current.add(slotKey);
          setStatusNotification(`Running scheduled scanner sweep (${parts.hour === 7 ? '7:00 AM' : '1:00 PM'} PST)...`);
          executeFullHarvesterScan();
        }
      }
    };

    const timer = setInterval(checkSchedule, 1000);
    return () => clearInterval(timer);
  }, [isScanning]);

  // 4. Scanner Engine: Searching Facebook, Instagram, and Google Search Parameters
  const executeFullHarvesterScan = async () => {
    if (isScanning) return;
    setIsScanning(true);
    try {
      const resp = await fetch('/api/scan-now', {
        method: 'POST',
        headers: { 'Cache-Control': 'no-cache, no-store' },
      });
      if (resp.ok) {
        await delay(3000);
        await fetchDatabaseRecords();
        setStatusNotification('Scan complete: Facebook, Instagram, and Google Search parameters checked.');
      } else {
        await fetchDatabaseRecords();
      }
    } catch (err) {
      console.warn('Scanner execution error:', err);
    } finally {
      setIsScanning(false);
    }
  };

  // EXPORT AS .TSX FILE (Zero .ts export)
  const handleExportTSX = () => {
    const recordsToExport = selectedIds.length > 0
      ? records.filter((r) => selectedIds.includes(r.id))
      : filteredRecords;

    const fileContent = `import React from 'react';

export interface ThreatRecord {
  id: string;
  phone_number: string;
  phone_digits: string;
  is_whatsapp?: boolean;
  source_name: string;
  source_url: string;
  report_date: string;
  category: string;
  description: string;
  impersonated_company?: string;
  invoice_number?: string;
  amount_charged?: string;
  is_down?: boolean;
}

export const EXPORTED_THREAT_RECORDS: ThreatRecord[] = ${JSON.stringify(recordsToExport, null, 2)};

export default function ExportedThreatTable(): React.ReactElement {
  return (
    <div style={{ fontFamily: 'sans-serif', padding: '1.5rem', background: '#090d16', color: '#f8fafc' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
        Exported Scam Threat Records ({recordsToExport.length})
      </h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #1e293b', textAlign: 'left', color: '#94a3b8' }}>
            <th style={{ padding: '8px' }}>Phone Number</th>
            <th style={{ padding: '8px' }}>Target / Company</th>
            <th style={{ padding: '8px' }}>Category</th>
            <th style={{ padding: '8px' }}>Date</th>
            <th style={{ padding: '8px' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {EXPORTED_THREAT_RECORDS.map((rec) => (
            <tr key={rec.id} style={{ borderBottom: '1px solid #1e293b' }}>
              <td style={{ padding: '8px', fontFamily: 'monospace', color: '#fbbf24' }}>{rec.phone_number}</td>
              <td style={{ padding: '8px' }}>{rec.impersonated_company || 'N/A'}</td>
              <td style={{ padding: '8px' }}>{rec.category}</td>
              <td style={{ padding: '8px', color: '#94a3b8' }}>{rec.report_date}</td>
              <td style={{ padding: '8px' }}>{rec.is_down ? 'Out of Service' : 'Active'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
`;

    const blob = new Blob([fileContent], { type: 'text/typescript-jsx;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `scam_threat_records_${getPSTDateStamp()}_PST.tsx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyPhone = (id: string, text: string) => {
    const textToCopy = getCleanCopyPhone(text);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleToggleStatus = async (record: ThreatRecord) => {
    const nextStatus = !record.is_down;
    if (supabaseClient) {
      await supabaseClient
        .from('tracker_entries')
        .update({ is_down: nextStatus, status: nextStatus ? 'Out of Service' : 'Active' })
        .eq('phone_digits', record.phone_digits);
    }
    fetchDatabaseRecords();
  };

  const filteredRecords = useMemo(() => {
    return records
      .filter((r) => {
        const q = searchTerm.trim().toLowerCase();
        const matchesSearch =
          !q ||
          r.phone_number.toLowerCase().includes(q) ||
          r.phone_digits.includes(q.replace(/\D/g, '')) ||
          r.category.toLowerCase().includes(q) ||
          (r.impersonated_company && r.impersonated_company.toLowerCase().includes(q));

        const matchesCategory = selectedCategory === 'ALL' || r.category === selectedCategory;
        const matchesStatus =
          selectedStatus === 'ALL' ||
          (selectedStatus === 'ACTIVE' && !r.is_down) ||
          (selectedStatus === 'DOWN' && r.is_down);

        return matchesSearch && matchesCategory && matchesStatus;
      })
      .sort((a, b) => (sortOrder === 'desc' ? compareThreatDatesDesc(a, b) : -compareThreatDatesDesc(a, b)));
  }, [records, searchTerm, selectedCategory, selectedStatus, sortOrder]);

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 text-slate-100 font-sans space-y-5">
      {statusNotification && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs px-4 py-2.5 rounded-xl flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{statusNotification}</span>
          </div>
          <button onClick={() => setStatusNotification(null)} className="text-emerald-400 hover:text-emerald-200 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <header className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
              <span className="flex items-center space-x-1.5 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                <span>DOKPLOY DATABASE (REAL-TIME)</span>
              </span>
              <span className="bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-full text-[10px] font-mono text-slate-300 flex items-center space-x-1">
                <Clock className="w-3 h-3 text-amber-400" />
                <span>{currentPST}</span>
              </span>
              <span className="bg-slate-800/80 border border-slate-700/80 px-2 py-0.5 rounded-full text-[10px] font-medium text-amber-400">
                DAILY AUTORUN: 7:00 AM & 1:00 PM PST
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-100 flex items-center space-x-2">
              <ShieldAlert className="w-6 h-6 text-red-500 shrink-0" />
              <span>SCAM HARVESTER & ACTIVE DATABASE</span>
            </h1>
            <p className="text-xs text-slate-400 max-w-2xl">
              Connected directly to Dokploy environment database without local storage. Automatically crawls Facebook, Instagram, and Google Search parameters.
            </p>
          </div>

          <div className="flex items-center space-x-2 flex-wrap gap-y-2">
            <button
              onClick={executeFullHarvesterScan}
              disabled={isScanning}
              className="px-4 py-2 bg-gradient-to-r from-red-600 to-amber-500 text-slate-950 text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-lg disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Scanning Feeds...' : 'Run Scanner Now'}</span>
            </button>

            {/* Export as .tsx */}
            <button
              onClick={handleExportTSX}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center space-x-1.5 border border-slate-700 cursor-pointer"
              title="Export database as a .tsx file"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export .tsx</span>
            </button>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <Radio className={`w-3 h-3 ${isScanning ? 'text-amber-400 animate-pulse' : 'text-emerald-400'}`} />
            <span>Target Channels: Facebook · Instagram · Google Search Parameters</span>
          </div>
          <div className="font-mono text-[11px] text-amber-400">
            Next Scheduled Run: <strong>{scheduleInfo.label}</strong> ({scheduleInfo.countdown})
          </div>
        </div>
      </header>

      {/* Search & Filters */}
      <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search numbers, companies, categories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full md:w-auto">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="DOWN">Out of Service Only</option>
          </select>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'desc' | 'asc')}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 cursor-pointer"
          >
            <option value="desc">Newest First</option>
            <option value="asc">Oldest First</option>
          </select>
        </div>
      </div>

      {/* Threat Records Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
            <tr>
              <th className="px-4 py-3.5">Phone Number</th>
              <th className="px-4 py-3.5">Date Detected</th>
              <th className="px-4 py-3.5">Company / Impersonation</th>
              <th className="px-4 py-3.5">Category</th>
              <th className="px-4 py-3.5">Source</th>
              <th className="px-4 py-3.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {isLoadingLive ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-slate-500">
                  <div className="flex items-center justify-center space-x-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                    <span>Streaming live records from Dokploy database...</span>
                  </div>
                </td>
              </tr>
            ) : filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-slate-500">
                  No threat records found in database.
                </td>
              </tr>
            ) : (
              filteredRecords.map((r) => (
                <tr key={r.id} className="hover:bg-slate-800/60 transition-colors">
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <a href={`tel:${r.phone_digits}`} className="font-mono font-bold text-amber-400 hover:underline">
                        {r.phone_number}
                      </a>
                      <button
                        onClick={() => handleCopyPhone(r.id, r.phone_number)}
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 cursor-pointer"
                        title="Copy Number"
                      >
                        {copiedId === r.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      {isWhatsAppThreat(r) && (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold">
                          WhatsApp
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap font-mono text-slate-400">
                    {r.report_date}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap font-semibold text-slate-200">
                    {r.impersonated_company}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] bg-red-500/10 text-red-400 border border-red-500/20">
                      {r.category}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-slate-300">
                    {r.source_url && r.source_url.startsWith('http') ? (
                      <a href={r.source_url} target="_blank" rel="noreferrer" className="hover:text-amber-400 underline inline-flex items-center space-x-1">
                        <span>{r.source_name}</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    ) : (
                      <span>{r.source_name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <button
                      onClick={() => handleToggleStatus(r)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold border cursor-pointer ${
                        r.is_down
                          ? 'bg-slate-800 text-slate-400 border-slate-700'
                          : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      }`}
                    >
                      {r.is_down ? 'Out of Service' : 'Active Line'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default TrackerPage;