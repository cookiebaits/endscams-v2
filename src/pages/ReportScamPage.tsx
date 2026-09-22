import React, { useState, useRef } from 'react';
import {
  AlertTriangle,
  Phone,
  Calendar,
  FileText,
  DollarSign,
  Send,
  CheckCircle,
  AlertCircle,
  User,
  Mail,
  Upload,
  X,
  ExternalLink,
  Paperclip,
  Download,
} from 'lucide-react';
import { supabase, normalizePhone, formatPhoneDisplay, isTollFree } from '../lib/supabase';
import Banner from '../components/Banner';
import { requireDisclaimerAcceptance } from '../components/TermsBanner';
import { isUserCountryAllowed } from '../utils/geoIp';

type FormData = {
  phoneNumber: string;
  category: string;
  description: string;
  incidentDate: string;
  howContacted: string;
  moneyLost: string;
  reporterName: string;
  reporterEmail: string;
};

const CATEGORIES = [
  'Invoice / Imposter Scam',
  'Tech Support Scam',
  'Lottery / Prize Scam',
  'Government Impersonation',
  'Romance Scam',
  'Spiritual / Spellcaster Scam',
  'Crypto / Investment Scam',
  'Money Recovery Scam',
  'Emergency Scam',
  'Employment Scam',
  'Other',
];

const HOW_CONTACTED = ['Phone Call', 'Text Message', 'Email', 'Social Media', 'In Person', 'Website', 'WhatsApp', 'Other'];

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
const ACCEPTED_EXTENSIONS = '.jpg,.jpeg,.png,.gif,.webp,.pdf';
const MAX_SIZE_BYTES = 3 * 1024 * 1024;

const FEDERAL_LINKS = [
  {
    name: 'FBI IC3 — Internet Crime Complaint Center',
    url: 'https://www.ic3.gov',
    description: 'Report internet crime and fraud to the FBI',
  },
  {
    name: 'FTC — Federal Trade Commission',
    url: 'https://reportfraud.ftc.gov',
    description: 'Report scams, fraud, and bad business practices',
  },
  {
    name: 'USA.gov — Report Scams',
    url: 'https://www.usa.gov/report-scams',
    description: 'Find the right agency to report your specific scam',
  },
  {
    name: 'CISA — Cybersecurity Threats',
    url: 'https://www.cisa.gov/report',
    description: 'Report cybersecurity incidents to CISA',
  },
];

async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    if (file.type === 'application/pdf') {
      resolve(file);
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      const MAX_DIM = 1920;
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width > height) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      let quality = 0.85;
      const tryCompress = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return; }
            if (blob.size <= MAX_SIZE_BYTES || quality <= 0.3) {
              resolve(blob);
            } else {
              quality -= 0.1;
              tryCompress();
            }
          },
          file.type === 'image/png' ? 'image/jpeg' : file.type,
          quality
        );
      };
      tryCompress();
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

export default function ReportScamPage() {
  const [form, setForm] = useState<FormData>({
    phoneNumber: '',
    category: '',
    description: '',
    incidentDate: '',
    howContacted: '',
    moneyLost: '',
    reporterName: '',
    reporterEmail: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData | 'file', string>>>({});
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
  const [lastSubmittedDigits, setLastSubmittedDigits] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (f: File) => {
    if (!ACCEPTED_TYPES.includes(f.type)) {
      setErrors((e) => ({ ...e, file: 'Invalid file type. Accepted: PDF, JPG, PNG, GIF, WEBP.' }));
      return;
    }
    setErrors((e) => ({ ...e, file: undefined }));
    setFile(f);
    if (f.type !== 'application/pdf') {
      const reader = new FileReader();
      reader.onload = (ev) => setFilePreview(ev.target?.result as string);
      reader.readAsDataURL(f);
    } else {
      setFilePreview(null);
    }
  };

  const update = (field: keyof FormData, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
    if (errors[field]) setErrors(e => ({ ...e, [field]: undefined }));
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

  const handlePaste = (ev: React.ClipboardEvent<HTMLDivElement>) => {
    const items = ev.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const pastedFile = item.getAsFile();
        if (pastedFile) {
          processFile(pastedFile);
          ev.preventDefault();
          break;
        }
      }
    }
  };

  const removeFile = () => {
    setFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setErrors(e => ({ ...e, file: undefined }));
  };

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormData | 'file', string>> = {};
    const digits = normalizePhone(form.phoneNumber);
    if (digits.length < 7 || digits.length > 15) {
      e.phoneNumber = 'Please enter a valid phone number (7–15 digits, with country code for international numbers).';
    } else if (isTollFree(digits)) {
      e.phoneNumber = 'Toll-free numbers (800, 833, 844, etc.) are not accepted.';
    }
    if (!form.category) e.category = 'Please select a scam category.';
    if (form.description.trim().length < 20) e.description = 'Please provide more detail (at least 20 characters).';
    if (!form.incidentDate) e.incidentDate = 'Please enter the date the scam occurred.';
    if (!form.howContacted) e.howContacted = 'Please select how you were contacted.';
    if (form.reporterEmail && !/^\S+@\S+\.\S+$/.test(form.reporterEmail)) e.reporterEmail = 'Please enter a valid email address.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const uploadFile = async (f: File): Promise<{ url: string; name: string; type: string } | null> => {
    try {
      let blob: Blob = f;
      if (f.size > MAX_SIZE_BYTES) {
        blob = await compressImage(f);
      }
      const ext = f.name.replace(/\.\./g, "").split(".").pop() || "bin";
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const mimeType = blob.type || f.type;
      const { error } = await supabase.storage
        .from('scam-reports')
        .upload(path, blob, { contentType: mimeType, upsert: false });
      if (error) return null;
      const { data: publicData } = supabase.storage.from('scam-reports').getPublicUrl(path);
      return { url: publicData.publicUrl, name: f.name, type: mimeType };
    } catch {
      return null;
    }
  };

  // EXPORT CURRENT FORM / REPORT AS .TSX FILE
  const handleExportTSX = () => {
    const digits = normalizePhone(form.phoneNumber) || 'unknown';
    const reportData = {
      phoneNumber: formatPhoneDisplay(digits) || form.phoneNumber || 'Unspecified',
      phoneDigits: digits,
      category: form.category || 'General Scam',
      howContacted: form.howContacted || 'Unknown',
      incidentDate: form.incidentDate || new Date().toISOString().split('T')[0],
      amountLost: form.moneyLost ? `$${parseFloat(form.moneyLost).toFixed(2)}` : 'N/A',
      description: form.description.trim() || 'No description provided',
      exportedAt: new Date().toISOString(),
    };

    const tsxSource = `import React from 'react';

export interface ScamReportEntry {
  phoneNumber: string;
  phoneDigits: string;
  category: string;
  howContacted: string;
  incidentDate: string;
  amountLost: string;
  description: string;
  exportedAt: string;
}

export const EXPORTED_SCAM_REPORT: ScamReportEntry = ${JSON.stringify(reportData, null, 2)};

export default function ExportedScamReportCard(): React.ReactElement {
  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: '640px', margin: '2rem auto', padding: '1.5rem', background: '#0f172a', color: '#f8fafc', borderRadius: '1rem', border: '1px solid #1e293b' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ef4444', marginBottom: '0.75rem' }}>
        Scam Threat Report: {EXPORTED_SCAM_REPORT.phoneNumber}
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
        <div>
          <strong style={{ color: '#94a3b8', display: 'block' }}>Category:</strong>
          <span>{EXPORTED_SCAM_REPORT.category}</span>
        </div>
        <div>
          <strong style={{ color: '#94a3b8', display: 'block' }}>Contact Channel:</strong>
          <span>{EXPORTED_SCAM_REPORT.howContacted}</span>
        </div>
        <div>
          <strong style={{ color: '#94a3b8', display: 'block' }}>Incident Date:</strong>
          <span>{EXPORTED_SCAM_REPORT.incidentDate}</span>
        </div>
        <div>
          <strong style={{ color: '#94a3b8', display: 'block' }}>Amount Lost:</strong>
          <span>{EXPORTED_SCAM_REPORT.amountLost}</span>
        </div>
      </div>
      <div style={{ background: '#020617', padding: '1rem', borderRadius: '0.5rem', fontSize: '0.85rem', lineHeight: 1.5 }}>
        <strong style={{ color: '#fbbf24', display: 'block', marginBottom: '0.25rem' }}>Description:</strong>
        <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{EXPORTED_SCAM_REPORT.description}</p>
      </div>
    </div>
  );
}
`;

    const blob = new Blob([tsxSource], { type: 'text/typescript-jsx;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `scam_report_${digits}_${Date.now()}.tsx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const sendEmail = async (fileUrl?: string, fileName?: string, fileType?: string) => {
    try {
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-scam-report-email`;
      await fetch(fnUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: form.phoneNumber,
          category: form.category,
          description: form.description.trim(),
          incidentDate: form.incidentDate,
          howContacted: form.howContacted,
          moneyLost: form.moneyLost || undefined,
          reporterName: form.reporterName.trim() || undefined,
          reporterEmail: form.reporterEmail.trim() || undefined,
          fileUrl,
          fileName,
          fileType,
        }),
      });
    } catch {
      // Intentional pass
    }
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!requireDisclaimerAcceptance()) return;

    const countryAllowed = await isUserCountryAllowed();
    if (!countryAllowed) {
      return;
    }

    if (!validate()) return;
    setStatus('submitting');
    setErrorMsg('');

    const digits = normalizePhone(form.phoneNumber);
    setLastSubmittedDigits(digits);

    let fileUrl: string | undefined;
    let fileName: string | undefined;
    let fileType: string | undefined;

    if (file) {
      const uploaded = await uploadFile(file);
      if (uploaded) {
        fileUrl = uploaded.url;
        fileName = uploaded.name;
        fileType = uploaded.type;
        setUploadedFileUrl(uploaded.url);
      }
    }

    // 1. Insert into scam_reports table
    const reportPayload: Record<string, any> = {
      phone_number: formatPhoneDisplay(digits),
      phone_digits: digits,
      category: form.category,
      description: form.description.trim(),
      how_contacted: form.howContacted,
      incident_date: form.incidentDate,
      reporter_name: form.reporterName.trim() || null,
      reporter_email: form.reporterEmail.trim() || null,
      money_lost: form.moneyLost ? parseFloat(form.moneyLost) : null,
      source: 'user_report',
    };

    if (fileUrl) {
      reportPayload.file_url = fileUrl;
      reportPayload.file_name = fileName || null;
      reportPayload.file_type = fileType || null;
    }

    try {
      const { error } = await supabase.from('scam_reports').insert(reportPayload);
      if (error) {
        console.error('Supabase scam_reports insert error:', error.message);
      }
    } catch (e) {
      console.error('Supabase connection error:', e);
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 60);
    const amountVal = form.moneyLost ? `$${parseFloat(form.moneyLost).toFixed(2)}` : 'N/A';

    // 2. Direct Integration into tracker_entries table (immediate sync to /trackerpage)
    const trackerRecordPayload = {
      id: `report-${Date.now()}-${digits}`,
      phone_number: formatPhoneDisplay(digits),
      phone_digits: digits,
      country_code: 'US',
      country_name: 'United States',
      scam_type: form.category,
      category: form.category,
      impersonated_company: 'N/A',
      invoice_number: 'N/A',
      amount_charged: amountVal,
      source_platform: 'User Report',
      source_name: 'User Report',
      source_url: '/reportscam',
      source_domain: 'reportscam',
      threat_intel: form.description.trim(),
      description: form.description.trim(),
      snippet: form.description.trim(),
      detailed_summary: form.description.trim(),
      detected_at: new Date().toISOString(),
      report_date: form.incidentDate,
      post_date: form.incidentDate,
      is_down: false,
      is_number_down: false,
      status: 'Active',
      expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const { error: trackerError } = await supabase
        .from('tracker_entries')
        .upsert(trackerRecordPayload, { onConflict: 'phone_digits' });

      if (trackerError) {
        console.error('tracker_entries upsert error:', trackerError.message);
      }
    } catch (e) {
      console.error('tracker_entries connection error:', e);
    }

    // 3. Replicate to backend Dokploy endpoint with no caching
    try {
      await fetch('/api/records/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
        body: JSON.stringify({
          phone: formatPhoneDisplay(digits),
          cleanPhone: digits,
          isWhatsapp: form.howContacted === 'WhatsApp',
          scamType: form.category,
          impersonatedCompany: 'N/A',
          sourceUrl: '/reportscam',
          platform: 'User Report',
          detailedSummary: form.description.trim(),
          amountCharged: amountVal,
          detectedAt: form.incidentDate,
        }),
      });
    } catch {
      // Backend is optional fallback to Supabase
    }

    // 4. In-memory cross-tab notification (Zero localStorage)
    try {
      const bc = new BroadcastChannel('end_scam_scan_sync_channel');
      bc.postMessage({
        type: 'ADD_RECORD',
        record: trackerRecordPayload,
      });
      bc.close();
    } catch {}

    await sendEmail(fileUrl, fileName, fileType);
    setStatus('success');
  };

  const handleReset = () => {
    setForm({ phoneNumber: '', category: '', description: '', incidentDate: '', howContacted: '', moneyLost: '', reporterName: '', reporterEmail: '' });
    setErrors({});
    setStatus('idle');
    setErrorMsg('');
    setFile(null);
    setFilePreview(null);
    setUploadedFileUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200 pb-16 flex items-center justify-center">
        <div className="max-w-md mx-auto px-4 text-center animate-slide-up">
          <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">Report Submitted</h1>
          <p className="text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
            Thank you for helping protect others. Your report has been added directly into the Scam Tracker database and is immediately visible to everyone.
          </p>

          <div className="flex items-center justify-center gap-3 mb-6">
            <button
              onClick={handleExportTSX}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              title="Download this report formatted as a React .tsx component"
            >
              <Download className="w-4 h-4" />
              <span>Export Report as .tsx</span>
            </button>

            {uploadedFileUrl && (
              <a
                href={uploadedFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-brand-500 hover:text-brand-600 underline"
              >
                <Paperclip className="w-4 h-4" />
                <span>View Attachment</span>
              </a>
            )}
          </div>

          <div className="mb-8">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Also consider reporting to federal agencies:</p>
            <div className="space-y-2">
              {FEDERAL_LINKS.map(link => (
                <a
                  key={link.name}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-brand-500 hover:text-brand-600 hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                  {link.name}
                </a>
              ))}
            </div>
          </div>
          <button onClick={handleReset} className="btn-primary">Submit Another Report</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200 pb-16 text-slate-700 dark:text-slate-300">
      <Banner
        variant="warning"
        id="report_privacy"
        dismissible
        message={<span><strong>Privacy Notice:</strong> Submissions are synced to the shared Dokploy database and publicly listed on the Tracker. Do not include private banking info.</span>}
      />
      <div className="max-w-2xl mx-auto px-4 pt-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-brand-500/10 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-brand-500" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-wider">Report a Scam</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Syncs directly into the live Threat Database</p>
            </div>
          </div>

          {/* Quick .tsx export */}
          <button
            type="button"
            onClick={handleExportTSX}
            className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-xs font-semibold text-emerald-400 flex items-center gap-1.5 transition cursor-pointer"
            title="Export form draft as a React .tsx component"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export .tsx</span>
          </button>
        </div>

        <div className="mb-6 rounded-xl border border-amber-800/40 bg-[#1a1200] p-5">
          <div className="flex items-center gap-2 mb-3">
            <ExternalLink className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <h3 className="text-sm font-bold text-amber-400">Report to Federal Agencies</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { name: 'FTC — ReportFraud.ftc.gov', sub: 'Federal Trade Commission', url: 'https://reportfraud.ftc.gov' },
              { name: 'IC3 — Internet Crime (FBI)', sub: 'FBI Internet Crime Complaint Center', url: 'https://www.ic3.gov' },
            ].map(link => (
              <a
                key={link.name}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 rounded-lg bg-[#2a1d00] hover:bg-[#3a2800] border border-amber-900/40 px-4 py-3 transition-colors group"
              >
                <ExternalLink className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-amber-400 group-hover:underline">{link.name}</p>
                  <p className="text-xs text-amber-300/60 mt-0.5">{link.sub}</p>
                </div>
              </a>
            ))}
          </div>
        </div>

        {status === 'error' && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-600 dark:text-red-400">{errorMsg}</p>
          </div>
        )}

        <div className="card p-6 md:p-8 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-5">
            <Field label="Scam Phone Number" icon={Phone} required error={errors.phoneNumber}>
              <input
                type="text"
                value={form.phoneNumber}
                onChange={e => update('phoneNumber', e.target.value)}
                placeholder="e.g. +44 7911 123456 or 555-123-4567"
                maxLength={20}
                className={`input-field ${errors.phoneNumber ? 'border-red-500 focus:ring-red-500' : ''}`}
              />
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Include country code for international numbers. Toll-free numbers are not accepted.</p>
            </Field>

            <Field label="Scam Category" icon={AlertTriangle} required error={errors.category}>
              <select
                value={form.category}
                onChange={e => update('category', e.target.value)}
                className={`input-field ${errors.category ? 'border-red-500 focus:ring-red-500' : ''}`}
              >
                <option value="">Select a category</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>

            <Field label="How Were You Contacted?" icon={Phone} required error={errors.howContacted}>
              <select
                value={form.howContacted}
                onChange={e => update('howContacted', e.target.value)}
                className={`input-field ${errors.howContacted ? 'border-red-500 focus:ring-red-500' : ''}`}
              >
                <option value="">Select contact method</option>
                {HOW_CONTACTED.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>

            <Field label="Date of Incident" icon={Calendar} required error={errors.incidentDate}>
              <input
                type="date"
                value={form.incidentDate}
                onChange={e => update('incidentDate', e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className={`input-field ${errors.incidentDate ? 'border-red-500 focus:ring-red-500' : ''}`}
              />
            </Field>

            <Field label="Describe What Happened" icon={FileText} required error={errors.description}>
              <textarea
                value={form.description}
                onChange={e => update('description', e.target.value)}
                placeholder="What did the scammer say? Any specific invoices, claims, or remote software requested..."
                rows={5}
                className={`input-field resize-none ${errors.description ? 'border-red-500 focus:ring-red-500' : ''}`}
              />
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{form.description.length} characters (minimum 20)</p>
            </Field>

            <Field label="Amount Lost (Optional)" icon={DollarSign}>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                <input
                  type="number"
                  value={form.moneyLost}
                  onChange={e => update('moneyLost', e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="input-field pl-8"
                />
              </div>
            </Field>

            <Field label="Upload Evidence (Optional)" icon={Upload} error={errors.file}>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onPaste={handlePaste}
                tabIndex={0}
                className={`relative border-2 border-dashed rounded-xl p-5 transition-colors outline-none focus:ring-2 focus:ring-brand-500/50 ${
                  errors.file
                    ? 'border-red-500/50 bg-red-500/5'
                    : isDragging
                    ? 'border-brand-500 bg-brand-500/10'
                    : 'border-slate-300 dark:border-slate-700 hover:border-brand-500/50 bg-slate-100 dark:bg-slate-900/50'
                }`}
              >
                {file ? (
                  <div className="flex items-center gap-3">
                    {filePreview ? (
                      <img src={filePreview} alt="Preview" className="w-16 h-16 object-cover rounded-lg flex-shrink-0" />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-brand-500/10 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-7 h-7 text-brand-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{file.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      {file.size > MAX_SIZE_BYTES && (
                        <p className="text-xs text-amber-500 mt-0.5">Will be compressed before upload</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={removeFile}
                      className="p-1.5 rounded-full hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center gap-2 cursor-pointer">
                    <Upload className="w-8 h-8 text-slate-400" />
                    <span className="text-sm text-slate-500 dark:text-slate-400 text-center">
                      <span className="text-brand-500 font-semibold">Click to upload</span>, drag & drop, or paste (Ctrl+V / Cmd+V)
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">PDF, JPG, PNG, GIF, WEBP — max 3 MB</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={ACCEPTED_EXTENSIONS}
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </label>
                )}
              </div>
            </Field>

            <div className="border-t border-slate-200 dark:border-slate-800 pt-5">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Contact Info (Optional)</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Your Name or Initials" icon={User} error={errors.reporterName}>
                  <input type="text" value={form.reporterName} onChange={e => update('reporterName', e.target.value)} placeholder="J.D. or Jane" className="input-field" />
                </Field>
                <Field label="Email Address" icon={Mail} error={errors.reporterEmail}>
                  <input type="email" value={form.reporterEmail} onChange={e => update('reporterEmail', e.target.value)} placeholder="you@email.com" className="input-field" />
                </Field>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={status === 'submitting'}
                className="btn-primary w-full flex items-center justify-center gap-2 py-4 text-base cursor-pointer"
              >
                {status === 'submitting' ? (
                  <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting...</>
                ) : (
                  <><Send className="w-5 h-5" />Submit Report</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({ label, icon: Icon, required, error, children }: { label: string; icon?: React.ElementType; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
        {Icon && <Icon className="w-4 h-4 inline-block mr-1.5 text-brand-500" />}
        {label}
        {required && <span className="text-brand-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}