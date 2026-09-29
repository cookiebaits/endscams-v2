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

export function getStoredSupabaseConfig(): { url: string; key: string } {
  return { url: '', key: '' };
}

export async function fetchServerSupabaseConfig(): Promise<{ url: string; key: string }> {
  return { url: '', key: '' };
}

export function getSupabaseClient(): any {
  return null;
}

export async function upsertToSupabaseDirect(_records: ThreatRecord[]): Promise<boolean> {
  return true;
}

export interface ReportScamPageProps {
  isModal?: boolean;
  onCloseModal?: () => void;
  onNavigateToTracker?: () => void;
  onRecordCreated?: (record: ThreatRecord) => void;
}

export const ReportScamPage: React.FC<ReportScamPageProps> = () => {
  const [iframeHeight, setIframeHeight] = useState<number>(2500);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin.includes('esscan.ai.studio') || event.origin.includes('localhost')) {
        if (event.data && typeof event.data.height === 'number' && event.data.height > 0) {
          setIframeHeight(Math.max(event.data.height, 1500));
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const todayDate = getPSTDateStamp();
  const iframeSrc = `https://esscan.ai.studio/?page=report&v=${todayDate}`;

  return (
    <div className="w-full min-h-screen bg-slate-950 flex flex-col items-center">
      <iframe
        src={iframeSrc}
        title="EndScams Report Scam"
        className="w-full border-0 block flex-1"
        style={{
          width: '100%',
          height: `${iframeHeight}px`,
          minHeight: '1500px',
          border: 'none',
        }}
        scrolling="no"
      />
    </div>
  );
};

export default ReportScamPage;
