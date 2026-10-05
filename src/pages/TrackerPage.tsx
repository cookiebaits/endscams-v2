import React, { useState, useEffect, useRef } from 'react';

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
  if (!digits) return raw || '';
  if (digits.length === 10) {
    return `1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw.startsWith('+') ? raw : `+${digits}`;
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

  // Generate dynamic iframe URL with query params & timestamp cache-buster to prevent caching
  const [iframeSrc] = useState(() => {
    const searchParams = window.location.search;
    const cacheBuster = `_t=${Date.now()}`;
    if (searchParams) {
      return `https://esscan.ai.studio${searchParams}&${cacheBuster}`;
    }
    return `https://esscan.ai.studio/?${cacheBuster}`;
  });

  // Unique key generated once per component mount to force fresh iframe load without double-mounting
  const [iframeKey] = useState(() => Date.now());

  useEffect(() => {
    // PostMessage communication with iframe for dynamic height & modal scroll lock
    const handleMessage = (event: MessageEvent) => {
      if (!event.data) return;

      const { type, height, frameHeight } = event.data;

      // Handle height adjustments sent from embedded app
      if (type === 'FRAME_HEIGHT' || type === 'RESIZE' || type === 'SET_HEIGHT') {
        const h = height || frameHeight;
        if (h && typeof h === 'number' && h > 300) {
          setIframeHeight(h);
        }
      }

      // Handle modal lock / unlock scroll events
      if (type === 'LOCK_SCROLL' || type === 'OPEN_MODAL') {
        document.body.style.overflow = 'hidden';
      } else if (type === 'UNLOCK_SCROLL' || type === 'CLOSE_MODAL') {
        document.body.style.overflow = '';
      }
    };

    window.addEventListener('message', handleMessage);

    // Sync parent scroll position to iframe for overlay modal positioning
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
  }, []);

  return (
    <div className="w-full min-h-screen bg-slate-950 flex flex-col relative overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 z-10 bg-slate-950/90 flex flex-col items-center justify-center space-y-3 text-slate-300">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-medium">Loading Threat Tracker...</span>
        </div>
      )}

      <iframe
        key={iframeKey}
        ref={iframeRef}
        src={iframeSrc}
        title="ESSCAN Threat Tracker"
        onLoad={() => setIsLoading(false)}
        loading="eager"
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
