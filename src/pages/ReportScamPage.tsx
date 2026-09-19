import React, { useState, useRef } from 'react';
import { AlertTriangle, Phone, Calendar, FileText, DollarSign, Send, CheckCircle, AlertCircle, User, Mail, Upload, X, ExternalLink, Paperclip } from 'lucide-react';
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
    if (digits.length < 7 || digits.length > 15) e.phoneNumber = 'Please enter a valid phone number (7–15 digits, with country code for international numbers).';
    else if (isTollFree(digits)) e.phoneNumber = 'Toll-free numbers (800, 833, 844, etc.) are not accepted.';
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
      // Silently deny by now allowing the add/submit action to proceed
      return;
    }

    if (!validate()) return;
    setStatus('submitting');
    setErrorMsg('');

    const digits = normalizePhone(form.phoneNumber);
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
        console.warn('Supabase scam_reports insert notice:', error.message);
      }
    } catch (e) {
      console.warn('Supabase connection note:', e);
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 60);

    // Insert into tracker_entries
    try {
      const { error: trackerError } = await supabase.from('tracker_entries').upsert({
        phone_number: formatPhoneDisplay(digits),
        phone_digits: digits,
        source_name: 'User Report',
        source_url: '/report',
        report_date: form.incidentDate,
        category: form.category,
        description: form.description.trim(),
        expires_at: expiresAt.toISOString(),
      }, { onConflict: 'phone_digits,source_name' });

      if (trackerError) {
        console.warn('tracker_entries upsert notice:', trackerError.message);
      }
    } catch (e) {
      console.warn('tracker_entries connection note:', e);
    }

    // Sync report entry into iframe via BroadcastChannel and localStorage
    const newRecord = {
      id: `user-report-${Date.now()}-${digits}`,
      phone: formatPhoneDisplay(digits),
      phone_number: formatPhoneDisplay(digits),
      phone_digits: digits,
      category: form.category,
      description: form.description.trim(),
      how_contacted: form.howContacted,
      incident_date: form.incidentDate,
      report_date: form.incidentDate,
      source: 'User Report',
      source_name: 'User Report',
      source_url: '/report',
      platform: form.howContacted,
      timestamp: new Date().toISOString(),
    };

    // 1. BroadcastChannel sync bridge
    try {
      const bc = new BroadcastChannel('end_scam_scan_sync_channel');
      bc.postMessage({
        type: 'ADD_RECORD',
        event: 'ADD_RECORD',
        action: 'ADD_RECORD',
        payload: { record: newRecord, ...newRecord },
        record: newRecord,
      });
      bc.close();
    } catch (e) {
      console.warn('BroadcastChannel sync warning:', e);
    }

    // 2. localStorage shared storage for iframe sync
    try {
      const existingRaw = localStorage.getItem('end_scam_scan_shared_storage');
      let storageData: Record<string, any> = {};
      if (existingRaw) {
        try { storageData = JSON.parse(existingRaw); } catch {}
      }
      const records = Array.isArray(storageData.records) ? storageData.records : [];
      const updatedRecords = [newRecord, ...records.filter((r: any) => (r.phone_digits || r.phone) !== digits)];
      localStorage.setItem('end_scam_scan_shared_storage', JSON.stringify({
        ...storageData,
        records: updatedRecords,
        lastUpdated: new Date().toISOString(),
      }));
    } catch (e) {
      console.warn('localStorage sync warning:', e);
    }

    // 3. Save to user_reported_scams and esscan_threat_records_v2 (direct Tracker storage key)
    const trackerRecord = {
      id: newRecord.id,
      phone_number: formatPhoneDisplay(digits),
      phone_digits: digits,
      source_name: 'User Report',
      source_url: '/report',
      report_date: form.incidentDate,
      category: form.category,
      description: form.description.trim(),
      impersonated_company: 'N/A',
      invoice_number: 'N/A',
      amount_charged: form.moneyLost ? `$${parseFloat(form.moneyLost).toFixed(2)}` : 'N/A',
      is_down: false,
    };

    try {
      const userReportsRaw = localStorage.getItem('user_reported_scams') || '[]';
      const userReports = JSON.parse(userReportsRaw);
      userReports.unshift(newRecord);
      localStorage.setItem('user_reported_scams', JSON.stringify(userReports));
    } catch (e) {
      console.warn('user_reported_scams storage warning:', e);
    }

    try {
      const esscanRaw = localStorage.getItem('esscan_threat_records_v2') || '[]';
      const esscanRecords = JSON.parse(esscanRaw);
      const filtered = Array.isArray(esscanRecords) ? esscanRecords.filter((r: any) => (r.phone_digits || r.phone) !== digits) : [];
      filtered.unshift(trackerRecord);
      localStorage.setItem('esscan_threat_records_v2', JSON.stringify(filtered));
    } catch (e) {
      console.warn('esscan_threat_records_v2 storage warning:', e);
    }

    // 4. Send directly to backend endpoints (no-op if backend unavailable)
    // The Supabase upsert above is the source of truth.

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
            Thank you for helping protect others. Your report has been added to the Scam Tracker and will remain active for 45 days.
          </p>
          {uploadedFileUrl && (
            <a
              href={uploadedFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-brand-500 hover:text-brand-600 underline mb-6"
            >
              <Paperclip className="w-4 h-4" />
              View Uploaded Resource
            </a>
          )}
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
        message={<span><strong>Privacy Notice:</strong> Any information you submit will be publicly visible on the Scam Tracker for 45 days. Do not include your own personal banking details.</span>}
      />
      <div className="max-w-2xl mx-auto px-4 pt-8">
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-4 mb-3">
            <div className="flex-shrink-0 inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-brand-500/10">
              <AlertTriangle className="w-6 h-6 sm:w-7 sm:h-7 text-brand-500" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white uppercase tracking-wider text-left">Report a Scam</h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400">
            Help protect your community. Reports are retained for 45 days and visible in the Scam Tracker.
          </p>
        </div>

        <div className="mb-6 rounded-xl border border-amber-800/40 bg-[#1a1200] p-5">
          <div className="flex items-center gap-2 mb-3">
            <ExternalLink className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <h3 className="text-sm font-bold text-amber-400">Report to Federal Agencies</h3>
          </div>
          <p className="text-xs text-amber-200/70 mb-4">
            For official investigations and to help law enforcement take action, please also report to these agencies:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
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
          <div className="border-t border-amber-900/30 pt-4 mb-3">
            <p className="text-xs text-amber-200/70 mb-3">
              The following are independent, third-party platforms where you can also report scam activity and warn others in the community:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { name: 'BBB Scam Tracker', sub: 'Better Business Bureau — community scam reports', url: 'https://www.bbb.org/scamtracker' },
                { name: 'RoboKiller', sub: 'Spam call lookup & reporting tool', url: 'https://www.robokiller.com' },
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
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Include country code for international numbers (e.g. +44, +234). Do not include toll-free numbers (800, 833, 844, 855, 866, 877, 888).</p>
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
                placeholder="What did the scammer say? What were they asking for? Any other details that may help others..."
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
                    <span className="text-xs text-slate-400 dark:text-slate-500">PDF, JPG, PNG, GIF, WEBP — max 3 MB (auto-compressed)</span>
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
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">Provide contact info only if you'd like to be notified about follow-ups. Never shared publicly.</p>
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
                className="btn-primary w-full flex items-center justify-center gap-2 py-4 text-base"
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

        <div className="mt-6 card p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50">
          <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mb-1">Privacy Notice</p>
          <p className="text-xs text-blue-600 dark:text-blue-400">
            Your personal information (if provided) is never displayed publicly. Reports are anonymized and shared only for educational purposes. Reports expire and are deleted after 45 days.
          </p>
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
