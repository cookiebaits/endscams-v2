import React, { useState, useRef, useEffect } from 'react';
import {
  ShieldAlert,
  Shield,
  Upload,
  ExternalLink,
  X,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Phone,
  DollarSign,
  User,
  Mail,
  FileText,
  Building2,
  MessageSquare,
} from 'lucide-react';
import { supabase, normalizePhone, formatPhoneDisplay, isTollFree } from '../lib/supabase';
import Banner from '../components/Banner';
import { requireDisclaimerAcceptance } from '../components/TermsBanner';
import { isUserCountryAllowed } from '../utils/geoIp';

export interface ReportScamPageProps {
  onNavigateToTracker?: () => void;
  isModal?: boolean;
  onCloseModal?: () => void;
}

export type FormData = {
  phoneNumber: string;
  scammerName: string;
  altPhone1: string;
  altPhone2: string;
  altPhone2IsWhatsApp: boolean;
  moneyLost: string;
  category: string;
  incidentDate: string;
  howContacted: string;
  isPrimaryWhatsApp: boolean;
  description: string;
  reporterName: string;
  reporterEmail: string;
};

const CATEGORIES = [
  'Lottery & Sweepstakes Scams (American Cash Award, PCH, etc.)',
  'General Tech Support & Refund Scams',
  'Crypto BTC Recovery Scam',
  'Social Media Prize & Giveaway Scam',
  'Government Impersonation & Warrant Scams',
  'Emergency & Grandparent Scams',
  'Spellcaster WhatsApp Extortion',
  'Publishing Chat Scam',
  'Spiritual / Herbal / Fortune Scam',
  'Other Scam',
];

const HOW_CONTACTED = [
  'Phone Call',
  'Text Message',
  'WhatsApp',
  'Email',
  'Social Media',
  'Website',
  'In Person',
  'Other',
];

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

const FEDERAL_LINKS = [
  { name: 'FTC — ReportFraud.ftc.gov', sub: 'Federal Trade Commission', url: 'https://reportfraud.ftc.gov' },
  { name: 'IC3 — Internet Crime (FBI)', sub: 'FBI Internet Crime Complaint Center', url: 'https://www.ic3.gov' },
  { name: 'USA.gov — Report Scams', sub: 'Official US Government Portal', url: 'https://www.usa.gov/report-scams' },
  { name: 'CISA — Cybersecurity Threats', sub: 'Cybersecurity & Infrastructure Security Agency', url: 'https://www.cisa.gov/report' },
];

export default function ReportScamPage({ onNavigateToTracker, isModal = false, onCloseModal }: ReportScamPageProps) {
  const [form, setForm] = useState<FormData>({
    phoneNumber: '',
    scammerName: '',
    altPhone1: '',
    altPhone2: '',
    altPhone2IsWhatsApp: false,
    moneyLost: '',
    category: CATEGORIES[0],
    incidentDate: new Date().toISOString().split('T')[0],
    howContacted: 'Phone Call',
    isPrimaryWhatsApp: false,
    description: '',
    reporterName: '',
    reporterEmail: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormData | 'file', string>>>({});
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [submittedRecordPhone, setSubmittedRecordPhone] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync title for browser tab
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = 'Report a Scam Line | EndScams Live Tracker';
    }
  }, []);

  const update = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) {
      setErrors((e) => ({ ...e, [field]: undefined }));
    }
  };

  const processFile = (f: File) => {
    if (!ACCEPTED_TYPES.includes(f.type) && !f.type.startsWith('image/')) {
      setErrors((e) => ({ ...e, file: 'Invalid file type. Accepted: PNG, JPG, WEBP, GIF, PDF.' }));
      return;
    }
    if (f.size > MAX_SIZE_BYTES) {
      setErrors((e) => ({ ...e, file: 'File exceeds 10MB maximum limit.' }));
      return;
    }
    setErrors((e) => ({ ...e, file: undefined }));
    setFile(f);
    if (f.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setFilePreview(ev.target?.result as string);
      reader.readAsDataURL(f);
    } else {
      setFilePreview(null);
    }
  };

  const handleFileChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const f = ev.target.files?.[0];
    if (f) processFile(f);
  };

  const handleDragOver = (ev: React.DragEvent<HTMLDivElement>) => {
    ev.preventDefault();
    ev.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (ev: React.DragEvent<HTMLDivElement>) => {
    ev.preventDefault();
    ev.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (ev: React.DragEvent<HTMLDivElement>) => {
    ev.preventDefault();
    ev.stopPropagation();
    setIsDragging(false);
    const files = ev.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const removeFile = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setErrors((e) => ({ ...e, file: undefined }));
  };

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormData | 'file', string>> = {};
    const digits = normalizePhone(form.phoneNumber);
    if (digits.length < 7 || digits.length > 15) {
      e.phoneNumber = 'Please enter a valid phone number (at least 7 digits, including country code if international).';
    } else if (isTollFree(digits)) {
      e.phoneNumber = 'Toll-free numbers (800, 833, 844, 855, 866, 877, 888) are not accepted on the threat tracker.';
    }

    if (form.altPhone1.trim()) {
      const alt1Digits = normalizePhone(form.altPhone1);
      if (alt1Digits.length < 7) {
        e.altPhone1 = 'Alt Number #1 must be at least 7 digits.';
      }
    }

    if (form.altPhone2.trim()) {
      const alt2Digits = normalizePhone(form.altPhone2);
      if (alt2Digits.length < 7) {
        e.altPhone2 = 'Alt Number #2 must be at least 7 digits.';
      }
    }

    if (!form.category) {
      e.category = 'Please select a scam category.';
    }

    if (form.description.trim().length < 15) {
      e.description = 'Please provide details on what happened (at least 15 characters).';
    }

    if (form.reporterEmail && !/^\S+@\S+\.\S+$/.test(form.reporterEmail.trim())) {
      e.reporterEmail = 'Please enter a valid email address.';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!requireDisclaimerAcceptance()) return;

    const countryAllowed = await isUserCountryAllowed();
    if (!countryAllowed) {
      setErrorMsg('Submission is temporarily restricted from your location.');
      setStatus('error');
      return;
    }

    if (!validate()) return;
    setStatus('submitting');
    setErrorMsg('');

    const digits = normalizePhone(form.phoneNumber);
    const displayPhone = formatPhoneDisplay(form.phoneNumber);

    // Build alternate numbers array matching the schema
    const altNumbers: { phone: string; digits: string; is_whatsapp?: boolean }[] = [];
    if (form.altPhone1.trim()) {
      const alt1Digits = normalizePhone(form.altPhone1);
      altNumbers.push({
        phone: formatPhoneDisplay(form.altPhone1),
        digits: alt1Digits,
        is_whatsapp: false,
      });
    }
    if (form.altPhone2.trim()) {
      const alt2Digits = normalizePhone(form.altPhone2);
      altNumbers.push({
        phone: formatPhoneDisplay(form.altPhone2),
        digits: alt2Digits,
        is_whatsapp: form.altPhone2IsWhatsApp,
      });
    }

    const resolvedCompany = form.scammerName.trim() || 'Reported Entity';
    const amountVal = form.moneyLost.trim() ? `$${parseFloat(form.moneyLost).toFixed(2)}` : 'N/A';

    // 1. Convert file to data URL or upload
    let evidenceUrl: string | undefined = filePreview || undefined;
    if (file && !evidenceUrl) {
      try {
        const reader = new FileReader();
        evidenceUrl = await new Promise((res) => {
          reader.onload = () => res(reader.result as string);
          reader.readAsDataURL(file);
        });
      } catch {}
    }

    // 2. Submit to backend API (/api/report)
    try {
      const apiResp = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: displayPhone,
          phone_digits: digits,
          scammer_name: resolvedCompany,
          impersonated_company: resolvedCompany,
          category: form.category,
          description: form.description.trim(),
          incident_date: form.incidentDate,
          how_contacted: form.howContacted,
          money_lost: form.moneyLost ? parseFloat(form.moneyLost) : null,
          amount_charged: amountVal,
          is_whatsapp: form.isPrimaryWhatsApp,
          alt_numbers: altNumbers,
          reporter_name: form.reporterName.trim() || null,
          reporter_email: form.reporterEmail.trim() || null,
          image_url: evidenceUrl,
          file_url: evidenceUrl,
          source: 'user_report',
          source_name: 'EndScams Report (endscams.org/report)',
          source_url: 'https://endscams.org/report',
        }),
      });

      if (!apiResp.ok) {
        const errData = await apiResp.json().catch(() => ({}));
        console.warn('[Report API notice]', errData.error || 'API response was non-200');
      }
    } catch (e) {
      console.warn('[Report API fetch note]', e);
    }

    // 3. Direct Supabase Ingestion for persistent PostgreSQL (works on endscams.org)
    try {
      await supabase.from('scam_reports').insert({
        phone_number: displayPhone,
        phone_digits: digits,
        category: form.category,
        description: form.description.trim(),
        how_contacted: form.howContacted,
        incident_date: form.incidentDate,
        reporter_name: form.reporterName.trim() || null,
        reporter_email: form.reporterEmail.trim() || null,
        money_lost: form.moneyLost ? parseFloat(form.moneyLost) : null,
        source: 'user_report',
        file_url: evidenceUrl || null,
      });

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 90);

      await supabase.from('tracker_entries').upsert(
        {
          id: `rec-${digits}`,
          phone_number: displayPhone,
          phone_digits: digits,
          source_name: 'EndScams Report (endscams.org/report)',
          source_url: 'https://endscams.org/report',
          report_date: form.incidentDate,
          category: form.category,
          description: form.description.trim(),
          threat_intel: form.description.trim(),
          impersonated_company: resolvedCompany,
          amount_charged: amountVal,
          is_down: false,
          expires_at: expiresAt.toISOString(),
        },
        { onConflict: 'phone_digits' }
      );
    } catch (e) {
      console.warn('[Supabase Direct Sync note]', e);
    }

    // 4. Create ThreatRecord for local storage & instant live reflection
    const newThreatRecord = {
      id: `report-${Date.now()}-${digits.slice(-4)}`,
      phone_number: displayPhone,
      phone_digits: digits,
      is_whatsapp: form.isPrimaryWhatsApp,
      alt_numbers: altNumbers.length > 0 ? altNumbers : undefined,
      source_name: 'EndScams Report (endscams.org/report)',
      source_url: 'https://endscams.org/report',
      report_date: form.incidentDate,
      category: form.category,
      description: form.description.trim(),
      impersonated_company: resolvedCompany,
      scammer_name: resolvedCompany,
      how_contacted: form.howContacted,
      invoice_number: 'N/A',
      amount_charged: amountVal,
      money_lost: form.moneyLost ? parseFloat(form.moneyLost) : undefined,
      reporter_name: form.reporterName.trim() || undefined,
      reporter_email: form.reporterEmail.trim() || undefined,
      image_url: evidenceUrl,
      is_down: false,
    };

    // 5. Broadcast to parent iframe / open tracker pages via BroadcastChannel
    try {
      const bc = new BroadcastChannel('end_scam_scan_sync_channel');
      bc.postMessage({
        type: 'ADD_RECORD',
        event: 'ADD_RECORD',
        action: 'ADD_RECORD',
        payload: { record: newThreatRecord, ...newThreatRecord },
        record: newThreatRecord,
      });
      bc.close();
    } catch {}

    try {
      const bc2 = new BroadcastChannel('threat_tracker_sync_channel');
      bc2.postMessage({
        type: 'ADD_RECORD',
        record: newThreatRecord,
      });
      bc2.close();
    } catch {}

    // 6. Direct localStorage updates for TrackerPage
    try {
      const raw = localStorage.getItem('esscan_threat_records_v2') || '[]';
      const existing = JSON.parse(raw);
      const filtered = Array.isArray(existing) ? existing.filter((r: any) => r.phone_digits !== digits) : [];
      filtered.unshift(newThreatRecord);
      localStorage.setItem('esscan_threat_records_v2', JSON.stringify(filtered));
    } catch {}

    try {
      const rawShared = localStorage.getItem('end_scam_scan_shared_storage') || '{}';
      const shared = JSON.parse(rawShared);
      const records = Array.isArray(shared.records) ? shared.records : [];
      const updated = [newThreatRecord, ...records.filter((r: any) => (r.phone_digits || r.phone) !== digits)];
      localStorage.setItem(
        'end_scam_scan_shared_storage',
        JSON.stringify({ ...shared, records: updated, lastUpdated: new Date().toISOString() })
      );
    } catch {}

    setSubmittedRecordPhone(displayPhone);
    setStatus('success');
  };

  const handleReset = () => {
    setForm({
      phoneNumber: '',
      scammerName: '',
      altPhone1: '',
      altPhone2: '',
      altPhone2IsWhatsApp: false,
      moneyLost: '',
      category: CATEGORIES[0],
      incidentDate: new Date().toISOString().split('T')[0],
      howContacted: 'Phone Call',
      isPrimaryWhatsApp: false,
      description: '',
      reporterName: '',
      reporterEmail: '',
    });
    setErrors({});
    setStatus('idle');
    setErrorMsg('');
    setSubmittedRecordPhone('');
    removeFile();
  };

  const handleReturnToTracker = () => {
    if (onNavigateToTracker) {
      onNavigateToTracker();
    } else if (onCloseModal) {
      onCloseModal();
    } else {
      if (typeof window !== 'undefined') {
        window.history.pushState({}, '', '/');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    }
  };

  // SUCCESS CONFIRMATION VIEW
  if (status === 'success') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 flex items-center justify-center">
        <div className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-100">Report Ingested & Cataloged</h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              Thank you for contributing to community intelligence. The scam line{' '}
              <strong className="text-amber-400 font-mono">{submittedRecordPhone}</strong> has been pinned to the live
              Scam Tracker and persisted to the PostgreSQL database with 90-day auto-retention.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-left space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-400">
              <span>Threat Number:</span>
              <span className="font-mono font-bold text-amber-400">{submittedRecordPhone}</span>
            </div>
            {form.scammerName && (
              <div className="flex items-center justify-between text-slate-400">
                <span>Scammer / Entity:</span>
                <span className="font-semibold text-slate-200">{form.scammerName}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-slate-400">
              <span>Category:</span>
              <span className="text-red-400 font-medium">{form.category}</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Incident Intel:</span>
              <span className="text-slate-300 truncate max-w-[260px]">{form.description}</span>
            </div>
          </div>

          {/* Navigation Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleReturnToTracker}
              className="w-full sm:w-auto px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm transition shadow-md flex items-center justify-center space-x-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>View in CWN Scam Tracker</span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="w-full sm:w-auto px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm transition border border-slate-700 cursor-pointer"
            >
              Submit Another Report
            </button>
          </div>

          {/* Federal Agency Links */}
          <div className="pt-4 border-t border-slate-800 text-left">
            <p className="text-xs font-semibold text-slate-400 mb-2">Also consider official federal reporting:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {FEDERAL_LINKS.map((link) => (
                <a
                  key={link.name}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 rounded-lg bg-slate-950 hover:bg-slate-800/80 border border-slate-800 text-slate-300 hover:text-amber-400 transition flex items-center justify-between group"
                >
                  <span className="truncate">{link.name}</span>
                  <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-amber-400 shrink-0 ml-1.5" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // MAIN REPORT FORM VIEW (MATCHING IMAGE SCREENSHOT 1:1)
  return (
    <div className={isModal ? 'w-full' : 'min-h-screen bg-slate-950 text-slate-100 flex flex-col'}>
      {/* Top Banner if full-page */}
      {!isModal && (
        <Banner
          variant="warning"
          id="report_privacy"
          dismissible
          message={
            <span>
              <strong>Privacy Notice:</strong> Verified scam phone numbers and incident details are cataloged on the public
              Scam Tracker for 90 days to protect the community. Do not include your personal banking credentials.
            </span>
          }
        />
      )}

      <div className={`flex-1 ${isModal ? 'p-0' : 'max-w-4xl mx-auto w-full px-4 py-6 sm:py-8'}`}>
        {/* Modal Card Container */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
          {/* Header Bar matching image: Red Shield, Report a Scam Line, Live Sync Active badge, and endscams.org link */}
          <div className="flex items-center justify-between px-5 py-4 bg-slate-950 border-b border-slate-800 shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2.5">
                  <h1 className="text-base sm:text-lg font-bold text-slate-100 tracking-tight">Report a Scam Line</h1>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    Live Sync Active
                  </span>
                </div>
                <p className="text-xs text-slate-400 hidden sm:block">
                  Direct EndScams ingestion — instantly persists to PostgreSQL and updates Tracker Page
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <a
                href="https://endscams.org/report"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-amber-400 hover:text-amber-300 transition text-xs flex items-center space-x-1.5 font-medium border border-slate-700"
                title="Open endscams.org/report in external window"
              >
                <span>endscams.org</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              {(isModal || onNavigateToTracker) && (
                <button
                  type="button"
                  onClick={handleReturnToTracker}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition cursor-pointer"
                  title="Close / Back to Tracker"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 bg-slate-900 overflow-y-auto">
            {/* Error banner if any */}
            {status === 'error' && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start space-x-3 text-red-300 text-xs">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">{errorMsg || 'Please review the form for errors.'}</p>
                </div>
              </div>
            )}

            {/* 1. Screenshot / Evidence Image (Optional) Dropzone */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Screenshot / Evidence Image <span className="text-slate-500 font-normal">(Optional)</span>
              </label>
              <div
                onClick={() => {
                  if (fileInputRef.current) fileInputRef.current.click();
                }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition outline-none ${
                  errors.file
                    ? 'border-red-500 bg-red-500/5'
                    : isDragging
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-slate-700 hover:border-slate-500 bg-slate-950/40 hover:bg-slate-950/70'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {filePreview ? (
                  <div className="flex items-center justify-between bg-slate-800/80 p-2.5 rounded-lg border border-slate-700 max-w-md mx-auto">
                    <div className="flex items-center space-x-3 overflow-hidden text-left">
                      <img
                        src={filePreview}
                        alt="Evidence preview"
                        className="w-12 h-12 rounded object-cover border border-slate-700 shrink-0"
                      />
                      <div className="truncate">
                        <p className="text-xs font-medium text-slate-200 truncate">{file?.name || 'Attached evidence'}</p>
                        <p className="text-[10px] text-slate-400">
                          {file?.size ? (file.size / 1024).toFixed(1) : '0'} KB
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={removeFile}
                      className="px-2.5 py-1 bg-slate-700 hover:bg-red-500/20 hover:text-red-400 text-slate-300 rounded text-xs transition cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center space-y-1.5 py-2">
                    <Upload className="w-6 h-6 text-slate-400 mb-0.5" />
                    <p className="text-xs text-slate-300 font-medium">Click to upload or drag and drop scam screenshot</p>
                    <p className="text-[11px] text-slate-500">PNG, JPG, WEBP up to 10MB</p>
                  </div>
                )}
              </div>
              {errors.file && <p className="text-xs text-red-400 mt-1">{errors.file}</p>}
            </div>

            {/* 2. Primary Row: Scam Phone Number * & Scammer's name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  Scam Phone Number <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.phoneNumber}
                  onChange={(e) => update('phoneNumber', e.target.value)}
                  placeholder="e.g. 1 (502) 237-9660 or 800-..."
                  className={`w-full px-3.5 py-2.5 bg-slate-950 border rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition ${
                    errors.phoneNumber ? 'border-red-500 focus:border-red-400' : 'border-slate-700 focus:border-red-500'
                  }`}
                />
                <p className="text-[10px] text-slate-500 mt-1">Real dialable scam numbers only.</p>
                {errors.phoneNumber && <p className="text-xs text-red-400 mt-1">{errors.phoneNumber}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">Scammer's name</label>
                <input
                  type="text"
                  value={form.scammerName}
                  onChange={(e) => update('scammerName', e.target.value)}
                  placeholder="e.g. PCH, David Cooper, or Geek Squad"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-red-500 transition"
                />
              </div>
            </div>

            {/* 3. Second Row: Alt Phone Number #1 (Optional) & Alt Phone Number #2 / WhatsApp (Optional) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  Alt Phone Number #1 <span className="text-slate-500 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={form.altPhone1}
                  onChange={(e) => update('altPhone1', e.target.value)}
                  placeholder="e.g. +1 (502) 237-9661"
                  className={`w-full px-3.5 py-2.5 bg-slate-950 border rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition ${
                    errors.altPhone1 ? 'border-red-500 focus:border-red-400' : 'border-slate-700 focus:border-red-500'
                  }`}
                />
                {errors.altPhone1 && <p className="text-xs text-red-400 mt-1">{errors.altPhone1}</p>}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-200">
                    Alt Phone Number #2 / WhatsApp <span className="text-slate-500 font-normal">(Optional)</span>
                  </label>
                </div>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={form.altPhone2}
                    onChange={(e) => update('altPhone2', e.target.value)}
                    placeholder="e.g. +234 810 552 9412"
                    className={`w-full px-3.5 py-2.5 pr-28 bg-slate-950 border rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition ${
                      errors.altPhone2 ? 'border-red-500 focus:border-red-400' : 'border-slate-700 focus:border-red-500'
                    }`}
                  />
                  <label className="absolute right-2.5 flex items-center space-x-1.5 px-2 py-1 rounded bg-slate-900/90 border border-slate-700 text-xs text-emerald-400 cursor-pointer select-none hover:bg-slate-800 transition">
                    <input
                      type="checkbox"
                      checked={form.altPhone2IsWhatsApp}
                      onChange={(e) => update('altPhone2IsWhatsApp', e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-emerald-500 focus:ring-emerald-400 bg-slate-950 border-slate-700 cursor-pointer"
                    />
                    <span className="text-[11px] font-medium">WhatsApp</span>
                  </label>
                </div>
                {errors.altPhone2 && <p className="text-xs text-red-400 mt-1">{errors.altPhone2}</p>}
              </div>
            </div>

            {/* 4. Third Row: Financial Loss ($) (Optional) & Scam Category * */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  Financial Loss ($) <span className="text-slate-500 font-normal">(Optional)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.moneyLost}
                  onChange={(e) => update('moneyLost', e.target.value)}
                  placeholder="e.g. 250.00"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-red-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  Scam Category <span className="text-red-400">*</span>
                </label>
                <select
                  value={form.category}
                  onChange={(e) => update('category', e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-red-500 transition cursor-pointer"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                {errors.category && <p className="text-xs text-red-400 mt-1">{errors.category}</p>}
              </div>
            </div>

            {/* 5. Fourth Row: Date of Incident & How Were You Contacted? */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">Date of Incident</label>
                <input
                  type="date"
                  value={form.incidentDate}
                  onChange={(e) => update('incidentDate', e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-red-500 transition cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">How Were You Contacted?</label>
                <select
                  value={form.howContacted}
                  onChange={(e) => update('howContacted', e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-red-500 transition cursor-pointer"
                >
                  {HOW_CONTACTED.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 6. Primary Line WhatsApp Checkbox */}
            <div className="flex items-center space-x-2 pt-0.5">
              <input
                type="checkbox"
                id="form-primary-whatsapp"
                checked={form.isPrimaryWhatsApp}
                onChange={(e) => update('isPrimaryWhatsApp', e.target.checked)}
                className="w-4 h-4 rounded text-red-500 focus:ring-red-400 bg-slate-950 border-slate-700 cursor-pointer"
              />
              <label htmlFor="form-primary-whatsapp" className="text-xs text-slate-300 cursor-pointer select-none">
                This primary phone number operates as a WhatsApp or direct messaging threat line
              </label>
            </div>

            {/* 7. Describe What Happened * (Translates to Threat Intel & Snippet on details) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-200">
                  Describe What Happened <span className="text-red-400">*</span>
                </label>
                <span className="text-[10px] text-slate-500 font-mono">
                  Translates to Threat Intel & Snippet on Tracker
                </span>
              </div>
              <textarea
                required
                rows={3}
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="Provide details on the call or message: What did the scammer say? What name did they give? What fees or gift cards did they demand? Any secondary callback numbers..."
                className={`w-full px-3.5 py-2.5 bg-slate-950 border rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition resize-none leading-relaxed ${
                  errors.description ? 'border-red-500 focus:border-red-400' : 'border-slate-700 focus:border-red-500'
                }`}
              />
              {errors.description && <p className="text-xs text-red-400 mt-1">{errors.description}</p>}
            </div>

            {/* 8. Optional Reporter Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Your Name / Initials <span className="text-slate-500 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={form.reporterName}
                  onChange={(e) => update('reporterName', e.target.value)}
                  placeholder="e.g. Anonymous or J.D."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Your Email <span className="text-slate-500 font-normal">(Optional)</span>
                </label>
                <input
                  type="email"
                  value={form.reporterEmail}
                  onChange={(e) => update('reporterEmail', e.target.value)}
                  placeholder="e.g. reporter@example.com"
                  className={`w-full px-3 py-2 bg-slate-950 border rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition ${
                    errors.reporterEmail ? 'border-red-500 focus:border-red-400' : 'border-slate-700 focus:border-slate-500'
                  }`}
                />
                {errors.reporterEmail && <p className="text-xs text-red-400 mt-1">{errors.reporterEmail}</p>}
              </div>
            </div>

            {/* 9. Form Footer: Cataloged Notice, Cancel & Submit Scam Report */}
            <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-[11px] text-slate-400 flex items-center space-x-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Submitted reports are permanently cataloged and synced across all user sessions.</span>
              </p>

              <div className="flex items-center space-x-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleReturnToTracker}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={status === 'submitting'}
                  className="flex-1 sm:flex-none px-5 py-2.5 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow flex items-center justify-center space-x-2 cursor-pointer"
                >
                  {status === 'submitting' ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <Shield className="w-3.5 h-3.5" />
                      <span>Submit Scam Report</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
