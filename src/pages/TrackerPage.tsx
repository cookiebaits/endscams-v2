import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, Lock, ArrowLeft } from 'lucide-react';
import { isTrackerCountryAllowed } from '../utils/geoIp';

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

export function formatDisplayPhone(raw: string, digits: string): string {
  if (!raw && !digits) return '';
  const input = raw || digits || '';
  const rawTrim = input.trim();
  const isPlus = rawTrim.startsWith('+');
  const d = (digits || rawTrim).replace(/\D/g, '');
  if (!d) return rawTrim;

  if (isPlus || (d.length > 10 && !d.startsWith('1')) || (d.length >= 11 && !d.startsWith('1'))) {
    let ccLength = 3;
    if (d.startsWith('1')) {
      ccLength = 1;
    } else if (
      ['44', '33', '49', '39', '34', '31', '32', '41', '43', '46', '47', '45', '48', '61', '64', '81', '82', '86', '91', '20', '27', '55', '52', '54'].some(p => d.startsWith(p))
    ) {
      ccLength = 2;
    } else if (isPlus) {
      ccLength = Math.min(3, d.length);
    } else if (d.length <= 10) {
      ccLength = Math.min(3, Math.max(2, d.length - 7));
    }

    if (ccLength === 1 && d.length === 11) {
      return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
    }

    const cc = d.slice(0, ccLength);
    const rest = d.slice(ccLength);
    if (!rest) return `+(${cc})`;
    if (rest.length <= 3) return `+(${cc}) ${rest}`;
    if (rest.length <= 8) return `+(${cc}) ${rest.slice(0, 3)}-${rest.slice(3)}`;
    return `+(${cc}) ${rest.slice(0, 3)}-${rest.slice(3, 8)}${rest.length > 8 ? '-' + rest.slice(8) : ''}`;
  }

  if (d.length === 10) {
    return `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  if (d.length === 11 && d.startsWith('1')) {
    return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  }
  return `+${d}`;
}

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

export const MASTER_SEED_RECORDS: ThreatRecord[] = [];

export function isRecordMatch(record: ThreatRecord, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase().replace(/\D/g, '');
  const textQ = query.toLowerCase();
  return (
    record.phone_digits.includes(q) ||
    record.phone_number.toLowerCase().includes(textQ) ||
    (record.impersonated_company || '').toLowerCase().includes(textQ) ||
    (record.category || '').toLowerCase().includes(textQ)
  );
}

export async function fetchFromSupabase(): Promise<{ success: boolean; records?: ThreatRecord[]; error?: string }> {
  return { success: true, records: [] };
}

export async function upsertToSupabase(records: ThreatRecord[]): Promise<{ success: boolean; count?: number; error?: string }> {
  return { success: true, count: records.length };
}

export interface TrackerPageProps {
  onNavigateToReport?: () => void;
}

export const TrackerPage: React.FC<TrackerPageProps> = () => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState<number | string>('100vh');
  const [isLoading, setIsLoading] = useState(true);
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkGeoAccess() {
      const allowed = await isTrackerCountryAllowed();
      setIsAllowed(allowed);
    }
    checkGeoAccess();
  }, []);

  useEffect(() => {
    if (isAllowed === false) return;

    // PostMessage communication with iframe for dynamic height & modal scroll lock
    const handleMessage = (event: MessageEvent) => {
      if (!event.data) return;

      const { type, height, frameHeight } = event.data;

      if (type === 'FRAME_HEIGHT' || type === 'RESIZE' || type === 'SET_HEIGHT') {
        const h = height || frameHeight;
        if (h && typeof h === 'number' && h > 300) {
          setIframeHeight(h);
        }
      }

      if (type === 'LOCK_SCROLL' || type === 'OPEN_MODAL') {
        document.body.style.overflow = 'hidden';
      } else if (type === 'UNLOCK_SCROLL' || type === 'CLOSE_MODAL') {
        document.body.style.overflow = '';
      }
    };

    window.addEventListener('message', handleMessage);

    const scrollInterval = setInterval(() => {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          {
            type: 'PARENT_SCROLL_POSITION',
            scrollTop: window.scrollY,
            windowHeight: window.innerHeight,
          },
          '*'
        );
      }
    }, 500);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearInterval(scrollInterval);
      document.body.style.overflow = '';
    };
  }, [isAllowed]);

  if (isAllowed === null) {
    return (
      <div className="w-full min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-3 text-slate-300">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-sm font-medium">Verifying security authorization...</span>
      </div>
    );
  }

  if (isAllowed === false) {
    return (
      <div className="w-full min-h-[80vh] bg-slate-950 flex flex-col items-center justify-center px-4 text-center">
        <div className="max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black text-white">Access Denied</h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              For added security, access to the Threat Tracker page is restricted to authorized regions (United States, UK, Ireland, EU, Canada, and Australia).
            </p>
          </div>

          <div className="pt-2">
            <a
              href="/home"
              className="inline-flex items-center space-x-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm transition shadow-lg"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Home</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-slate-950 flex flex-col relative overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 z-10 bg-slate-950/90 flex flex-col items-center justify-center space-y-3 text-slate-300">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-medium">Loading Threat Tracker...</span>
        </div>
      )}

      <iframe
        ref={iframeRef}
        src="https://esscan.ai.studio"
        title="ESSCAN Threat Tracker"
        onLoad={() => setIsLoading(false)}
        className="w-full border-0 block flex-1"
        style={{
          height: typeof iframeHeight === 'number' ? `${iframeHeight}px` : iframeHeight,
          minHeight: 'calc(100vh - 80px)',
        }}
        scrolling="auto"
      />
    </div>
  );
};

export default TrackerPage;
