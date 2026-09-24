import React, { useState, useEffect, useMemo, useRef } from 'react';
import databaseSeed from '../data/database_seed.json';
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
  FileSpreadsheet,
  Zap,
  Info,
  Clock,
  Globe,
  PhoneCall,
  Phone,
  ShieldAlert,
  Building2,
  Calendar,
  DollarSign,
  MessageCircle,
  Sliders,
  Play,
  Key,
  Trash2,
  Share2,
  Award,
  ArrowDown,
  ArrowUp,
  Lock,
  Unlock,
  Edit3,
  Save,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';
import { getPSTDateStamp, normalizeToNumericalDate } from '../utils/dateUtils';
import { parseFullCSV, CSV_EXPORT_HEADERS } from '../utils/csvHandler';
import {
  formatDisplayPhone,
  isTollFreeNumber,
  isFictitiousOrInvalidPhone,
  deriveCountryInfo,
  getCleanCopyPhone,
} from '../utils/phoneUtils';
import { resolveTargetCompany } from '../utils/targetUtils';
import {
  verifyEncryptedAdmin,
  verifyEncryptedBypass,
  isBypassAllowedForAction,
  checkClientGeoPermission,
} from '../utils/security';
import { noSqlDatabase } from '../db/noSqlDatabase';
import { syncBridge } from '../utils/syncBridge';
import { ThreatRecord, AltNumberEntry, ScamPhoneRecord } from '../types';
import ReportScamPage from './ReportScamPage';
import SupabaseDiagnosticModal from '../components/SupabaseDiagnosticModal';
import {
  getStoredSupabaseConfig,
  getSupabaseClient,
  fetchFromSupabase,
  upsertToSupabase,
} from '../lib/supabase';

export interface TrackerPageProps {
  onNavigateToReport?: () => void;
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

export const SCAN_TARGETS = [
  {
    id: 'tsu-latest',
    name: 'Tech Scammers United: Latest',
    platform: 'Tech Support United',
    category: 'General Tech Support & Refund Scams',
    targetQuery: 'site:techscammersunited.com/latest order:newest',
  },
  {
    id: 'scammer-info',
    name: 'Scammer.info: Scams Category',
    platform: 'Scammer.info',
    category: 'General Tech Support & Refund Scams',
    targetQuery: 'site:scammer.info/c/scams order:latest',
  },
  {
    id: 'fb-spellcaster',
    name: 'Facebook: Spellcaster WhatsApp Scams',
    platform: 'Facebook',
    category: 'Spellcaster WhatsApp Extortion',
    targetQuery: 'site:facebook.com ("bring back lost lover" OR "love spell")',
  },
  {
    id: 'fb-btc-recovery',
    name: 'Facebook: BTC Recovery Scams',
    platform: 'Facebook',
    category: 'Crypto BTC Recovery Scam',
    targetQuery: 'site:facebook.com ("crypto recovery" OR "btc recovery")',
  },
  {
    id: 'pch-sweepstakes',
    name: 'PCH & Mega Millions Prize Scams',
    platform: 'Tech Support United',
    category: 'Lottery & Sweepstakes Scams',
    targetQuery: 'site:techscammersunited.com "PCH" OR "Mega Millions"',
  },
];

export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function isPrizeOrExtendedRetention(record: Partial<ThreatRecord> | null | undefined): boolean {
  if (!record) return false;
  const company = (record.impersonated_company || '').toLowerCase();
  const category = (record.category || '').toLowerCase();
  const desc = (record.description || '').toLowerCase();
  const text = `${company} ${category} ${desc}`;

  if (company.includes('pch') || company.includes('publishers clearing') || category.includes('pch')) return true;
  if (company.includes('mega million') || company.includes('megamillion') || category.includes('mega million')) return true;
  if (company.includes('stake.us') || company.includes('stake us') || category.includes('stake.us')) return true;
  if (category.includes('prize') || category.includes('sweepstake') || category.includes('lottery') || category.includes('giveaway')) {
    if (!category.includes('spellcaster')) return true;
  }
  return false;
}

export function getRetentionLabel(record: Partial<ThreatRecord> | null | undefined): string {
  return isPrizeOrExtendedRetention(record) ? '6-Mo Prize' : '90-Day';
}

export function compareThreatDatesDesc(a: Partial<ThreatRecord>, b: Partial<ThreatRecord>): number {
  const dateA = normalizeToNumericalDate(a.report_date);
  const dateB = normalizeToNumericalDate(b.report_date);
  const timeA = new Date(`${dateA}T12:00:00.000Z`).getTime();
  const timeB = new Date(`${dateB}T12:00:00.000Z`).getTime();
  if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) return timeB - timeA;
  if (dateA !== dateB) return dateB.localeCompare(dateA);
  return (b.id || '').localeCompare(a.id || '');
}

export function compareThreatDatesAsc(a: Partial<ThreatRecord>, b: Partial<ThreatRecord>): number {
  return -compareThreatDatesDesc(a, b);
}

export function deduplicateThreatRecordsList(records: ThreatRecord[]): ThreatRecord[] {
  const map = new Map<string, ThreatRecord>();
  for (const item of records) {
    if (!item) continue;
    const digits = (item.phone_digits || item.phone_number || '').replace(/\D/g, '');
    if (!digits) continue;
    const cleanItem = { ...item, phone_digits: digits };
    if (map.has(digits)) {
      const ex = map.get(digits)!;
      map.set(digits, {
        ...ex,
        ...cleanItem,
        impersonated_company: cleanItem.impersonated_company && cleanItem.impersonated_company !== 'N/A' ? cleanItem.impersonated_company : ex.impersonated_company,
        description: cleanItem.description || ex.description,
        is_down: cleanItem.is_down ?? ex.is_down,
      });
    } else {
      map.set(digits, cleanItem);
    }
  }
  return Array.from(map.values());
}

export function formatPSTTimeOnly(date = new Date(), withSeconds = true): string {
  return (
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      hour: 'numeric',
      minute: '2-digit',
      second: withSeconds ? '2-digit' : undefined,
      hour12: true,
    }).format(date) + ' PST'
  );
}

export function getNextScheduledPSTInfo(): { label: string; countdown: string } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)?.value || '0', 10);
  const hour = get('hour');
  const minute = get('minute');
  const second = get('second');

  let targetHour = 7;
  let isTomorrow = false;
  if (hour < 7) targetHour = 7;
  else if (hour < 13) targetHour = 13;
  else {
    targetHour = 7;
    isTomorrow = true;
  }

  const currentSeconds = hour * 3600 + minute * 60 + second;
  let targetSeconds = targetHour * 3600;
  if (isTomorrow) targetSeconds += 24 * 3600;

  const diffSec = targetSeconds - currentSeconds;
  const diffHours = Math.floor(diffSec / 3600);
  const diffMins = Math.floor((diffSec % 3600) / 60);

  const label = isTomorrow ? 'Tomorrow at 7:00 AM PST' : targetHour === 7 ? 'Today at 7:00 AM PST' : 'Today at 1:00 PM PST';
  return { label, countdown: `in ${diffHours}h ${diffMins}m` };
}

const STORAGE_KEY = 'endscams_threat_records_v3';

export function TrackerPage({ onNavigateToReport }: TrackerPageProps = {}) {
  // 1. Unified Records State
  const [records, setRecords] = useState<ThreatRecord[]>(() => {
    let initialList = (databaseSeed as ThreatRecord[]) || [];
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            initialList = [...parsed, ...initialList];
          }
        }
      } catch {}
    }
    return deduplicateThreatRecordsList(initialList).sort(compareThreatDatesDesc);
  });

  // Time & Scanner states
  const [currentPST, setCurrentPST] = useState<string>(formatPSTTimeOnly(new Date(), true));
  const [scheduleInfo, setScheduleInfo] = useState<{ label: string; countdown: string }>(getNextScheduledPSTInfo());
  const [isScanning, setIsScanning] = useState(false);
  const [scannerProgress, setScannerProgress] = useState(0);
  const [scannerStatusMessage, setScannerStatusMessage] = useState('Idle');
  const [scannerLogs, setScannerLogs] = useState<string[]>([]);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  // Filters & Sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedSource, setSelectedSource] = useState('ALL');
  const [selectedCountry, setSelectedCountry] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedRetention, setSelectedRetention] = useState<'ALL' | 'PRIZE_6MO' | 'STANDARD_90D'>('ALL');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modals
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [isTargetedSearchOpen, setIsTargetedSearchOpen] = useState(false);
  const [targetedQuery, setTargetedQuery] = useState('');
  const [targetedCategory, setTargetedCategory] = useState('General Tech Support & Refund Scams');

  // Supabase Connection Status
  const [supabaseConnected, setSupabaseConnected] = useState<boolean>(false);
  const [supabaseTableUsed, setSupabaseTableUsed] = useState<string | null>(null);
  const [isSyncingWithDb, setIsSyncingWithDb] = useState(false);

  // Scan Summary Report Modal
  const [scanSummary, setScanSummary] = useState<any | null>(null);
  const [isScanSummaryOpen, setIsScanSummaryOpen] = useState(false);

  // Authentication for Admin Actions
  const [isPasswordVerified, setIsPasswordVerified] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('tracker_pass_verified') === 'true';
    }
    return false;
  });
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordActionName, setPasswordActionName] = useState('Administrative Action');
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Threat Detail / Edit Modal (Center popup)
  const [selectedDetailRecord, setSelectedDetailRecord] = useState<ThreatRecord | null>(null);
  const [isEditingInPopup, setIsEditingInPopup] = useState(false);
  const [popupEditForm, setPopupEditForm] = useState<Partial<ThreatRecord>>({});

  // Import State
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{ valid: ThreatRecord[]; rejectedBad: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // =========================================================================
  // REPROGRAMMED PERSISTENCE & DATA FETCHING: INCOGNITO & DATABASE SYNC
  // =========================================================================

  /**
   * Unified data loader that runs on mount:
   * 1. Direct call to Supabase (`fetchFromSupabase`)
   * 2. Backend API call to `/api/records` (server database)
   * 3. Reconciles and dedupes so Incognito windows get real data instantly
   */
  const loadSharedDatabaseRecords = async () => {
    setIsSyncingWithDb(true);
    let discovered: ThreatRecord[] = [];

    // Step A: Pull from Supabase directly
    try {
      const { fetchServerSupabaseConfig } = await import('../lib/supabase');
      await fetchServerSupabaseConfig();
      const sbResult = await fetchFromSupabase();
      if (sbResult.success && sbResult.records && sbResult.records.length > 0) {
        discovered = [...discovered, ...sbResult.records];
        setSupabaseConnected(true);
        setSupabaseTableUsed(sbResult.tableUsed || 'tracker_entries');
      } else if (sbResult.isRlsError) {
        console.warn('[Supabase Notice] RLS blocking read:', sbResult.error);
      }
    } catch (e) {
      console.warn('[Supabase] Initial fetch notice:', e);
    }

    // Step B: Pull from Backend Server API
    try {
      const res = await fetch('/api/records');
      if (res.ok) {
        const data = await res.json();
        const serverRecords: any[] = Array.isArray(data) ? data : data.records || [];
        if (serverRecords.length > 0) {
          const mapped = serverRecords.map((r) => ({
            id: r.id || `rec-${r.cleanPhone || r.phone_digits || Date.now()}`,
            phone_number: r.phone_number || r.phone || '',
            phone_digits: r.phone_digits || r.cleanPhone || (r.phone ? r.phone.replace(/\D/g, '') : ''),
            is_whatsapp: Boolean(r.is_whatsapp || r.isWhatsapp),
            category: r.category || r.scamType || 'General Tech Support & Refund Scams',
            impersonated_company: r.impersonated_company || r.impersonatedCompany || 'N/A',
            source_name: r.source_name || r.platform || 'Shared Database',
            source_url: r.source_url || r.sourceUrl || '',
            report_date: normalizeToNumericalDate(r.report_date || r.postDate || r.detectedAt),
            description: r.description || r.detailedSummary || r.snippet || '',
            invoice_number: r.invoice_number || r.invoiceNumber || 'N/A',
            amount_charged: r.amount_charged || r.amountCharged || 'N/A',
            money_lost: r.money_lost || r.moneyLost,
            is_down: Boolean(r.is_down || r.isNumberDown),
          }));
          discovered = [...discovered, ...mapped];
        }
      }
    } catch (e) {
      console.warn('[Backend /api/records notice]:', e);
    }

    if (discovered.length > 0) {
      setRecords((prev) => {
        const combined = [...discovered, ...prev];
        const deduped = deduplicateThreatRecordsList(combined).sort(compareThreatDatesDesc);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(deduped));
        } catch {}
        return deduped;
      });
    }

    setIsSyncingWithDb(false);
  };

  useEffect(() => {
    loadSharedDatabaseRecords();

    // Regular polling every 10 seconds for real-time incognito & multi-user sync
    const poller = setInterval(loadSharedDatabaseRecords, 10000);
    return () => clearInterval(poller);
  }, []);

  // Update Pacific Time clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentPST(formatPSTTimeOnly(new Date(), true));
      setScheduleInfo(getNextScheduledPSTInfo());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync to localStorage
  useEffect(() => {
    if (records.length > 0 && typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      } catch {}
    }
  }, [records]);

  // Multi-Model Threat Harvester Scan across rotating Gemini models
  const executeFullHarvesterScan = async () => {
    setIsScanning(true);
    setStatusNotification('Scanning targets with rotating Gemini models (lightening daily API limits)...');
    try {
      const res = await fetch('/api/scan-now', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.summary) {
        if (Array.isArray(data.records) && data.records.length > 0) {
          setRecords((prev) => deduplicateThreatRecordsList([...data.records, ...prev]).sort(compareThreatDatesDesc));
        }
        setScanSummary(data.summary);
        setIsScanSummaryOpen(true);
        setStatusNotification(
          `Threat scan completed! Discovered ${data.summary.totalThreatsDiscovered} new numbers across ${data.summary.totalScans} targets rotating through Gemini models.`
        );
      } else {
        setStatusNotification(`Notice: ${data.error || 'Scan cycle finished'}`);
      }
    } catch (err: any) {
      setStatusNotification(`Scan error: ${err.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  // Passphrase Guard
  const requireTrackerPass = (actionName: string, onVerified: () => void) => {
    if (isPasswordVerified) {
      onVerified();
      return;
    }
    setPasswordActionName(actionName);
    setPendingAction(() => onVerified);
    setPasswordInput('');
    setPasswordError(null);
    setIsPasswordModalOpen(true);
  };

  const handleVerifyPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const entered = passwordInput.trim();
    if (!entered) {
      setPasswordError('Please enter password.');
      return;
    }

    const isAdmin = await verifyEncryptedAdmin(entered);
    const isBypass = await verifyEncryptedBypass(entered);

    if (isAdmin || isBypass) {
      setIsPasswordVerified(true);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('tracker_pass_verified', 'true');
      }
      setIsPasswordModalOpen(false);
      setPasswordInput('');
      setStatusNotification(`Authorized: ${passwordActionName}`);
      if (pendingAction) {
        const act = pendingAction;
        setPendingAction(null);
        act();
      }
    } else {
      setPasswordError('Invalid credentials. Standard default is admin123 or bypass.');
    }
  };

  // =========================================================================
  // REPROGRAMMED CSV IMPORT: SAVES TO LOCAL, BACKEND & SUPABASE
  // =========================================================================

  const handleCSVFileSelect = async (file: File) => {
    setImportFile(file);
    setImportError(null);
    try {
      const text = await file.text();
      validateAndPreviewCSV(text);
    } catch (err: any) {
      setImportError(`Failed to read file: ${err.message || err}`);
    }
  };

  const validateAndPreviewCSV = (rawText: string) => {
    let clean = rawText.replace(/^\uFEFF/, '').trim();
    if (!clean) {
      setImportError('Uploaded file is empty.');
      setImportPreview(null);
      return;
    }

    const rows = parseFullCSV(clean);
    if (rows.length < 2) {
      setImportError('CSV file must have at least 1 header row and 1 data row.');
      setImportPreview(null);
      return;
    }

    const headerRow = rows[0].map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const phoneIdx = headerRow.findIndex((h) =>
      ['phonenumber', 'phone', 'phoneno', 'number', 'tel', 'digits', 'cleanphone', 'threatline'].includes(h)
    );
    const categoryIdx = headerRow.findIndex((h) => ['typeofscam', 'scamtype', 'category', 'type'].includes(h));
    const companyIdx = headerRow.findIndex((h) => ['companyimpersonated', 'impersonatedcompany', 'company', 'brand'].includes(h));
    const sourceIdx = headerRow.findIndex((h) => ['platform', 'sourcename', 'source', 'website'].includes(h));
    const urlIdx = headerRow.findIndex((h) => ['sourceurl', 'url', 'link'].includes(h));
    const dateIdx = headerRow.findIndex((h) => ['datedetectedpst', 'datedetected', 'date', 'reportdate', 'postdate'].includes(h));
    const descIdx = headerRow.findIndex((h) => ['snippet', 'description', 'notes', 'details', 'summary'].includes(h));
    const statusIdx = headerRow.findIndex((h) => ['status', 'isdown', 'state'].includes(h));

    let effectivePhoneIdx = phoneIdx;
    if (effectivePhoneIdx === -1) {
      for (let c = 0; c < (rows[1] || []).length; c++) {
        if ((rows[1][c] || '').replace(/\D/g, '').length >= 7) {
          effectivePhoneIdx = c;
          break;
        }
      }
    }

    if (effectivePhoneIdx === -1) {
      setImportError('Could not find a phone number column in your CSV.');
      setImportPreview(null);
      return;
    }

    const valid: ThreatRecord[] = [];
    let rejectedBad = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0 || row.every((c) => !c || !c.trim())) continue;

      const rawPhone = (row[effectivePhoneIdx] || '').trim();
      let digits = rawPhone.replace(/\D/g, '');
      if (digits.length === 10) digits = '1' + digits;

      if (isFictitiousOrInvalidPhone(rawPhone) || digits.length < 7) {
        rejectedBad++;
        continue;
      }

      const statusVal = statusIdx >= 0 && row[statusIdx] ? row[statusIdx].toLowerCase() : '';
      const isDown = statusVal.includes('down') || statusVal.includes('out of service');

      const rec: ThreatRecord = {
        id: `import-${Date.now()}-${i}-${digits.slice(-4)}`,
        phone_number: formatDisplayPhone(rawPhone, digits),
        phone_digits: digits,
        category: categoryIdx >= 0 && row[categoryIdx] ? row[categoryIdx].trim() : 'General Tech Support & Refund Scams',
        impersonated_company: resolveTargetCompany(
          companyIdx >= 0 && row[companyIdx] ? row[companyIdx].trim() : '',
          categoryIdx >= 0 && row[categoryIdx] ? row[categoryIdx].trim() : '',
          descIdx >= 0 && row[descIdx] ? row[descIdx].trim() : ''
        ),
        source_name: sourceIdx >= 0 && row[sourceIdx] ? row[sourceIdx].trim() : 'CSV Import',
        source_url: urlIdx >= 0 && row[urlIdx] ? row[urlIdx].trim() : '',
        report_date: normalizeToNumericalDate(dateIdx >= 0 && row[dateIdx] ? row[dateIdx] : new Date()),
        description: descIdx >= 0 && row[descIdx] ? row[descIdx].trim() : 'Imported threat intelligence record.',
        is_down: isDown,
      };

      valid.push(rec);
    }

    if (valid.length === 0) {
      setImportError('No valid threat records found.');
      setImportPreview(null);
      return;
    }

    setImportError(null);
    setImportPreview({ valid, rejectedBad });
  };

  const handleConfirmImport = async () => {
    if (!importPreview || importPreview.valid.length === 0 || isImporting) return;
    setIsImporting(true);

    const imported = importPreview.valid;

    // 1. Update React state immediately
    setRecords((prev) => {
      const merged = deduplicateThreatRecordsList([...imported, ...prev]).sort(compareThreatDatesDesc);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } catch {}
      return merged;
    });

    // 2. Persist to Backend Server (/api/records/bulk-upsert)
    try {
      await fetch('/api/records/bulk-upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: imported }),
      });
    } catch (e) {
      console.warn('Backend bulk upsert notice:', e);
    }

    // 3. Persist to Supabase Database
    let sbSuccess = false;
    try {
      const res = await upsertToSupabase(imported);
      if (res.success) {
        sbSuccess = true;
        setSupabaseConnected(true);
      }
    } catch (e) {
      console.warn('Supabase upsert notice:', e);
    }

    setIsImporting(false);
    setIsImportModalOpen(false);
    setImportFile(null);
    setImportPreview(null);

    setStatusNotification(
      `Successfully imported ${imported.length} threat lines! ${
        sbSuccess ? 'Persisted to Supabase and shared server database.' : 'Persisted to shared database.'
      }`
    );
  };

  // Export CSV
  const handleExportCSV = () => {
    const recordsToExport = selectedIds.length > 0
      ? records.filter((r) => selectedIds.includes(r.id)).sort(compareThreatDatesDesc)
      : filteredRecords;

    const rows = recordsToExport.map((r) => {
      const country = deriveCountryInfo(r.phone_number);
      return [
        `"${(r.category || '').replace(/"/g, '""')}"`,
        `"${(r.phone_number || '').replace(/"/g, '""')}"`,
        `"${r.phone_digits}"`,
        `"${r.is_whatsapp ? 'Yes' : 'No'}"`,
        `"${(r.impersonated_company || 'N/A').replace(/"/g, '""')}"`,
        `"${normalizeToNumericalDate(r.report_date)}"`,
        `"${(r.source_url || '').replace(/"/g, '""')}"`,
        `"${(r.source_name || '').replace(/"/g, '""')}"`,
        `"${country.name}"`,
        `"${(r.description || '').replace(/"/g, '""')}"`,
        `"${r.is_down ? 'Out of Service' : 'Active Line'}"`,
      ];
    });

    const csvContent = '\uFEFF' + [CSV_EXPORT_HEADERS.join(','), ...rows.map((e) => e.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `endscams_threat_records_${getPSTDateStamp()}_PST.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Status Toggle
  const handleToggleStatus = async (record: ThreatRecord) => {
    const nextStatus = !record.is_down;
    const updated = { ...record, is_down: nextStatus };

    setRecords((prev) => prev.map((r) => (r.id === record.id ? updated : r)));
    setStatusNotification(`Marked ${record.phone_number} as ${nextStatus ? 'Out of Service' : 'Active Line'}.`);

    // Sync to backend and Supabase
    try {
      fetch(`/api/records/${record.id}/toggle-down`, { method: 'POST' }).catch(() => {});
      upsertToSupabase([updated]).catch(() => {});
    } catch {}
  };

  // Copy phone number
  const handleCopyPhone = (id: string, text: string) => {
    const clean = getCleanCopyPhone(text);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(clean);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // Popup detail & edit
  const handleOpenPopupDetail = (record: ThreatRecord) => {
    setSelectedDetailRecord(record);
    setIsEditingInPopup(false);
    setPopupEditForm({ ...record });
  };

  const handleSavePopupEdit = async () => {
    if (!selectedDetailRecord) return;
    const digits = (popupEditForm.phone_number || '').replace(/\D/g, '');
    if (digits.length < 7) {
      alert('Phone number must have at least 7 digits.');
      return;
    }

    const updated: ThreatRecord = {
      ...selectedDetailRecord,
      ...popupEditForm,
      phone_digits: digits,
      phone_number: formatDisplayPhone(popupEditForm.phone_number || '', digits),
      impersonated_company: popupEditForm.impersonated_company?.trim() || 'N/A',
      category: popupEditForm.category?.trim() || selectedDetailRecord.category,
      description: popupEditForm.description?.trim() || selectedDetailRecord.description,
    };

    setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setSelectedDetailRecord(updated);
    setIsEditingInPopup(false);
    setStatusNotification(`Updated threat record: ${updated.phone_number}`);

    // Persist to Supabase and backend
    upsertToSupabase([updated]);
    fetch(`/api/records/${updated.id}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    }).catch(() => {});
  };

  // Filtering
  const filteredRecords = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const list = records.filter((r) => {
      const matchesSearch =
        !q ||
        r.phone_number.toLowerCase().includes(q) ||
        r.phone_digits.includes(q.replace(/\D/g, '')) ||
        r.category.toLowerCase().includes(q) ||
        (r.impersonated_company && r.impersonated_company.toLowerCase().includes(q)) ||
        r.description.toLowerCase().includes(q);

      const matchesCat = selectedCategory === 'ALL' || r.category === selectedCategory;
      const matchesSrc = selectedSource === 'ALL' || r.source_name === selectedSource;
      const country = deriveCountryInfo(r.phone_number);
      const matchesCountry = selectedCountry === 'ALL' || country.name === selectedCountry;
      const matchesStatus =
        selectedStatus === 'ALL' ||
        (selectedStatus === 'ACTIVE' && !r.is_down) ||
        (selectedStatus === 'DOWN' && r.is_down);
      const matchesRetention =
        selectedRetention === 'ALL' ||
        (selectedRetention === 'PRIZE_6MO' && isPrizeOrExtendedRetention(r)) ||
        (selectedRetention === 'STANDARD_90D' && !isPrizeOrExtendedRetention(r));

      return matchesSearch && matchesCat && matchesSrc && matchesCountry && matchesStatus && matchesRetention;
    });

    return list.sort((a, b) => (sortOrder === 'desc' ? compareThreatDatesDesc(a, b) : compareThreatDatesAsc(a, b)));
  }, [records, searchTerm, selectedCategory, selectedSource, selectedCountry, selectedStatus, selectedRetention, sortOrder]);

  const categoriesList = useMemo(() => Array.from(new Set(records.map((r) => r.category))), [records]);
  const sourcesList = useMemo(() => Array.from(new Set(records.map((r) => r.source_name))), [records]);
  const countriesList = useMemo(
    () => Array.from(new Set(records.map((r) => deriveCountryInfo(r.phone_number).name))),
    [records]
  );

  const totalNumbers = records.length;
  const downCount = records.filter((r) => r.is_down).length;
  const activeCount = totalNumbers - downCount;

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 text-slate-100 font-sans space-y-5">
      {/* Alert Banner */}
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

      {/* Header Banner */}
      <header className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
              <span className="flex items-center space-x-1.5 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                <span>AUTONOMOUS HARVESTER & SUPABASE ENGINE</span>
              </span>

              <span className="bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-full text-[10px] font-mono text-slate-300 flex items-center space-x-1">
                <Clock className="w-3 h-3 text-amber-400" />
                <span>{currentPST}</span>
              </span>

              {/* Supabase Status Pill */}
              <button
                type="button"
                onClick={() => setIsSupabaseModalOpen(true)}
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold flex items-center space-x-1 transition cursor-pointer border ${
                  supabaseConnected
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/25'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25'
                }`}
                title="Click to view Supabase Connection & RLS Diagnostics"
              >
                <Database className="w-3 h-3" />
                <span>{supabaseConnected ? `Supabase: Connected (${supabaseTableUsed || 'Live'})` : 'Supabase: Configure & Test RLS'}</span>
              </button>
            </div>

            <h1 className="text-lg sm:text-2xl font-black text-slate-100 flex items-center space-x-2 tracking-tight">
              <ShieldAlert className="w-6 h-6 text-red-500 shrink-0" />
              <span>CWN Scam Threat Tracker</span>
            </h1>

            <p className="text-xs text-slate-400 max-w-3xl">
              Multi-source threat scanner with shared backend database persistence. Real-time synchronization across devices and incognito windows.
            </p>
          </div>

          {/* Action Button Strip */}
          <div className="flex items-center space-x-2 flex-wrap gap-y-2">
            {/* Run Threat Scan */}
            <button
              onClick={() => requireTrackerPass('Execute Multi-Model Harvester Scan', () => executeFullHarvesterScan())}
              disabled={isScanning}
              className="px-3.5 py-2 bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400 text-slate-950 text-xs font-bold rounded-xl flex items-center space-x-1.5 transition shadow-lg disabled:opacity-50 cursor-pointer"
              title="Execute live scan across rotating Gemini models to lighten API limits"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Scanning Models...' : 'Run Threat Scan'}</span>
            </button>

            {/* Supabase DB Inspector */}
            <button
              onClick={() => setIsSupabaseModalOpen(true)}
              className="px-3 py-2 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition border border-emerald-800/60 cursor-pointer shadow-sm"
              title="Inspect Supabase Database & Troubleshoot RLS"
            >
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>Supabase DB</span>
            </button>

            {/* Import CSV */}
            <button
              onClick={() => requireTrackerPass('Import CSV Threat Records', () => setIsImportModalOpen(true))}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition border border-slate-700 cursor-pointer"
              title="Import CSV Records (persists to Supabase & backend)"
            >
              <Upload className="w-3.5 h-3.5 text-blue-400" />
              <span>Import CSV</span>
            </button>

            {/* Export CSV */}
            <button
              onClick={handleExportCSV}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition border border-slate-700 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export CSV</span>
            </button>

            {/* Report Scam */}
            <button
              onClick={() => {
                if (onNavigateToReport) onNavigateToReport();
                else setIsReportModalOpen(true);
              }}
              className="px-3.5 py-2 bg-red-950/40 hover:bg-red-900/60 text-red-200 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition border border-red-800/60 cursor-pointer shadow-sm group"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-red-400 group-hover:scale-110 transition-transform" />
              <span>Report Scam</span>
            </button>

            {/* Sync Now */}
            <button
              onClick={() => loadSharedDatabaseRecords()}
              disabled={isSyncingWithDb}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 rounded-xl transition border border-slate-700 cursor-pointer"
              title="Re-sync with Database"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingWithDb ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Schedule & Info */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 flex-wrap gap-2">
          <div className="flex items-center space-x-2">
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              <strong>Status:</strong> {isSyncingWithDb ? 'Reconciling with Supabase & server database...' : 'Monitoring live shared threat streams'}
            </span>
          </div>

          <div className="flex items-center space-x-1.5 text-slate-300 font-mono">
            <span>Next Auto-Scan:</span>
            <span className="text-amber-400 font-bold">{scheduleInfo.label}</span>
            <span className="text-slate-500">({scheduleInfo.countdown})</span>
          </div>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 sm:p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider">Total Numbers</p>
            <div className="flex items-baseline space-x-1.5 sm:space-x-2 mt-0.5 sm:mt-1">
              <span className="text-xl sm:text-2xl font-bold text-slate-100">{totalNumbers}</span>
              <span className="text-[10px] sm:text-xs text-slate-400">
                <strong className="text-emerald-400 font-medium">{activeCount} active</strong> · <strong className="text-red-400 font-medium">{downCount} down</strong>
              </span>
            </div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center shrink-0">
            <PhoneCall className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 sm:p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider">Scam Types</p>
            <div className="flex items-baseline space-x-1.5 sm:space-x-2 mt-0.5 sm:mt-1">
              <span className="text-xl sm:text-2xl font-bold text-slate-100">{categoriesList.length}</span>
              <span className="text-[10px] sm:text-xs text-slate-500">categories</span>
            </div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 sm:p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider">Platforms</p>
            <div className="flex items-baseline space-x-1.5 sm:space-x-2 mt-0.5 sm:mt-1">
              <span className="text-xl sm:text-2xl font-bold text-slate-100">{sourcesList.length}</span>
              <span className="text-[10px] sm:text-xs text-slate-500">sources</span>
            </div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
            <Globe className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 sm:p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider">Countries</p>
            <div className="flex items-baseline space-x-1.5 sm:space-x-2 mt-0.5 sm:mt-1">
              <span className="text-xl sm:text-2xl font-bold text-slate-100">{countriesList.length}</span>
              <span className="text-[10px] sm:text-xs text-slate-500">regions</span>
            </div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <section className="bg-slate-900/90 border border-slate-800 p-3 sm:p-4 rounded-2xl flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2 w-full">
          {/* Category Filter */}
          <div className="flex-1 min-w-[140px] flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-300">
            <Filter className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer w-full"
            >
              <option value="ALL" className="bg-slate-900">All Categories</option>
              {categoriesList.map((c) => (
                <option key={c} value={c} className="bg-slate-900">{c}</option>
              ))}
            </select>
          </div>

          {/* Source Filter */}
          <div className="flex-1 min-w-[130px] flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-300">
            <Database className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer w-full"
            >
              <option value="ALL" className="bg-slate-900">All Sources</option>
              {sourcesList.map((s) => (
                <option key={s} value={s} className="bg-slate-900">{s}</option>
              ))}
            </select>
          </div>

          {/* Country Filter */}
          <div className="flex-1 min-w-[130px] flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-300">
            <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer w-full"
            >
              <option value="ALL" className="bg-slate-900">All Countries</option>
              {countriesList.map((c) => (
                <option key={c} value={c} className="bg-slate-900">{c}</option>
              ))}
            </select>
          </div>

          {/* Retention Filter */}
          <div className="flex-1 min-w-[140px] flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-300">
            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <select
              value={selectedRetention}
              onChange={(e) => setSelectedRetention(e.target.value as any)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer w-full"
            >
              <option value="ALL" className="bg-slate-900">All Retentions</option>
              <option value="PRIZE_6MO" className="bg-slate-900">6-Mo (Prize/Lotto/Stake)</option>
              <option value="STANDARD_90D" className="bg-slate-900">90-Day Standard</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="w-full sm:w-auto sm:min-w-[160px] flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-300">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer w-full"
            >
              <option value="ALL" className="bg-slate-900">All Statuses</option>
              <option value="ACTIVE" className="bg-slate-900">Active Lines Only</option>
              <option value="DOWN" className="bg-slate-900">Down / Closed Only</option>
            </select>
          </div>
        </div>

        {/* Lower Row: Search Bar & Sort */}
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search phone number, company, scam description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
            />
          </div>

          <div className="w-full sm:w-auto sm:min-w-[190px] flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-300">
            <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'desc' | 'asc')}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer w-full"
            >
              <option value="desc" className="bg-slate-900">Sort: Newest Date First</option>
              <option value="asc" className="bg-slate-900">Sort: Oldest Date First</option>
            </select>
          </div>
        </div>
      </section>

      {/* Main Results Table */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/90 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3.5 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.length > 0 && selectedIds.length === filteredRecords.length}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedIds(filteredRecords.map((r) => r.id));
                      else setSelectedIds([]);
                    }}
                    className="rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3.5 min-w-[220px]">Phone Number</th>
                <th
                  className="px-4 py-3.5 min-w-[140px] cursor-pointer select-none group hover:text-amber-400 transition-colors"
                  onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                >
                  <div className="flex items-center space-x-1.5">
                    <span>Date Detected</span>
                    <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 text-[9px] font-semibold border border-amber-500/20">
                      <span>{sortOrder === 'desc' ? 'Newest' : 'Oldest'}</span>
                      {sortOrder === 'desc' ? <ArrowDown className="w-2.5 h-2.5" /> : <ArrowUp className="w-2.5 h-2.5" />}
                    </span>
                  </div>
                </th>
                <th className="px-4 py-3.5 min-w-[200px]">Company / Target</th>
                <th className="px-4 py-3.5 min-w-[220px]">Scam Category</th>
                <th className="px-4 py-3.5 min-w-[150px] text-right sm:text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-slate-500">
                    No threat records found. Click "Import CSV" to upload records or configure Supabase to fetch live data.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record, rIdx) => {
                  const isCopied = copiedId === record.id;
                  const isChecked = selectedIds.includes(record.id);

                  return (
                    <tr
                      key={record.id || `threat-row-${rIdx}`}
                      onClick={() => handleOpenPopupDetail(record)}
                      className={`hover:bg-slate-800/70 transition-colors cursor-pointer group select-none ${
                        isChecked ? 'bg-amber-500/5' : ''
                      }`}
                      title="Click anywhere on row to view full threat details"
                    >
                      <td className="px-4 py-3.5 w-10" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedIds((prev) => [...prev, record.id]);
                            else setSelectedIds((prev) => prev.filter((id) => id !== record.id));
                          }}
                          className="rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* Phone Column */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <a
                              href={`tel:${record.phone_digits}`}
                              onClick={(e) => e.stopPropagation()}
                              className="font-mono font-bold text-sm text-amber-400 hover:text-amber-300 hover:underline transition"
                            >
                              {record.phone_number}
                            </a>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyPhone(record.id, record.phone_number);
                              }}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition cursor-pointer"
                              title="Copy Phone Number"
                            >
                              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>

                            {isWhatsAppThreat(record) && (
                              <a
                                href={`https://wa.me/${record.phone_digits}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 font-semibold inline-flex items-center space-x-1 transition cursor-pointer"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                <span>WhatsApp</span>
                                <ExternalLink className="w-2.5 h-2.5 opacity-80" />
                              </a>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Date Detected */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                        <div className="flex flex-col space-y-0.5">
                          <span>{normalizeToNumericalDate(record.report_date)}</span>
                          <span
                            className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-sans font-semibold tracking-wide w-fit ${
                              isPrizeOrExtendedRetention(record)
                                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {getRetentionLabel(record)}
                          </span>
                        </div>
                      </td>

                      {/* Impersonated Company */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-200 font-semibold">
                        {resolveTargetCompany(record.scammer_name || record.impersonated_company, record.category, record.description)}
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                          {record.category}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-right sm:text-left">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            requireTrackerPass('Change Line Status', () => handleToggleStatus(record));
                          }}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition cursor-pointer shadow-xs ${
                            record.is_down
                              ? 'bg-slate-800/90 text-slate-400 border-slate-700 hover:border-slate-500'
                              : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/35 hover:bg-emerald-500/25'
                          }`}
                        >
                          <span className="inline-flex items-center space-x-1.5">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                record.is_down ? 'bg-slate-500' : 'bg-emerald-400 animate-pulse'
                              }`}
                            />
                            <span>{record.is_down ? 'Out of Service' : 'Active Line'}</span>
                          </span>
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

      {/* ======================================================== */}
      {/* CSV IMPORT MODAL                                         */}
      {/* ======================================================== */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl p-6 relative space-y-4">
            <button
              onClick={() => {
                setIsImportModalOpen(false);
                setImportFile(null);
                setImportPreview(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2">
              <Upload className="w-5 h-5 text-blue-400" />
              <h2 className="text-base font-bold text-slate-100">Import CSV Threat Records</h2>
            </div>

            <p className="text-xs text-slate-400">
              Upload any CSV exported from Excel or Google Sheets. Records are automatically parsed, verified, saved to the backend, and synchronized directly with Supabase!
            </p>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-amber-500/60 bg-slate-950/60 hover:bg-slate-950 p-6 rounded-xl flex flex-col items-center justify-center space-y-2 cursor-pointer transition"
            >
              <FileSpreadsheet className="w-8 h-8 text-amber-400" />
              <div className="text-center">
                <span className="text-xs font-semibold text-slate-200">
                  {importFile ? importFile.name : 'Click to select or drag .csv file here'}
                </span>
                <p className="text-[10px] text-slate-500 mt-0.5">Supports all column naming variations</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleCSVFileSelect(f);
                }}
              />
            </div>

            {importError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 rounded-xl flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{importError}</span>
              </div>
            )}

            {importPreview && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 p-3.5 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between text-emerald-300 font-semibold">
                  <span className="flex items-center space-x-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>{importPreview.valid.length} valid numbers ready</span>
                  </span>
                </div>

                <div className="text-[11px] text-slate-300 bg-slate-950/80 p-2 rounded-lg font-mono max-h-24 overflow-y-auto space-y-1">
                  {importPreview.valid.slice(0, 5).map((r, i) => (
                    <div key={i} className="truncate">
                      <span className="text-amber-400">{r.phone_number}</span> — {r.impersonated_company} ({r.category})
                    </div>
                  ))}
                  {importPreview.valid.length > 5 && (
                    <div className="text-slate-500 text-[10px]">...and {importPreview.valid.length - 5} more</div>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                disabled={isImporting}
                onClick={() => setIsImportModalOpen(false)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!importPreview || importPreview.valid.length === 0 || isImporting}
                onClick={handleConfirmImport}
                className="px-5 py-2 bg-blue-500 hover:bg-blue-400 text-white font-bold rounded-xl text-xs transition shadow disabled:opacity-40 cursor-pointer flex items-center space-x-1.5"
              >
                {isImporting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{isImporting ? 'Saving & Syncing...' : `Import ${importPreview?.valid.length} Numbers`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* THREAT DETAIL / EDIT POPUP MODAL                         */}
      {/* ======================================================== */}
      {selectedDetailRecord && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => {
            if (!isEditingInPopup) setSelectedDetailRecord(null);
          }}
        >
          <div
            className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl p-6 relative space-y-4 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                  THREAT INTEL RECORD
                </span>
                <h2 className="text-lg font-bold text-slate-100 mt-1">
                  {selectedDetailRecord.impersonated_company}
                </h2>
              </div>
              <button
                onClick={() => setSelectedDetailRecord(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!isEditingInPopup ? (
              <div className="space-y-4 text-xs">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase block">Dialable Number</span>
                    <a
                      href={`tel:${selectedDetailRecord.phone_digits}`}
                      className="font-mono text-base font-bold text-amber-400 hover:underline"
                    >
                      {selectedDetailRecord.phone_number}
                    </a>
                  </div>
                  <div className="flex items-center space-x-2">
                    {isWhatsAppThreat(selectedDetailRecord) && (
                      <span className="px-2.5 py-1 rounded-lg text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold inline-flex items-center space-x-1">
                        <span>WhatsApp Verified</span>
                      </span>
                    )}
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                        selectedDetailRecord.is_down
                          ? 'bg-slate-800 text-slate-400 border border-slate-700'
                          : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {selectedDetailRecord.is_down ? 'Out of Service' : 'Active Line'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase block">Category</span>
                    <span className="text-slate-200 font-semibold">{selectedDetailRecord.category}</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase block">Date Detected</span>
                    <span className="text-slate-200 font-mono">{normalizeToNumericalDate(selectedDetailRecord.report_date)}</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase block">Source / Platform</span>
                    <span className="text-slate-200 font-semibold">{selectedDetailRecord.source_name}</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase block">Invoice / Demanded Fee</span>
                    <span className="text-amber-400 font-mono font-bold">
                      {selectedDetailRecord.amount_charged && selectedDetailRecord.amount_charged !== 'N/A'
                        ? selectedDetailRecord.amount_charged
                        : selectedDetailRecord.money_lost
                        ? `$${selectedDetailRecord.money_lost}`
                        : 'None Reported'}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Threat Details & Callback Demands
                  </span>
                  <p className="text-slate-300 leading-relaxed font-sans whitespace-pre-wrap">
                    {selectedDetailRecord.description}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => requireTrackerPass('Edit Monitored Threat Post', () => setIsEditingInPopup(true))}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition shadow flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Post Details</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleStatus(selectedDetailRecord)}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs transition cursor-pointer"
                  >
                    Toggle Status ({selectedDetailRecord.is_down ? 'Mark Active' : 'Mark Out of Service'})
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Phone Number *</label>
                  <input
                    type="text"
                    value={popupEditForm.phone_number || ''}
                    onChange={(e) => setPopupEditForm({ ...popupEditForm, phone_number: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono text-xs focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Impersonated Entity / Caller</label>
                  <input
                    type="text"
                    value={popupEditForm.impersonated_company || ''}
                    onChange={(e) => setPopupEditForm({ ...popupEditForm, impersonated_company: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Category</label>
                  <input
                    type="text"
                    value={popupEditForm.category || ''}
                    onChange={(e) => setPopupEditForm({ ...popupEditForm, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Threat Description</label>
                  <textarea
                    rows={3}
                    value={popupEditForm.description || ''}
                    onChange={(e) => setPopupEditForm({ ...popupEditForm, description: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsEditingInPopup(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSavePopupEdit}
                    className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition shadow flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save to Supabase & Shared DB</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ADMIN AUTH MODAL                                         */}
      {/* ======================================================== */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl p-6 relative space-y-4">
            <button
              onClick={() => {
                setIsPasswordModalOpen(false);
                setPendingAction(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-100">Administrator Authorization</h2>
                <p className="text-[11px] text-slate-400">Action: <strong className="text-amber-400">{passwordActionName}</strong></p>
              </div>
            </div>

            {passwordError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-2.5 rounded-xl flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handleVerifyPassword} className="space-y-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1 text-xs">
                  Enter Admin Password (e.g. admin123)
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  placeholder="Enter password..."
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsPasswordModalOpen(false);
                    setPendingAction(null);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition shadow flex items-center space-x-1.5 cursor-pointer"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Authorize Action</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SUPABASE DIAGNOSTIC & RLS MODAL                          */}
      {/* ======================================================== */}
      <SupabaseDiagnosticModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        localRecords={records}
        onSyncComplete={(pulled) => {
          setRecords((prev) => deduplicateThreatRecordsList([...pulled, ...prev]).sort(compareThreatDatesDesc));
          setStatusNotification(`Reconciled ${pulled.length} records from Supabase database!`);
        }}
      />

      {/* Report Scam Modal */}
      {isReportModalOpen && (
        <ReportScamPage
          isModal={true}
          onCloseModal={() => setIsReportModalOpen(false)}
          onRecordCreated={(rec) => {
            setRecords((prev) => deduplicateThreatRecordsList([rec, ...prev]).sort(compareThreatDatesDesc));
            setStatusNotification(`Added new report for ${rec.phone_number}!`);
          }}
        />
      )}

      {/* ======================================================== */}
      {/* MULTI-MODEL SCAN SUMMARY REPORT MODAL                    */}
      {/* ======================================================== */}
      {isScanSummaryOpen && scanSummary && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-2xl shadow-2xl p-6 relative my-8 space-y-4">
            <button
              onClick={() => setIsScanSummaryOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-100">
                  Scan Execution Report & Gemini Model Rotation
                </h2>
                <p className="text-xs text-slate-400">
                  Scanned across {scanSummary.totalScans} targets rotating through available Gemini models to lighten API limits.
                </p>
              </div>
            </div>

            {/* Quota Lightening Metric Cards */}
            <div className="grid grid-cols-3 gap-2.5 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase block">Targets Scanned</span>
                <span className="text-lg font-bold text-slate-100">{scanSummary.totalScans} Targets</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase block">Models Rotated</span>
                <span className="text-lg font-bold text-amber-400">{scanSummary.modelsRotated?.length || 5} Models</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase block">Threats Cataloged</span>
                <span className="text-lg font-bold text-emerald-400">+{scanSummary.totalThreatsDiscovered} Discovered</span>
              </div>
            </div>

            {/* Table of Scans Performed */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-300">
                Scans Performed & Models Utilized:
              </span>
              <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="px-3 py-2">Target & Category</th>
                      <th className="px-3 py-2">Gemini Model Used</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Threats Found</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {scanSummary.scanDetails?.map((scan: any, sIdx: number) => (
                      <tr key={sIdx} className="hover:bg-slate-900/50">
                        <td className="px-3 py-2">
                          <p className="font-semibold text-slate-200">{scan.name}</p>
                          <p className="text-[10px] text-slate-400">{scan.category}</p>
                        </td>
                        <td className="px-3 py-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-300 border border-amber-500/20 font-semibold">
                            {scan.modelUsed}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-400 text-[11px]">
                          {scan.status}
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-emerald-400">
                          {scan.threatsFound > 0 ? (
                            <div>
                              <span>+{scan.threatsFound}</span>
                              <div className="text-[10px] text-slate-400 font-normal">
                                {scan.numbers?.slice(0, 2).join(', ')}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-500 font-normal">0 (No new)</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
              <span className="text-slate-200 font-semibold block mb-0.5">Quota Lightening Architecture:</span>
              By rotating requests across <strong>gemini-3.8-flash</strong>, <strong>gemini-3.1-flash-lite</strong>, <strong>gemini-flash-latest</strong>, <strong>gemini-2.5-flash</strong>, and <strong>gemini-2.5-flash-lite</strong>, the threat harvester avoids concentrated per-model rate limits (429 errors) and distributes daily token usage across all available Gemini engines.
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsScanSummaryOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TrackerPage;
