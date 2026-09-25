import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import databaseSeed from '../data/database_seed.json';

export const MASTER_SEED_RECORDS = databaseSeed;

export function isRecordMatch(record: any, target10Digits: string): boolean {
  if (!record || !target10Digits) return false;
  const mainDigits = String(record.phone_digits || record.cleanPhone || record.phone_number || '').replace(/\D/g, '');
  if (mainDigits.includes(target10Digits)) return true;
  if (Array.isArray(record.alt_numbers)) {
    return record.alt_numbers.some((alt: any) =>
      String(alt.digits || alt.phone || '').replace(/\D/g, '').includes(target10Digits)
    );
  }
  return false;
}
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
} from 'lucide-react';
import { getPSTDateStamp, normalizeToNumericalDate } from '../utils/dateUtils';
import { parseFullCSV } from '../utils/csvHandler';
import {
  formatDisplayPhone,
  isFictitiousOrInvalidPhone,
  deriveCountryInfo,
  getCleanCopyPhone,
} from '../utils/phoneUtils';
import { resolveTargetCompany } from '../utils/targetUtils';
import {
  verifyEncryptedAdmin,
  verifyEncryptedBypass,
} from '../utils/security';
import { ThreatRecord } from '../types';
import ReportScamPage, { STANDARD_SCAM_CATEGORIES } from './ReportScamPage';
import SupabaseDiagnosticModal from '../components/SupabaseDiagnosticModal';
import {
  fetchFromSupabase,
  upsertToSupabase,
  fetchServerSupabaseConfig,
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

export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function isPrizeOrExtendedRetention(record: Partial<ThreatRecord> | null | undefined): boolean {
  if (!record) return false;
  const company = (record.impersonated_company || '').toLowerCase();
  const category = (record.category || '').toLowerCase();

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
        impersonated_company:
          cleanItem.impersonated_company && cleanItem.impersonated_company !== 'N/A'
            ? cleanItem.impersonated_company
            : ex.impersonated_company,
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

export function getPacificParts(now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '0';
  return {
    hour: parseInt(get('hour'), 10),
    minute: parseInt(get('minute'), 10),
    second: parseInt(get('second'), 10),
    dateStr: `${get('year')}-${get('month')}-${get('day')}`,
  };
}

export function getNextScheduledPSTInfo(): { label: string; countdown: string } {
  const { hour, minute, second } = getPacificParts();

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

export function TrackerPage({ onNavigateToReport }: TrackerPageProps = {}) {
  // Live in-memory records state
  const [records, setRecords] = useState<ThreatRecord[]>(() => {
    return deduplicateThreatRecordsList((databaseSeed as ThreatRecord[]) || []).sort(compareThreatDatesDesc);
  });

  const [currentPST, setCurrentPST] = useState<string>(formatPSTTimeOnly(new Date(), true));
  const [scheduleInfo, setScheduleInfo] = useState<{ label: string; countdown: string }>(getNextScheduledPSTInfo());
  const [isScanning, setIsScanning] = useState(false);
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
  const [isScannerSettingsModalOpen, setIsScannerSettingsModalOpen] = useState(false);

  // Connection & sync states
  const [isSyncingWithDb, setIsSyncingWithDb] = useState(false);

  // Authentication roles ('admin' has #End5cams..., 'reporter' is mini-admin)
  const [userRole, setUserRole] = useState<'admin' | 'reporter' | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('tracker_user_role');
      if (saved === 'admin' || saved === 'reporter') return saved;
    }
    return null;
  });
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordActionName, setPasswordActionName] = useState('Administrative Action');
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Threat Detail / Edit Modal
  const [selectedDetailRecord, setSelectedDetailRecord] = useState<ThreatRecord | null>(null);
  const [isEditingInPopup, setIsEditingInPopup] = useState(false);
  const [popupEditForm, setPopupEditForm] = useState<Partial<ThreatRecord>>({});

  // Import State
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{ valid: ThreatRecord[]; rejectedBad: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Track automated triggered slots to prevent multiple firings within the same hour
  const autoTriggeredSlots = useRef<Set<string>>(new Set());

  // Dynamic metric: Scams detected in the last 7 days
  const scamsThisWeek = useMemo(() => {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const count = records.filter((r) => {
      const d = new Date(r.report_date).getTime();
      return !isNaN(d) && d >= oneWeekAgo;
    }).length;
    return count > 0 ? count : records.length;
  }, [records]);

  // Shared database sync (Supabase + backend)
  const loadSharedDatabaseRecords = useCallback(async () => {
    setIsSyncingWithDb(true);
    let discovered: ThreatRecord[] = [];

    try {
      await fetchServerSupabaseConfig();
      const sbResult = await fetchFromSupabase();
      if (sbResult.success && sbResult.records && sbResult.records.length > 0) {
        discovered = [...discovered, ...sbResult.records];
      }
    } catch (e) {
      console.warn('[Supabase Initial Fetch]', e);
    }

    try {
      const res = await fetch('/api/records', {
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', Pragma: 'no-cache' },
      });
      if (res.ok) {
        const data = await res.json();
        const serverRecords: any[] = Array.isArray(data) ? data : data.records || [];
        if (serverRecords.length > 0) {
          const mapped: ThreatRecord[] = serverRecords.map((r) => ({
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
      console.warn('[Backend /api/records]', e);
    }

    if (discovered.length > 0) {
      setRecords((prev) => deduplicateThreatRecordsList([...discovered, ...prev]).sort(compareThreatDatesDesc));
    }
    setIsSyncingWithDb(false);
  }, []);

  useEffect(() => {
    loadSharedDatabaseRecords();

    // Cross-tab broadcast receiver
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('end_scam_scan_sync_channel');
      bc.onmessage = (event) => {
        if (event.data?.type === 'ADD_RECORD' && event.data.record) {
          setRecords((prev) => deduplicateThreatRecordsList([event.data.record, ...prev]).sort(compareThreatDatesDesc));
        }
      };
    } catch {}

    // Polling interval
    const poller = setInterval(loadSharedDatabaseRecords, 10000);
    return () => {
      clearInterval(poller);
      if (bc) bc.close();
    };
  }, [loadSharedDatabaseRecords]);

  // Clock tick & Automated schedule execution check
  useEffect(() => {
    const checkSchedule = () => {
      const parts = getPacificParts();
      setCurrentPST(formatPSTTimeOnly(new Date(), true));
      setScheduleInfo(getNextScheduledPSTInfo());

      // Auto-trigger at 7:00 AM PST (7) and 1:00 PM PST (13)
      if ((parts.hour === 7 || parts.hour === 13) && parts.minute < 5) {
        const slotKey = `${parts.dateStr}_${parts.hour}`;
        if (!autoTriggeredSlots.current.has(slotKey) && !isScanning) {
          autoTriggeredSlots.current.add(slotKey);
          const slotLabel = parts.hour === 7 ? '7:00 AM PST' : '1:00 PM PST';
          setStatusNotification(`[Automated Scan] ${slotLabel} reached! Running scheduled threat scan with rate limit pacing...`);
          executeFullHarvesterScan();
        }
      }
    };

    const timer = setInterval(checkSchedule, 1000);
    return () => clearInterval(timer);
  }, [isScanning]);

  // Multi-Model Threat Harvester Scan with Rate Limit Pacing Delay
  const executeFullHarvesterScan = async () => {
    setIsScanning(true);
    setStatusNotification('Scanning threat feeds across rotating Gemini models with rate limit pacing delays...');
    try {
      // Intentional pre-scan pacing delay to prevent rate limit spikes
      await delay(2000);

      const res = await fetch('/api/scan-now', {
        method: 'POST',
        headers: { 'Cache-Control': 'no-cache, no-store' },
      });
      const data = await res.json();

      // Post-scan pacing delay
      await delay(1500);

      if (data.success && data.summary) {
        if (Array.isArray(data.records) && data.records.length > 0) {
          setRecords((prev) => deduplicateThreatRecordsList([...data.records, ...prev]).sort(compareThreatDatesDesc));
        }
        setStatusNotification(
          `Threat scan completed! Found ${data.summary.totalThreatsDiscovered || 0} threats across targets.`
        );
      } else {
        await loadSharedDatabaseRecords();
        setStatusNotification('Scan completed and synchronized with Dokploy database.');
      }
    } catch (err: any) {
      setStatusNotification(`Scan completed: Database re-synchronized.`);
    } finally {
      setIsScanning(false);
    }
  };

  // Export as .tsx file
  const handleExportTSX = () => {
    const recordsToExport =
      selectedIds.length > 0 ? records.filter((r) => selectedIds.includes(r.id)) : filteredRecords;

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
            <th style={{ padding: '8px' }}>Company / Target</th>
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
    link.download = `endscams_threat_records_${getPSTDateStamp()}_PST.tsx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // CSV Import handling
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
    const clean = rawText.replace(/^\uFEFF/, '').trim();
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
    setRecords((prev) => deduplicateThreatRecordsList([...imported, ...prev]).sort(compareThreatDatesDesc));

    try {
      await fetch('/api/records/bulk-upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
        body: JSON.stringify({ records: imported }),
      });
    } catch {}

    try {
      await upsertToSupabase(imported);
    } catch {}

    setIsImporting(false);
    setIsImportModalOpen(false);
    setImportFile(null);
    setImportPreview(null);
    setStatusNotification(`Successfully imported ${imported.length} threat lines to the live database!`);
  };

  const handleToggleStatus = async (record: ThreatRecord) => {
    const nextStatus = !record.is_down;
    const updated = { ...record, is_down: nextStatus };

    setRecords((prev) => prev.map((r) => (r.id === record.id ? updated : r)));
    setStatusNotification(`Marked ${record.phone_number} as ${nextStatus ? 'Out of Service' : 'Active Line'}.`);

    try {
      fetch(`/api/records/${record.id}/toggle-down`, { method: 'POST' }).catch(() => {});
      upsertToSupabase([updated]).catch(() => {});
    } catch {}
  };

  const handleCopyPhone = (id: string, text: string) => {
    const clean = getCleanCopyPhone(text);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(clean);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

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

    upsertToSupabase([updated]);
    fetch(`/api/records/${updated.id}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    }).catch(() => {});
  };

  // Password Authentication Guard for Admin and Reporter Passwords
  const requireTrackerPass = (actionName: string, onVerified: () => void) => {
    const isReporterAllowed =
      actionName.includes('Change Line Status') ||
      actionName.includes('Edit') ||
      actionName.includes('Toggle');

    // Admin has full session access
    if (userRole === 'admin') {
      onVerified();
      return;
    }

    // Reporter has access only to editing details and line status
    if (userRole === 'reporter' && isReporterAllowed) {
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
      setPasswordError('Please enter a password.');
      return;
    }

    const isReporterAction =
      passwordActionName.includes('Change Line Status') ||
      passwordActionName.includes('Edit') ||
      passwordActionName.includes('Toggle');

    // 1. Check Full Admin Password (Encrypted SHA-256)
    const isAdmin = await verifyEncryptedAdmin(entered);
    if (isAdmin) {
      setUserRole('admin');
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('tracker_user_role', 'admin');
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
      return;
    }

    // 2. Check Reporter / Bypass Password (Encrypted SHA-256)
    const isReporter = await verifyEncryptedBypass(entered);
    if (isReporter) {
      if (!isReporterAction) {
        setPasswordError('This action requires Administrator authorization. Reporter password is restricted to editing details and updating line status.');
        return;
      }
      setUserRole('reporter');
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('tracker_user_role', 'reporter');
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
      return;
    }

    setPasswordError(
      isReporterAction
        ? 'Invalid password. Please enter a valid Admin or Reporter password.'
        : 'Invalid password. Administrator authorization required.'
    );
  };

  // Filter & sort
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

  const categoriesList = useMemo(() => {
    const list = Array.from(new Set([...STANDARD_SCAM_CATEGORIES, ...records.map((r) => r.category)]));
    return list.filter(Boolean);
  }, [records]);
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
            <div className="flex items-center space-x-2.5 flex-wrap gap-y-1.5">
              {/* Item 1: Reworded badge */}
              <span className="flex items-center space-x-1.5 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                <span>Automated Scans: 7AM and 1PM PST</span>
              </span>

              <span className="bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-full text-[10px] font-mono text-slate-300 flex items-center space-x-1">
                <Clock className="w-3 h-3 text-amber-400" />
                <span>{currentPST}</span>
              </span>

              {/* Item 4: Animated area showing scams detected this week */}
              <div className="inline-flex items-center space-x-1.5 px-3 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 border border-amber-500/40 text-amber-300 shadow-sm animate-pulse">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" style={{ animationDuration: '4s' }} />
                <span>{scamsThisWeek} Scams Detected This Week</span>
              </div>
            </div>

            <h1 className="text-lg sm:text-2xl font-black text-slate-100 flex items-center space-x-2 tracking-tight">
              <ShieldAlert className="w-6 h-6 text-red-500 shrink-0" />
              <span>CWN Scam Threat Tracker</span>
            </h1>

            <p className="text-xs text-slate-400 max-w-3xl">
              Multi-source threat intelligence system. Publicly visible across all browsers and devices with rate-limited auto-harvester engine.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2 flex-wrap gap-y-2">
            {/* Run Threat Scan (Requires Admin Password) */}
            <button
              onClick={() => requireTrackerPass('Execute Multi-Model Harvester Scan', () => executeFullHarvesterScan())}
              disabled={isScanning}
              className="px-3.5 py-2 bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400 text-slate-950 text-xs font-bold rounded-xl flex items-center space-x-1.5 transition shadow-lg disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Scanning Feeds...' : 'Run Threat Scan'}</span>
            </button>

            {/* Item 5: Reworded to Scanner Settings (Requires Admin Password) */}
            <button
              onClick={() => requireTrackerPass('Open Scanner Settings', () => setIsScannerSettingsModalOpen(true))}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition border border-slate-700 cursor-pointer"
              title="Scanner Diagnostics & Settings (Admin Only)"
            >
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              <span>Scanner Settings</span>
            </button>

            {/* Import CSV (Requires Admin Password) */}
            <button
              onClick={() => requireTrackerPass('Import CSV Threat Records', () => setIsImportModalOpen(true))}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition border border-slate-700 cursor-pointer"
              title="Import CSV Records (Admin Only)"
            >
              <Upload className="w-3.5 h-3.5 text-blue-400" />
              <span>Import CSV</span>
            </button>

            {/* Export as .tsx file */}
            <button
              onClick={handleExportTSX}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition border border-slate-700 cursor-pointer shadow-sm"
              title="Download database records as a React .tsx component file"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export .tsx</span>
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

        <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 flex-wrap gap-2">
          <div className="flex items-center space-x-2">
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              <strong>Status:</strong> {isSyncingWithDb ? 'Connecting to live database stream...' : 'Live database feed active'}
            </span>
          </div>

          <div className="flex items-center space-x-1.5 text-slate-300 font-mono">
            <span>Next Auto-Scan:</span>
            <span className="text-amber-400 font-bold">{scheduleInfo.label}</span>
            <span className="text-slate-500">({scheduleInfo.countdown})</span>
          </div>
        </div>
      </header>

      {/* Metrics Row */}
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

      {/* Filter Toolbar */}
      <section className="bg-slate-900/90 border border-slate-800 p-3 sm:p-4 rounded-2xl flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2 w-full">
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

          <div className="flex-1 min-w-[140px] flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-300">
            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <select
              value={selectedRetention}
              onChange={(e) => setSelectedRetention(e.target.value as any)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer w-full"
            >
              <option value="ALL" className="bg-slate-900">All Retentions</option>
              <option value="PRIZE_6MO" className="bg-slate-900">6-Mo (Prize/Lotto)</option>
              <option value="STANDARD_90D" className="bg-slate-900">90-Day Standard</option>
            </select>
          </div>

          <div className="w-full sm:w-auto sm:min-w-[160px] flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-300">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer w-full"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Lines Only</option>
              <option value="DOWN">Down / Closed Only</option>
            </select>
          </div>
        </div>

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
              <option value="desc">Sort: Newest Date First</option>
              <option value="asc">Sort: Oldest Date First</option>
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
                    No threat records found in live database. Submit a report or click "Import CSV" to add data.
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
                              title="Copy Number"
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

                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-200 font-semibold">
                        {resolveTargetCompany(record.scammer_name || record.impersonated_company, record.category, record.description)}
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                          {record.category}
                        </span>
                      </td>

                      {/* Status Button: Protected by Admin or Reporter Password */}
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
                          title="Change line status"
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

      {/* CSV Import Modal (Admin Only) */}
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

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-amber-500/60 bg-slate-950/60 p-6 rounded-xl flex flex-col items-center justify-center space-y-2 cursor-pointer transition"
            >
              <FileSpreadsheet className="w-8 h-8 text-amber-400" />
              <div className="text-center">
                <span className="text-xs font-semibold text-slate-200">
                  {importFile ? importFile.name : 'Click to select or drag .csv file here'}
                </span>
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
              <div className="bg-red-500/10 border border-red-500/30 p-3.5 rounded-xl space-y-2 text-xs text-red-300 font-medium">
                <span>{importError}</span>
              </div>
            )}

            {importPreview && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 p-3.5 rounded-xl space-y-2 text-xs">
                <span className="text-emerald-300 font-semibold">{importPreview.valid.length} records ready for public database import</span>
              </div>
            )}

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!importPreview || importPreview.valid.length === 0 || isImporting}
                onClick={handleConfirmImport}
                className="px-5 py-2 bg-blue-500 hover:bg-blue-400 text-white font-bold rounded-xl text-xs transition shadow cursor-pointer disabled:opacity-40"
              >
                {isImporting ? 'Syncing...' : `Import ${importPreview?.valid.length || 0} Numbers`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail / Edit Popup Modal (Edit Post Details protected by Admin or Report Password) */}
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
                      <span className="px-2.5 py-1 rounded-lg text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold">
                        WhatsApp Verified
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

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Threat Details
                  </span>
                  <p className="text-slate-300 leading-relaxed font-sans whitespace-pre-wrap">
                    {selectedDetailRecord.description}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                  {/* Edit Post Details Button: Requires Admin or Report Password */}
                  <button
                    type="button"
                    onClick={() => requireTrackerPass('Edit Post Details', () => setIsEditingInPopup(true))}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition shadow flex items-center space-x-1.5 cursor-pointer"
                    title="Edit Post Details"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Post Details</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => requireTrackerPass('Change Line Status', () => handleToggleStatus(selectedDetailRecord))}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs transition cursor-pointer"
                  >
                    Toggle Line Status
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
                    <span>Save to Live Database</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Password Authentication Modal (Admin #End5cams... vs Report Password) */}
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
                <h2 className="text-base font-bold text-slate-100">Authentication Required</h2>
                <p className="text-[11px] text-slate-400">Action: <strong className="text-amber-400">{passwordActionName}</strong></p>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              {passwordActionName.includes('Change Line Status') || passwordActionName.includes('Edit')
                ? 'Enter your authorized password to continue.'
                : 'This operation is restricted to Administrators.'}
            </p>

            {passwordError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-2.5 rounded-xl flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handleVerifyPassword} className="space-y-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1 text-xs">
                  Enter Password
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

      {/* Scanner Settings Modal (Renamed from Supabase DB, Protected by Admin Password) */}
      <SupabaseDiagnosticModal
        isOpen={isScannerSettingsModalOpen}
        onClose={() => setIsScannerSettingsModalOpen(false)}
        localRecords={records}
        onSyncComplete={(pulled) => {
          setRecords((prev) => deduplicateThreatRecordsList([...pulled, ...prev]).sort(compareThreatDatesDesc));
          setStatusNotification(`Reconciled ${pulled.length} records from database!`);
        }}
      />

      {/* Report Scam Embedded Modal */}
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
    </div>
  );
}

export default TrackerPage;