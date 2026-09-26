import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ShieldAlert,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Building2,
  DollarSign,
  Phone,
  MessageSquare,
  FileText,
  Send,
  X,
  Upload,
  Sparkles,
  ExternalLink,
  Shield,
  Radio,
  Image as ImageIcon,
  Check,
  RefreshCw,
  Database,
} from 'lucide-react';
import { ThreatRecord, AltNumberEntry } from '../types';
import { formatDisplayPhone } from '../utils/phoneUtils';
import { getPSTDateStamp } from '../utils/dateUtils';

export interface ReportScamPageProps {
  isModal?: boolean;
  onCloseModal?: () => void;
  onNavigateToTracker?: () => void;
  onRecordCreated?: (record: ThreatRecord) => void;
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

export const ReportScamPage: React.FC<ReportScamPageProps> = ({
  isModal = false,
  onCloseModal,
  onNavigateToTracker,
  onRecordCreated,
}) => {
  // Form State
  const [phoneNumber, setPhoneNumber] = useState('');
  const [scammerName, setScammerName] = useState('');
  const [altNumber1, setAltNumber1] = useState('');
  const [altNumber2, setAltNumber2] = useState('');
  const [isAlt2Whatsapp, setIsAlt2Whatsapp] = useState(false);
  const [isPrimaryWhatsapp, setIsPrimaryWhatsapp] = useState(false);
  const [moneyLost, setMoneyLost] = useState('');
  const [category, setCategory] = useState(STANDARD_SCAM_CATEGORIES[0]);
  const [howContacted, setHowContacted] = useState('Phone Call');
  const [reportDate, setReportDate] = useState(() => getPSTDateStamp());
  const [description, setDescription] = useState('');

  // Screenshot & OCR State
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Submission & Feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // API base URL configured via Dokploy environment settings
  const apiBase = typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_API_URL || '') : '';

  // AI OCR Execution Handler
  const processImageWithOcr = useCallback(async (file: File) => {
    setFeedback(null);
    setOcrStatus('Scanning screenshot with AI OCR engine...');
    setIsOcrProcessing(true);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        setScreenshotPreview(base64Data);

        try {
          const res = await fetch(`${apiBase}/api/ocr-scan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64: base64Data,
              mimeType: file.type || 'image/png',
            }),
          });

          const data = await res.json();
          if (data.success && data.data) {
            const parsed = data.data;
            if (parsed.primaryPhoneNumber) setPhoneNumber(parsed.primaryPhoneNumber);
            if (parsed.scammerName) setScammerName(parsed.scammerName);
            if (parsed.altPhoneNumber1) setAltNumber1(parsed.altPhoneNumber1);
            if (parsed.altPhoneNumber2) setAltNumber2(parsed.altPhoneNumber2);
            if (typeof parsed.isWhatsapp === 'boolean') setIsPrimaryWhatsapp(parsed.isWhatsapp);
            if (typeof parsed.isAlt2Whatsapp === 'boolean') setIsAlt2Whatsapp(parsed.isAlt2Whatsapp);
            if (parsed.financialLoss) setMoneyLost(String(parsed.financialLoss));
            if (parsed.howContacted) setHowContacted(parsed.howContacted);
            if (parsed.category) {
              const matched = STANDARD_SCAM_CATEGORIES.find((c) =>
                c.toLowerCase().includes(parsed.category.toLowerCase()) || parsed.category.toLowerCase().includes(c.toLowerCase())
              );
              if (matched) setCategory(matched);
            }
            if (parsed.incidentDate && /^\d{4}-\d{2}-\d{2}$/.test(parsed.incidentDate)) {
              setReportDate(parsed.incidentDate);
            }
            if (parsed.description) setDescription(parsed.description);

            setOcrStatus('✨ Screenshot analyzed with AI OCR! All detected fields auto-populated.');
            setTimeout(() => setOcrStatus(null), 8000);
          } else {
            setOcrStatus('Screenshot attached.');
          }
        } catch (err: any) {
          console.warn('OCR fetch failed:', err);
          setOcrStatus('Screenshot attached.');
        } finally {
          setIsOcrProcessing(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setIsOcrProcessing(false);
      setOcrStatus(null);
      setFeedback({ type: 'error', message: `Could not process image: ${err.message}` });
    }
  }, [apiBase]);

  // Global Paste Handler for Instant OCR (Ctrl+V / Cmd+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            processImageWithOcr(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [processImageWithOcr]);

  // Window drag-and-drop handling
  useEffect(() => {
    const handleWindowDragOver = (e: DragEvent) => e.preventDefault();
    const handleWindowDrop = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
        const file = e.dataTransfer.files[0];
        if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|heic)$/i.test(file.name)) {
          processImageWithOcr(file);
        }
      }
    };

    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('drop', handleWindowDrop);
    return () => {
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('drop', handleWindowDrop);
    };
  }, [processImageWithOcr]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|heic)$/i.test(file.name)) {
        processImageWithOcr(file);
      }
    }
  };

  // Submit directly to Dokploy PostgreSQL Backend Endpoints
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const cleanDigits = phoneNumber.replace(/\D/g, '');
    if (!cleanDigits || cleanDigits.length < 7) {
      setFeedback({ type: 'error', message: 'Please enter a valid phone number with at least 7 digits.' });
      return;
    }

    setIsSubmitting(true);

    const altNumbersList: AltNumberEntry[] = [];
    if (altNumber1.trim()) {
      altNumbersList.push({
        phone: altNumber1.trim(),
        digits: altNumber1.replace(/\D/g, ''),
        is_whatsapp: false,
      });
    }
    if (altNumber2.trim()) {
      altNumbersList.push({
        phone: altNumber2.trim(),
        digits: altNumber2.replace(/\D/g, ''),
        is_whatsapp: isAlt2Whatsapp,
      });
    }

    const newRecord: ThreatRecord = {
      id: `report-${Date.now()}-${cleanDigits.slice(-4)}`,
      phone_number: formatDisplayPhone(phoneNumber, cleanDigits),
      phone_digits: cleanDigits,
      is_whatsapp: isPrimaryWhatsapp,
      alt_numbers: altNumbersList.length > 0 ? altNumbersList : undefined,
      category,
      impersonated_company: scammerName.trim() || 'N/A',
      scammer_name: scammerName.trim() || 'N/A',
      how_contacted: howContacted,
      amount_charged: moneyLost ? `$${moneyLost}` : 'N/A',
      money_lost: moneyLost ? parseFloat(moneyLost) : undefined,
      source_name: 'Community Ingestion',
      source_url: 'https://endscams.org',
      report_date: reportDate,
      description: description.trim() || 'Community threat report submitted via EndScams.',
      image_url: screenshotPreview || undefined,
      is_down: false,
    };

    // Dispatch directly to PostgreSQL API route candidates configured in Dokploy
    const candidateEndpoints = [
      `${apiBase}/api/records`,
      `${apiBase}/api/records/manual`,
      `${apiBase}/api/report`,
    ];

    let persisted = false;
    let lastError: string | null = null;

    const payload = {
      ...newRecord,
      phone: newRecord.phone_number,
      cleanPhone: newRecord.phone_digits,
      isWhatsapp: newRecord.is_whatsapp,
      scamType: newRecord.category,
      impersonatedCompany: newRecord.impersonated_company,
      detailedSummary: newRecord.description,
      detectedAt: newRecord.report_date,
    };

    for (const endpoint of candidateEndpoints) {
      try {
        const resp = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store',
          },
          body: JSON.stringify(payload),
        });
        if (resp.ok) {
          persisted = true;
          break;
        } else {
          lastError = `Server returned HTTP ${resp.status}`;
        }
      } catch (err: any) {
        lastError = err.message || 'Network unreachable';
      }
    }

    // Broadcast across active browser tabs
    try {
      const bc = new BroadcastChannel('end_scam_scan_sync_channel');
      bc.postMessage({
        type: 'ADD_RECORD',
        record: newRecord,
      });
      bc.close();
    } catch {}

    if (onRecordCreated) {
      onRecordCreated(newRecord);
    }

    if (persisted) {
      setFeedback({
        type: 'success',
        message: `Report successfully published! Threat line ${newRecord.phone_number} is committed to the Dokploy PostgreSQL database.`,
      });

      // Reset form
      setPhoneNumber('');
      setScammerName('');
      setAltNumber1('');
      setAltNumber2('');
      setIsAlt2Whatsapp(false);
      setIsPrimaryWhatsapp(false);
      setMoneyLost('');
      setDescription('');
      setScreenshotPreview(null);
    } else {
      setFeedback({
        type: 'error',
        message: `Saved locally, but failed to reach Dokploy PostgreSQL service (${lastError || 'Check server logs'}).`,
      });
    }

    setIsSubmitting(false);
  };

  const content = (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {onNavigateToTracker && (
        <div className="sticky top-2 z-20 flex items-center justify-between bg-slate-900/95 backdrop-blur border border-slate-800 p-2.5 rounded-2xl shadow-2xl">
          <button
            type="button"
            onClick={onNavigateToTracker}
            className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-xs transition shadow-md flex items-center space-x-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>← RETURN TO THREAT TRACKER</span>
          </button>

          <div className="flex items-center space-x-2">
            <a
              href="https://endscams.org"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition border border-slate-700 items-center space-x-1"
            >
              <span>endscams.org</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>
          </div>
        </div>
      )}

      <div className="bg-slate-900/95 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5 text-slate-100 font-sans relative">
        <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-slate-800/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center shrink-0 shadow-inner">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-lg sm:text-xl font-black text-slate-100 tracking-tight">
                  Report a Scam
                </h1>
                <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                  <Database className="w-3 h-3 text-emerald-400" />
                  <span>PostgreSQL Active</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Direct EndScams ingestion — immediately persists to PostgreSQL database and refreshes Tracker
              </p>
            </div>
          </div>

          <a
            href="https://endscams.org"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-950/80 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold border border-slate-800 transition"
          >
            <span>endscams.org</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>
        </div>

        {feedback && (
          <div
            className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-200 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-slate-300">
              <label className="font-semibold text-xs flex items-center space-x-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                <span>Screenshot / Evidence Image <span className="text-slate-500 font-normal">(Optional)</span></span>
              </label>
              <span className="text-[10px] text-amber-400 font-mono flex items-center space-x-1">
                <Sparkles className="w-3 h-3" />
                <span>AI OCR Auto-Fill (Drag, Drop, or Paste Ctrl+V)</span>
              </span>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingOver(false);
              }}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-5 sm:p-6 transition flex flex-col items-center justify-center space-y-2 cursor-pointer relative overflow-hidden ${
                isDraggingOver
                  ? 'border-amber-400 bg-amber-500/15 ring-2 ring-amber-400/40'
                  : 'border-slate-800 hover:border-slate-700 bg-slate-950/60 hover:bg-slate-950'
              }`}
            >
              {screenshotPreview ? (
                <div className="flex items-center space-x-3 w-full max-w-md bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                  <img src={screenshotPreview} alt="Evidence Preview" className="w-14 h-14 object-cover rounded-lg shrink-0 border border-slate-700" />
                  <div className="flex-1 truncate">
                    <span className="text-xs font-semibold text-slate-200 block truncate">Screenshot Attached</span>
                    <span className="text-[10px] text-emerald-400 flex items-center space-x-1">
                      {isOcrProcessing ? (
                        <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                      ) : (
                        <Check className="w-3 h-3 text-emerald-400" />
                      )}
                      <span>{ocrStatus || 'OCR Intelligence Extracted'}</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setScreenshotPreview(null);
                      setOcrStatus(null);
                    }}
                    className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="w-9 h-9 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center">
                    <Upload className="w-4 h-4" />
                  </div>
                  <div className="text-center">
                    <span className="text-xs font-semibold text-slate-200 block">
                      Click to upload or drag and drop scam screenshot
                    </span>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      PNG, JPG, WEBP up to 10MB • Or paste screenshot anywhere (Ctrl+V)
                    </p>
                  </div>
                </>
              )}

              {isOcrProcessing && (
                <div className="absolute inset-0 bg-slate-950/90 rounded-2xl flex items-center justify-center space-x-2 text-amber-400 text-xs font-bold backdrop-blur-xs">
                  <Sparkles className="w-4 h-4 animate-spin" />
                  <span>Analyzing screenshot with OCR & auto-populating fields...</span>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) processImageWithOcr(f);
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className="block text-slate-300 font-semibold">
                Scam Phone Number <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 1 (502) 237-9660 or 800-..."
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono text-xs"
              />
              <span className="text-[10px] text-slate-500 block">Real dialable scam numbers only.</span>
            </div>

            <div className="space-y-1">
              <label className="block text-slate-300 font-semibold">
                Scammer's name
              </label>
              <input
                type="text"
                placeholder="e.g. PCH, David Cooper, or Geek Squad"
                value={scammerName}
                onChange={(e) => setScammerName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className="block text-slate-300 font-semibold">
                Alt Phone Number #1 <span className="text-slate-500 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. +1 (502) 237-9661"
                value={altNumber1}
                onChange={(e) => setAltNumber1(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-slate-300 font-semibold">
                Alt Phone Number #2 / WhatsApp <span className="text-slate-500 font-normal">(Optional)</span>
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  placeholder="e.g. +234 810 552 9412"
                  value={altNumber2}
                  onChange={(e) => setAltNumber2(e.target.value)}
                  className="w-full pl-3.5 pr-24 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setIsAlt2Whatsapp(!isAlt2Whatsapp)}
                  className={`absolute right-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition flex items-center space-x-1 cursor-pointer border ${
                    isAlt2Whatsapp
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isAlt2Whatsapp ? 'bg-slate-950' : 'bg-slate-500'}`} />
                  <span>WhatsApp</span>
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className="block text-slate-300 font-semibold">
                Financial Loss ($) <span className="text-slate-500 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 250.00"
                value={moneyLost}
                onChange={(e) => setMoneyLost(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-slate-300 font-semibold">
                Scam Category <span className="text-red-400">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500 text-xs cursor-pointer truncate"
              >
                {STANDARD_SCAM_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} className="bg-slate-900">
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className="block text-slate-300 font-semibold">
                Date of Incident
              </label>
              <input
                type="date"
                required
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500 text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-slate-300 font-semibold">
                How Were You Contacted?
              </label>
              <select
                value={howContacted}
                onChange={(e) => setHowContacted(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500 text-xs cursor-pointer"
              >
                <option value="Phone Call" className="bg-slate-900">Phone Call</option>
                <option value="Text Message (SMS)" className="bg-slate-900">Text Message (SMS)</option>
                <option value="Email" className="bg-slate-900">Email</option>
                <option value="WhatsApp Message" className="bg-slate-900">WhatsApp Message</option>
                <option value="Pop-up / Web Alert" className="bg-slate-900">Pop-up / Web Alert</option>
                <option value="Social Media (Facebook / Telegram)" className="bg-slate-900">Social Media (Facebook / Telegram)</option>
                <option value="Letter / Mail" className="bg-slate-900">Letter / Mail</option>
                <option value="Other" className="bg-slate-900">Other</option>
              </select>
            </div>
          </div>

          <label className="flex items-center space-x-2 text-[11px] text-slate-300 hover:text-slate-100 cursor-pointer pt-1 select-none">
            <input
              type="checkbox"
              checked={isPrimaryWhatsapp}
              onChange={(e) => setIsPrimaryWhatsapp(e.target.checked)}
              className="rounded border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
            />
            <span>This primary phone number operates as a WhatsApp or direct messaging threat line</span>
          </label>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-slate-300 font-semibold">
                Describe What Happened <span className="text-red-400">*</span>
              </label>
              <span className="text-[10px] text-slate-500 font-mono">
                Persists to PostgreSQL & displays in Tracker
              </span>
            </div>
            <textarea
              required
              rows={4}
              placeholder="Provide details on the call or message: What did the scammer say? What name did they give? What fees or gift cards did they demand? Any secondary callback numbers..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 text-xs leading-relaxed resize-none"
            />
          </div>

          <div className="flex items-center justify-between flex-wrap gap-3 pt-3 border-t border-slate-800/80">
            <div className="flex items-center space-x-2 text-[11px] text-slate-400">
              <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Direct PostgreSQL connection ensures persistence across Dokploy restarts.</span>
            </div>

            <div className="flex items-center space-x-2.5">
              {onNavigateToTracker && (
                <button
                  type="button"
                  onClick={onNavigateToTracker}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400 text-slate-950 font-bold rounded-xl text-xs transition shadow-lg flex items-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                <ShieldAlert className="w-4 h-4 text-slate-950" />
                <span>{isSubmitting ? 'Writing to PostgreSQL...' : 'Submit Scam Report'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
        <div className="w-full max-w-4xl relative my-6">
          <button
            onClick={onCloseModal}
            className="absolute top-4 right-4 z-10 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 py-8 px-4 sm:px-6 lg:px-8">
      {content}
    </div>
  );
};

export default ReportScamPage;