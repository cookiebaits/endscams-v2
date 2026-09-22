import React, { useState, useRef } from 'react';
import { AlertTriangle, Phone, Calendar, FileText, DollarSign, Send, AlertCircle, User, Mail, Upload, X, Paperclip } from 'lucide-react';
import { supabase, normalizePhone, formatPhoneDisplay, isTollFree } from '../lib/supabase';
import { requireDisclaimerAcceptance } from './TermsBanner';
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

interface ReportScamFormProps {
  onSuccess?: (reportData: { phone_number: string; category: string; description: string; file_url?: string }) => void;
  onCancel?: () => void;
  isModal?: boolean;
}

export default function ReportScamForm({ onSuccess, onCancel, isModal = false }: ReportScamFormProps) {
  const [form, setForm] = useState<FormData>({
    phoneNumber: '',
    category: '',
    description: '',
    incidentDate: new Date().toISOString().split('T')[0],
    howContacted: 'Phone Call',
    moneyLost: '',
    reporterName: '',
    reporterEmail: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData | 'file', string>>>({});
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
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
    if (form.description.trim().length < 10) e.description = 'Please provide more detail (at least 10 characters).';
    if (!form.incidentDate) e.incidentDate = 'Please enter the date the scam occurred.';
    if (!form.howContacted) e.howContacted = 'Please select how you were contacted.';
    if (form.reporterEmail && !/^\S+@\S+\.\S+$/.test(form.reporterEmail)) e.reporterEmail = 'Please enter a valid email address.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const uploadFile = async (f: File): Promise<{ url: string; name: string; type: string } | null> => {
    try {
      const ext = f.name.replace(/\.\./g, "").split(".").pop() || "bin";
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const mimeType = f.type;
      const { error } = await supabase.storage
        .from('scam-reports')
        .upload(path, f, { contentType: mimeType, upsert: false });
      if (error) return null;
      const { data: publicData } = supabase.storage.from('scam-reports').getPublicUrl(path);
      return { url: publicData.publicUrl, name: f.name, type: mimeType };
    } catch {
      return null;
    }
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!requireDisclaimerAcceptance()) return;

    const countryAllowed = await isUserCountryAllowed();
    if (!countryAllowed) {
      setErrorMsg('Scam report submissions are restricted in your region.');
      setStatus('error');
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
      }
    }

    const formattedPhone = formatPhoneDisplay(digits);

    // Payload for scam_reports table
    const reportPayload: Record<string, any> = {
      phone_number: formattedPhone,
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

    // 1. Insert into scam_reports table in Supabase
    try {
      const { error } = await supabase.from('scam_reports').insert(reportPayload);
      if (error) {
        console.error('Supabase scam_reports insert error:', error.message, error.code, error.details);
      }
    } catch (e) {
      console.error('Supabase connection error:', e);
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 60);

    // 2. Upsert into tracker_entries table in Supabase
    try {
      const { error: trackerError } = await supabase.from('tracker_entries').upsert({
        phone_number: formattedPhone,
        phone_digits: digits,
        source_name: 'User Report',
        source_url: '/report',
        report_date: form.incidentDate,
        category: form.category,
        description: form.description.trim(),
        expires_at: expiresAt.toISOString(),
      }, { onConflict: 'phone_digits,source_name' });

      if (trackerError) {
        console.error('tracker_entries upsert error:', trackerError.message, trackerError.code, trackerError.details);
      }
    } catch (e) {
      console.error('tracker_entries connection error:', e);
    }

    // Broadcast sync event
    try {
      const bc = new BroadcastChannel('end_scam_scan_sync_channel');
      bc.postMessage({
        type: 'ADD_RECORD',
        payload: {
          phone_number: formattedPhone,
          phone_digits: digits,
          category: form.category,
          description: form.description.trim(),
          report_date: form.incidentDate,
          source_name: 'User Report',
        },
      });
      bc.close();
    } catch {}

    setStatus('success');
    if (onSuccess) {
      onSuccess({
        phone_number: formattedPhone,
        category: form.category,
        description: form.description.trim(),
        file_url: fileUrl,
      });
    }
  };

  return (
    <div className={`w-full ${isModal ? 'bg-slate-900 text-slate-100 p-1' : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800'}`}>
      {status === 'error' && (
        <div className="mb-4 p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-400">{errorMsg}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block font-semibold mb-1 text-slate-300">
            <Phone className="w-3.5 h-3.5 inline-block mr-1 text-amber-500" />
            Scam Phone Number <span className="text-amber-500">*</span>
          </label>
          <input
            type="text"
            value={form.phoneNumber}
            onChange={e => update('phoneNumber', e.target.value)}
            placeholder="e.g. +1 (555) 019-2834 or +44 7911 123456"
            className={`w-full px-3 py-2 rounded-xl bg-slate-950 border text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:border-amber-500 ${errors.phoneNumber ? 'border-red-500' : 'border-slate-800'}`}
          />
          {errors.phoneNumber ? (
            <p className="text-[11px] text-red-400 mt-1">{errors.phoneNumber}</p>
          ) : (
            <p className="text-[10px] text-slate-500 mt-1">Include country code for international numbers. Toll-free (800, 888, etc.) rejected.</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold mb-1 text-slate-300">
              <AlertTriangle className="w-3.5 h-3.5 inline-block mr-1 text-amber-500" />
              Scam Category <span className="text-amber-500">*</span>
            </label>
            <select
              value={form.category}
              onChange={e => update('category', e.target.value)}
              className={`w-full px-3 py-2 rounded-xl bg-slate-950 border text-slate-100 focus:outline-none focus:border-amber-500 ${errors.category ? 'border-red-500' : 'border-slate-800'}`}
            >
              <option value="">Select a category</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {errors.category && <p className="text-[11px] text-red-400 mt-1">{errors.category}</p>}
          </div>

          <div>
            <label className="block font-semibold mb-1 text-slate-300">
              How Were You Contacted? <span className="text-amber-500">*</span>
            </label>
            <select
              value={form.howContacted}
              onChange={e => update('howContacted', e.target.value)}
              className={`w-full px-3 py-2 rounded-xl bg-slate-950 border text-slate-100 focus:outline-none focus:border-amber-500 ${errors.howContacted ? 'border-red-500' : 'border-slate-800'}`}
            >
              {HOW_CONTACTED.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold mb-1 text-slate-300">
              <Calendar className="w-3.5 h-3.5 inline-block mr-1 text-amber-500" />
              Date of Incident <span className="text-amber-500">*</span>
            </label>
            <input
              type="date"
              value={form.incidentDate}
              onChange={e => update('incidentDate', e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className={`w-full px-3 py-2 rounded-xl bg-slate-950 border text-slate-100 focus:outline-none focus:border-amber-500 ${errors.incidentDate ? 'border-red-500' : 'border-slate-800'}`}
            />
          </div>

          <div>
            <label className="block font-semibold mb-1 text-slate-300">
              <DollarSign className="w-3.5 h-3.5 inline-block mr-1 text-emerald-400" />
              Amount Lost (Optional)
            </label>
            <input
              type="number"
              value={form.moneyLost}
              onChange={e => update('moneyLost', e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <div>
          <label className="block font-semibold mb-1 text-slate-300">
            <FileText className="w-3.5 h-3.5 inline-block mr-1 text-amber-500" />
            Describe What Happened <span className="text-amber-500">*</span>
          </label>
          <textarea
            value={form.description}
            onChange={e => update('description', e.target.value)}
            placeholder="What did the scammer claim? What company did they impersonate? Any callback numbers or details..."
            rows={3}
            className={`w-full px-3 py-2 rounded-xl bg-slate-950 border text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none ${errors.description ? 'border-red-500' : 'border-slate-800'}`}
          />
          {errors.description && <p className="text-[11px] text-red-400 mt-1">{errors.description}</p>}
        </div>

        {/* Evidence upload */}
        <div>
          <label className="block font-semibold mb-1 text-slate-300">
            <Upload className="w-3.5 h-3.5 inline-block mr-1 text-blue-400" />
            Upload Screenshot / Evidence (Optional)
          </label>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border border-dashed rounded-xl p-3 text-center transition cursor-pointer ${isDragging ? 'border-amber-500 bg-amber-500/10' : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'}`}
            onClick={() => fileInputRef.current?.click()}
          >
            {file ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 truncate">
                  {filePreview ? (
                    <img src={filePreview} alt="Preview" className="w-8 h-8 object-cover rounded" />
                  ) : (
                    <Paperclip className="w-4 h-4 text-amber-400 shrink-0" />
                  )}
                  <span className="truncate text-slate-200">{file.name}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeFile(); }}
                  className="p-1 text-slate-400 hover:text-red-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="text-slate-400">
                <span className="text-amber-400 font-semibold">Click or drag image / PDF</span> (max 3MB)
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>

        {/* Reporter info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
          <div>
            <label className="block font-semibold mb-1 text-slate-400">
              <User className="w-3.5 h-3.5 inline-block mr-1 text-slate-500" />
              Reporter Name / Initials
            </label>
            <input
              type="text"
              value={form.reporterName}
              onChange={e => update('reporterName', e.target.value)}
              placeholder="Optional"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1 text-slate-400">
              <Mail className="w-3.5 h-3.5 inline-block mr-1 text-slate-500" />
              Reporter Email
            </label>
            <input
              type="email"
              value={form.reporterEmail}
              onChange={e => update('reporterEmail', e.target.value)}
              placeholder="Optional"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={status === 'submitting'}
            className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400 text-slate-950 font-bold rounded-xl transition shadow flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
          >
            {status === 'submitting' ? (
              <>
                <span className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                <span>Saving to Supabase...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Submit Scam Report</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
