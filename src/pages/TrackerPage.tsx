import React, { useState, useEffect } from 'react';

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
  'Refund / Impersonator',
  'Lotto / Sweepstakes',
  'Spell / Non-Delivery',
  'Other',
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

export function getCleanCopyPhone(text: string): string {
  if (!text) return '';
  const digits = text.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  return digits || text;
}

export function isFictitiousOrInvalidPhone(digits: string): boolean {
  if (!digits || digits.length < 7) return true;
  if (/^(\d)\1+$/.test(digits)) return true;
  if (digits.includes('5550199') || digits.includes('5550100')) return true;
  return false;
}

export function deriveCountryInfo(rawOrFormatted: string): { name: string; flag: string; code: string } {
  const digits = (rawOrFormatted || '').replace(/\D/g, '');
  if (digits.startsWith('234')) return { name: 'Nigeria', flag: '🇳🇬', code: 'NG' };
  if (digits.startsWith('254')) return { name: 'Kenya', flag: '🇰🇪', code: 'KE' };
  if (digits.startsWith('27')) return { name: 'South Africa', flag: '🇿🇦', code: 'ZA' };
  if (digits.startsWith('44')) return { name: 'United Kingdom', flag: '🇬🇧', code: 'GB' };
  if (digits.startsWith('91')) return { name: 'India', flag: '🇮🇳', code: 'IN' };
  if (digits.startsWith('61')) return { name: 'Australia', flag: '🇦🇺', code: 'AU' };
  if (digits.length === 10 || (digits.length === 11 && digits.startsWith('1'))) {
    return { name: 'United States', flag: '🇺🇸', code: 'US' };
  }
  return { name: 'International', flag: '🌐', code: 'INT' };
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
  const digits = (record.phone_digits || record.phone_number || '').replace(/\D/g, '');
  if (digits.startsWith('234') || digits.startsWith('254') || digits.startsWith('27')) return true;
  return false;
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

export function normalizeToNumericalDate(dateStr: any): string {
  if (!dateStr) return getPSTDateStamp();
  const str = String(dateStr).trim();
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return getPSTDateStamp();
}

export function isRecordMatch(record: any, target10Digits: string): boolean {
  if (!record || !target10Digits) return false;
  const digits10 = target10Digits.replace(/\D/g, '').slice(-10);
  if (!digits10) return false;

  const mainDigits = (record.phone_digits || record.cleanPhone || record.phone_number || record.phone || '').replace(/\D/g, '');
  if (mainDigits.includes(digits10)) return true;

  if (Array.isArray(record.alt_numbers)) {
    for (const alt of record.alt_numbers) {
      const altDigits = (alt.digits || alt.phone || '').replace(/\D/g, '');
      if (altDigits.includes(digits10)) return true;
    }
  }

  return false;
}

export const MASTER_SEED_RECORDS: ThreatRecord[] = [];

export interface TrackerPageProps {
  onNavigateToReport?: () => void;
}

export const TrackerPage: React.FC<TrackerPageProps> = () => {
  const [iframeHeight, setIframeHeight] = useState<number>(32000);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin.includes('esscan.ai.studio') || event.origin.includes('localhost')) {
        if (event.data && typeof event.data.height === 'number' && event.data.height > 0) {
          setIframeHeight(Math.max(event.data.height, 25000));
        }

        // Handle modal lock scroll events from iframe
        if (event.data) {
          const type = event.data.type || event.data.action || '';
          if (
            type === 'OPEN_MODAL' ||
            type === 'LOCK_SCROLL' ||
            (type === 'MODAL_STATE_CHANGE' && event.data.isOpen)
          ) {
            document.body.style.overflow = 'hidden';
          } else if (
            type === 'CLOSE_MODAL' ||
            type === 'UNLOCK_SCROLL' ||
            (type === 'MODAL_STATE_CHANGE' && !event.data.isOpen)
          ) {
            document.body.style.overflow = '';
          }
        }
      }
    };

    const sendScrollPosition = () => {
      const iframe = document.querySelector('iframe[title="EndScams Threat Tracker"]') as HTMLIFrameElement;
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({
          type: 'PARENT_SCROLL_POSITION',
          scrollY: window.scrollY,
          viewportHeight: window.innerHeight
        }, '*');
      }
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('scroll', sendScrollPosition, { passive: true });
    window.addEventListener('resize', sendScrollPosition, { passive: true });

    // Send initial position immediately and after initial render frames
    sendScrollPosition();
    const interval = setInterval(sendScrollPosition, 500);

    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('scroll', sendScrollPosition);
      window.removeEventListener('resize', sendScrollPosition);
      clearInterval(interval);
      document.body.style.overflow = '';
    };
  }, []);

  const todayDate = getPSTDateStamp();
  const iframeSrc = `https://esscan.ai.studio?v=${todayDate}`;

  return (
    <div className="w-full min-h-screen bg-slate-950 flex flex-col">
      <iframe
        src={iframeSrc}
        title="EndScams Threat Tracker"
        loading="eager"
        // @ts-ignore
        fetchpriority="high"
        className="w-full border-0 block flex-1"
        style={{
          width: '100%',
          height: `${iframeHeight}px`,
          minHeight: '25000px',
          border: 'none',
        }}
        scrolling="no"
      />
    </div>
  );
};

export default TrackerPage;
