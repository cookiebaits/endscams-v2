import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AlertTriangle, Phone, Calendar, FileText, DollarSign, Send, AlertCircle, User, Mail, Upload, X, Paperclip, Sparkles, Loader2 } from 'lucide-react';
import Tesseract from 'tesseract.js';
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
  'General Tech Support & Refund Scams',
  'Spellcaster WhatsApp Extortion',
  'Crypto BTC Recovery Scam',
  'Publishing Chat Scam',
  'Lottery & Sweepstakes Scams',
  'Social Media Prize & Giveaway Scam',
  'Government Impersonation & Warrant Scams',
  'Emergency & Grandparent Scams',
  'Spiritual / Herbal / Fortune Scam',
  'Invoice & Imposter Scam',
  'Job & Employment Scam',
  'Other Scam',
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

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // File & Evidence Upload States
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrStatus, setOcrStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const update = (field: keyof FormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
  };

  const autoFillFormFromOcr = useCallback((extractedText: string) => {
    if (!extractedText || !extractedText.trim()) return;

    const lowerText = extractedText.toLowerCase();

    // 1. Phone number heuristic
    const phoneMatches = extractedText.match(/(?:\+?\d{1,4}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+\d{10,15}/g) || [];
    let foundPhone = '';
    for (const match of phoneMatches) {
      const digits = match.replace(/\D/g, '');
      if (digits.length >= 7 && !isTollFree(digits) && !digits.startsWith('800') && !digits.startsWith('888')) {
        foundPhone = match.trim();
        break;
      }
    }

    // 2. Category & Company / Target heuristic
    let foundCategory = '';
    let foundCompany = '';

    if (lowerText.includes('geek squad') || lowerText.includes('best buy') || lowerText.includes('mcafee') || lowerText.includes('norton') || lowerText.includes('anydesk') || lowerText.includes('tech support')) {
      foundCategory = 'General Tech Support & Refund Scams';
      if (lowerText.includes('geek squad')) foundCompany = 'Geek Squad';
      else if (lowerText.includes('mcafee')) foundCompany = 'McAfee Support';
      else if (lowerText.includes('norton')) foundCompany = 'Norton Security';
    } else if (lowerText.includes('paypal') || lowerText.includes('invoice') || lowerText.includes('renewal') || lowerText.includes('quickbooks')) {
      foundCategory = 'Invoice & Imposter Scam';
      if (lowerText.includes('paypal')) foundCompany = 'PayPal Billing';
      else if (lowerText.includes('quickbooks')) foundCompany = 'Quickbooks';
    } else if (lowerText.includes('spell') || lowerText.includes('baba') || lowerText.includes('mama') || lowerText.includes('herbal') || lowerText.includes('spiritual') || lowerText.includes('healer')) {
      foundCategory = 'Spiritual / Herbal / Fortune Scam';
      const match = extractedText.match(/(?:Dr\.|Mama|Baba|Prof\.)\s+[A-Za-z0-9\s]+/i);
      if (match) foundCompany = match[0].trim();
    } else if (lowerText.includes('pch') || lowerText.includes('publishers clearing') || lowerText.includes('sweepstakes') || lowerText.includes('lottery') || lowerText.includes('winner')) {
      foundCategory = 'Lottery & Sweepstakes Scams';
      foundCompany = 'Publishers Clearing House';
    } else if (lowerText.includes('crypto') || lowerText.includes('bitcoin') || lowerText.includes('btc') || lowerText.includes('recovery') || lowerText.includes('blockchain')) {
      foundCategory = 'Crypto BTC Recovery Scam';
      foundCompany = 'Crypto Recovery Taskforce';
    } else if (lowerText.includes('warrant') || lowerText.includes('social security') || lowerText.includes('irs') || lowerText.includes('court') || lowerText.includes('police')) {
      foundCategory = 'Government Impersonation & Warrant Scams';
    } else if (lowerText.includes('whatsapp')) {
      foundCategory = 'Spellcaster WhatsApp Extortion';
    }

    // 3. Amount heuristic
    let foundAmount = '';
    const amountMatch = extractedText.match(/(?:\$|USD|EUR|CAD|GBP|R|KSh)\s?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)/i);
    if (amountMatch) {
      foundAmount = amountMatch[1].replace(/,/g, '');
    }

    // 4. Date heuristic
    let foundDate = '';
    const dateMatch = extractedText.match(/\b(202[0-9])[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12][0-9]|3[01])\b|\b(0[1-9]|1[0-2])[-/](0[1-9]|[12][0-9]|3[01])[-/](202[0-9])\b/);
    if (dateMatch) {
      if (dateMatch[1]) {
        foundDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
      } else if (dateMatch[4]) {
        foundDate = `${dateMatch[6]}-${dateMatch[4]}-${dateMatch[5]}`;
      }
    }

    setForm(prev => {
      const cleanDesc = extractedText.replace(/\s+/g, ' ').trim();
      const summaryDesc = foundCompany
        ? `Evidence OCR detected ${foundCompany}. Extracted details: ${cleanDesc.slice(0, 220)}...`
        : cleanDesc.slice(0, 250);

      return {
        ...prev,
        phoneNumber: prev.phoneNumber || foundPhone || prev.phoneNumber,
        category: prev.category || foundCategory || prev.category,
        moneyLost: prev.moneyLost || foundAmount || prev.moneyLost,
        incidentDate: foundDate || prev.incidentDate,
        description: prev.description || summaryDesc,
      };
    });
  }, []);

  const processFile = useCallback(async (selectedFile: File) => {
    if (!ACCEPTED_TYPES.includes(selectedFile.type)) {
      setErrorMsg('Invalid file type. Please upload a JPG, PNG, WEBP, or PDF.');
      return;
    }
    if (selectedFile.size > 3 * 1024 * 1024) {
      setErrorMsg('File size exceeds 3MB limit.');
      return;
    }

    setFile(selectedFile);
    setErrorMsg(null);

    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = e => setFilePreview(e.target?.result as string);
      reader.readAsDataURL(selectedFile);

      setIsOcrProcessing(true);
      setOcrStatus('Scanning evidence via OCR engine...');
      try {
        const result = await Tesseract.recognize(selectedFile, 'eng', {
          logger: m => {
            if (m.status === 'recognizing text') {
              setOcrStatus(`Extracting text via OCR (${Math.round((m.progress || 0) * 100)}%)...`);
            }
          },
        });
        const extracted = result.data.text;
        if (extracted) {
          autoFillFormFromOcr(extracted);
        }
      } catch (err) {
        console.warn('[ReportScamForm] OCR error:', err);
      } finally {
        setIsOcrProcessing(false);
        setOcrStatus('');
      }
    } else {
      setFilePreview(null);
    }
  }, [autoFillFormFromOcr]);

  const removeFile = () => {
    setFile(null);
    setFilePreview(null);
    setIsOcrProcessing(false);
    setOcrStatus('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  // Clipboard Paste listener for Copy & Paste evidence
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const items = e.clipboardData.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const pastedFile = item.getAsFile();
          if (pastedFile) {
            e.preventDefault();
            processFile(pastedFile);
            break;
          }
        }
      }
    };

    const currentForm = formRef.current;
    if (currentForm) {
      currentForm.addEventListener('paste', handlePaste);
    }
    return () => {
      if (currentForm) {
        currentForm.removeEventListener('paste', handlePaste);
      }
    };
  }, [processFile]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    const digits = normalizePhone(form.phoneNumber);
    if (!digits || digits.length < 7) {
      errs.phoneNumber = 'Valid phone number required (min 7 digits)';
    } else if (isTollFree(digits)) {
      errs.phoneNumber = 'Toll-free numbers (800, 888, 877, etc.) are rejected';
    }

    if (!form.category) {
      errs.category = 'Please select a scam category';
    }

    if (!form.description || form.description.trim().length < 10) {
      errs.description = 'Please describe what happened (min 10 characters)';
    }

    if (!form.incidentDate) {
      errs.incidentDate = 'Incident date is required';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!requireDisclaimerAcceptance()) return;
    if (!isUserCountryAllowed()) {
      setStatus('error');
      setErrorMsg('Scam reporting is restricted to authorized regions.');
      return;
    }

    if (!validate()) return;

    setStatus('submitting');
    setErrorMsg(null);

    try {
      const rawPhone = form.phoneNumber.trim();
      const phoneDigits = normalizePhone(rawPhone);
      const formattedPhone = formatPhoneDisplay(rawPhone) || rawPhone;

      // 1. Upload evidence file if provided
      let fileUrl = '';
      let fileName = '';
      let fileType = '';

      if (file) {
        fileName = file.name;
        fileType = file.type;
        const fileExt = fileName.split('.').pop();
        const filePath = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

        const { error: uploadErr } = await supabase.storage
          .from('scam-reports')
          .upload(filePath, file, { cacheControl: '3600', upsert: false });

        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from('scam-reports').getPublicUrl(filePath);
          fileUrl = urlData.publicUrl;
        } else {
          console.warn('[ReportScamForm] Storage upload note:', uploadErr.message);
        }
      }

      // 2. Insert into Supabase scam_reports table
      const moneyNum = form.moneyLost ? parseFloat(form.moneyLost) : null;
      const { error: dbErr } = await supabase.from('scam_reports').insert([
        {
          phone_number: formattedPhone,
          phone_digits: phoneDigits,
          category: form.category,
          description: form.description.trim(),
          how_contacted: form.howContacted,
          incident_date: form.incidentDate,
          reporter_name: form.reporterName.trim() || null,
          reporter_email: form.reporterEmail.trim() || null,
          money_lost: moneyNum,
          source: 'user_report',
          file_url: fileUrl || null,
          file_name: fileName || null,
          file_type: fileType || null,
        },
      ]).select();

      if (dbErr) {
        console.warn('[ReportScamForm] scam_reports insert note:', dbErr.message);
      }

      // 3. Upsert directly into Supabase tracker_entries table
      const trackerRecord = {
        id: `rec-${phoneDigits}`,
        phone_number: formattedPhone,
        phone_digits: phoneDigits,
        source_name: 'Community Report',
        source_url: 'https://endscams.org/report',
        report_date: form.incidentDate,
        category: form.category,
        description: form.description.trim(),
        impersonated_company: 'Community Submission',
        invoice_number: 'N/A',
        amount_charged: moneyNum ? `$${moneyNum.toFixed(2)}` : 'N/A',
        reported_down: false,
        expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error: trackerErr } = await supabase.from('tracker_entries').upsert(trackerRecord);
      if (trackerErr) {
        await supabase.from('tracker_entries').upsert(trackerRecord, { onConflict: 'phone_digits,source_name' });
      }

      // 4. Send to backend fetcher /api/records/manual endpoint
      try {
        await fetch('/api/records/manual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(trackerRecord),
        });
      } catch (e) {
        console.warn('[ReportScamForm] Backend endpoint note:', e);
      }

      // 5. Broadcast live update to syncBridge (across open tabs)
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        try {
          const bc = new BroadcastChannel('end_scam_scan_sync_channel');
          bc.postMessage({
            source: 'END_SCAM_SCAN',
            type: 'ADD_MANUAL_RECORD',
            version: '1.1.0',
            timestamp: new Date().toISOString(),
            payload: {
              phoneNumber: formattedPhone,
              phoneDigits: phoneDigits,
              companyImpersonated: 'Community Submission',
              category: form.category,
              sourceUrl: 'https://endscams.org/report',
              sourcePlatform: 'Community Report',
              snippet: form.description.trim(),
              status: 'Active Line',
            },
          });
          bc.close();
        } catch {}
      }

      setStatus('success');
      if (onSuccess) {
        onSuccess({
          phone_number: formattedPhone,
          category: form.category,
          description: form.description,
          file_url: fileUrl || undefined,
        });
      }
    } catch (err: any) {
      console.error('[ReportScamForm] Submit error:', err);
      setStatus('error');
      setErrorMsg(err.message || 'An error occurred while submitting your report. Please try again.');
    }
  };

  return (
    <div className={`w-full ${isModal ? '' : 'bg-slate-900 text-slate-100 p-6 rounded-2xl shadow-lg border border-slate-800'}`}>
      {status === 'error' && (
        <div className="mb-4 p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-400">{errorMsg}</p>
        </div>
      )}

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* TOP FIELD: EVIDENCE UPLOAD (DRAG & DROP, CLICK, COPY & PASTE, OCR) */}
        <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <label className="block font-semibold text-slate-200 text-xs">
              <Upload className="w-4 h-4 inline-block mr-1.5 text-amber-500" />
              Upload Screenshot / Evidence (Optional)
            </label>
            {isOcrProcessing && (
              <span className="flex items-center space-x-1 text-[11px] text-amber-400 font-mono animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>{ocrStatus || 'OCR Processing...'}</span>
              </span>
            )}
          </div>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-4 text-center transition cursor-pointer flex flex-col items-center justify-center space-y-1.5 ${
              isDragging
                ? 'border-amber-500 bg-amber-500/10'
                : 'border-slate-800 bg-slate-900/60 hover:border-amber-500/50 hover:bg-slate-900'
            }`}
          >
            {file ? (
              <div className="flex items-center justify-between w-full px-2">
                <div className="flex items-center space-x-2 truncate">
                  {filePreview ? (
                    <img src={filePreview} alt="Preview" className="w-10 h-10 object-cover rounded-lg border border-slate-700" />
                  ) : (
                    <Paperclip className="w-5 h-5 text-amber-400 shrink-0" />
                  )}
                  <div className="text-left truncate">
                    <p className="truncate text-xs font-semibold text-slate-100">{file.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{(file.size / 1024).toFixed(1)} KB • Image OCR analyzed</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeFile(); }}
                  className="p-1.5 text-slate-400 hover:text-red-400 transition rounded-lg hover:bg-slate-800"
                  title="Remove File"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center justify-center space-x-2">
                  <span className="text-amber-400 font-bold text-xs">Click, drag & drop image / PDF</span>
                  <span className="text-slate-500 text-[10px] bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">or Paste (Ctrl+V)</span>
                </div>
                <p className="text-[10px] text-slate-400 flex items-center justify-center space-x-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>OCR technology automatically analyzes screenshots to auto-fill form details.</span>
                </p>
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

        {/* FIELD 2: SCAM PHONE NUMBER */}
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

        {/* FIELD 3: SCAM CATEGORY & HOW CONTACTED */}
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

        {/* FIELD 4: DATE OF INCIDENT & AMOUNT LOST */}
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
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>
        </div>

        {/* FIELD 5: DESCRIBE WHAT HAPPENED */}
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

        {/* FIELD 6: REPORTER INFO */}
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

        {/* SUBMIT ACTIONS */}
        <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition cursor-pointer text-xs"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={status === 'submitting'}
            className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400 text-slate-950 font-bold rounded-xl transition shadow flex items-center space-x-2 disabled:opacity-50 cursor-pointer text-xs"
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
