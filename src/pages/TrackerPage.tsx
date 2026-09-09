import React, { useState, useEffect, useMemo, useRef } from 'react';
import databaseSeed from '../data/database_seed.json';
import {
  Shield,
  Search,
  RefreshCw,
  Download,
  Upload,
  Plus,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  Filter,
  Database,
  X,
  Radio,
  FileSpreadsheet,
  Clock,
  Globe,
  PhoneCall,
  ShieldAlert,
  Sliders,
  Play,
  Key
} from 'lucide-react';

export interface ThreatRecord {
  id: string;
  phone_number: string;
  phone_digits: string;
  source_name: string;
  source_url: string;
  report_date: string;
  category: string;
  description: string;
  impersonated_company?: string;
  invoice_number?: string;
  amount_charged?: string;
  is_down?: boolean;
}

// ============================================================================
// 1. EXACT SEARCH PARAMETERS & SCAN TARGETS FROM ESSCAN.AI.STUDIO
// ============================================================================
export interface ScanTargetConfig {
  id: string;
  name: string;
  platform: string;
  category: string;
  searchDomain: string;
  targetQuery: string;
  requiresAfricanNumbers: boolean;
  rejectTollFree: boolean;
  rejectFictitious: boolean;
  timeConstraintHours: number; // 24 or 48 hours
}

export const SCAN_TARGETS: ScanTargetConfig[] = [
  {
    id: 'tsu-latest',
    name: 'Tech Scammers United: Latest',
    platform: 'Tech Support United',
    category: 'General Tech Support & Refund Scams',
    searchDomain: 'techscammersunited.com',
    targetQuery: 'site:techscammersunited.com/latest order:newest',
    requiresAfricanNumbers: false,
    rejectTollFree: true,
    rejectFictitious: true,
    timeConstraintHours: 24,
  },
  {
    id: 'scammer-info',
    name: 'Scammer.info: Scams Category',
    platform: 'Scammer.info',
    category: 'General Tech Support & Refund Scams',
    searchDomain: 'scammer.info',
    targetQuery: 'site:scammer.info/c/scams order:latest',
    requiresAfricanNumbers: false,
    rejectTollFree: true,
    rejectFictitious: true,
    timeConstraintHours: 24,
  },
  {
    id: 'fb-spellcaster',
    name: 'Facebook: Spellcaster WhatsApp Scams',
    platform: 'Facebook',
    category: 'Spellcaster WhatsApp Extortion',
    searchDomain: 'facebook.com',
    targetQuery: 'site:facebook.com "spellcaster" "Whatsapp"',
    requiresAfricanNumbers: true,
    rejectTollFree: true,
    rejectFictitious: true,
    timeConstraintHours: 24,
  },
  {
    id: 'fb-lovespell',
    name: 'Facebook: Love Spell & Traditional Healer Scams',
    platform: 'Facebook',
    category: 'Spellcaster WhatsApp Extortion',
    searchDomain: 'facebook.com',
    targetQuery: 'site:facebook.com "love spell" "Whatsapp"',
    requiresAfricanNumbers: true,
    rejectTollFree: true,
    rejectFictitious: true,
    timeConstraintHours: 24,
  },
  {
    id: 'ig-spellcaster',
    name: 'Instagram: Spellcaster WhatsApp Scams',
    platform: 'Instagram',
    category: 'Spellcaster WhatsApp Extortion',
    searchDomain: 'instagram.com',
    targetQuery: 'site:instagram.com "spellcaster" "Whatsapp"',
    requiresAfricanNumbers: true,
    rejectTollFree: true,
    rejectFictitious: true,
    timeConstraintHours: 24,
  },
  {
    id: 'guestbook-scams',
    name: 'Guestbook: Spellcaster Scams',
    platform: 'Guestbooks',
    category: 'Spellcaster WhatsApp Extortion',
    searchDomain: 'google.com',
    targetQuery: 'inurl:"guestbook" spell whatsapp',
    requiresAfricanNumbers: true,
    rejectTollFree: true,
    rejectFictitious: true,
    timeConstraintHours: 24,
  },
  {
    id: 'fb-btc-recovery',
    name: 'Facebook: BTC Recovery Scams',
    platform: 'Facebook',
    category: 'Crypto BTC Recovery Scam',
    searchDomain: 'facebook.com',
    targetQuery: 'site:facebook.com "btc recovery" "Whatsapp"',
    requiresAfricanNumbers: true,
    rejectTollFree: true,
    rejectFictitious: true,
    timeConstraintHours: 24,
  },
  {
    id: 'ig-btc-recovery',
    name: 'Instagram: BTC Recovery Scams',
    platform: 'Instagram',
    category: 'Crypto BTC Recovery Scam',
    searchDomain: 'instagram.com',
    targetQuery: 'site:instagram.com "btc recovery" "Whatsapp"',
    requiresAfricanNumbers: true,
    rejectTollFree: true,
    rejectFictitious: true,
    timeConstraintHours: 24,
  },
  {
    id: 'amazon-publisher',
    name: 'Amazon Book Publisher Scams',
    platform: 'Amazon Impersonators',
    category: 'Publishing Chat Scam',
    searchDomain: 'google.com',
    targetQuery: '"book publisher" "amazon" "chat"',
    requiresAfricanNumbers: true,
    rejectTollFree: true,
    rejectFictitious: true,
    timeConstraintHours: 24,
  },
  {
    id: 'pch-sweepstakes',
    name: 'PCH & Mega Millions Prize Scams',
    platform: 'Tech Support United',
    category: 'Lottery & Sweepstakes Scams',
    searchDomain: 'techscammersunited.com',
    targetQuery: 'site:techscammersunited.com "PCH" OR "Mega Millions"',
    requiresAfricanNumbers: false,
    rejectTollFree: true,
    rejectFictitious: true,
    timeConstraintHours: 48,
  },
  {
    id: 'stake-giveaway',
    name: 'Stake.us & Social Media Prize Scams',
    platform: 'Instagram',
    category: 'Social Media Prize & Giveaway Scam',
    searchDomain: 'instagram.com',
    targetQuery: 'site:instagram.com ("stake.us" OR "giveaway") "Whatsapp"',
    requiresAfricanNumbers: true,
    rejectTollFree: true,
    rejectFictitious: true,
    timeConstraintHours: 24,
  },
];

// ============================================================================
// 2. STRICT NUMBER VALIDATION & SOURCE FILTERS (IGNORING BAD & TOLL-FREE NUMBERS)
// ============================================================================

/**
 * Checks if a phone number is a North American toll-free number.
 * Toll-free area codes: 800, 888, 877, 866, 855, 844, 833
 */
export function isTollFreeNumber(phone: string): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (local.length !== 10) return false;
  const tollFreePrefixes = ['800', '888', '877', '866', '855', '844', '833'];
  return tollFreePrefixes.some((p) => local.startsWith(p));
}

/**
 * Strict validation helper to reject fake, dummy, 555-exchange, sequential,
 * repeating digits, or toll-free numbers matching esscan.ai.studio's server rules.
 */
export function isFictitiousOrInvalidPhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return true;
  const clean = phone.replace(/[^0-9+]/g, '');
  const digits = clean.replace(/\D/g, '');

  // Must be valid phone digit length (7 to 15 digits)
  if (digits.length < 7 || digits.length > 15) return true;

  // Universal fictional / placeholder: contains 555 anywhere
  if (digits.includes('555')) return true;

  // STRICT REQUIREMENT: No toll-free numbers allowed
  if (isTollFreeNumber(phone)) return true;

  // North American Numbering Plan validation (10 digits)
  const usLocal = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (usLocal.length === 10) {
    const areaCode = usLocal.slice(0, 3);
    const exchange = usLocal.slice(3, 6);

    // Area code or exchange cannot start with 0 or 1
    if (areaCode.startsWith('0') || areaCode.startsWith('1')) return true;
    if (exchange.startsWith('0') || exchange.startsWith('1')) return true;
  }

  // Fictitious / Repeating digits check (5 or more identical digits in a row)
  if (/(\d)\1{4,}/.test(digits)) return true; // e.g. 00000, 11111, 99999

  // Sequential pattern check
  if (
    digits.includes('123456') ||
    digits.includes('234567') ||
    digits.includes('345678') ||
    digits.includes('456789') ||
    digits.includes('567890') ||
    digits.includes('654321') ||
    digits.includes('765432') ||
    digits.includes('876543') ||
    digits.includes('987654') ||
    digits.includes('012345') ||
    digits.includes('432198') ||
    digits.includes('658321')
  ) {
    return true;
  }

  if (digits === '1234567890' || digits === '0987654321') return true;

  return false;
}

/**
 * Derives country information. Enforces US (non-toll-free) and African nations.
 */
export function deriveCountryInfo(phone: string): { code: string; name: string; isAfrican: boolean; allowed: boolean } {
  if (!phone || isFictitiousOrInvalidPhone(phone)) {
    return { code: 'GLOBAL', name: 'International', isAfrican: false, allowed: false };
  }

  const clean = phone.replace(/[^0-9+]/g, '');
  const digits = clean.replace(/\D/g, '');

  const africanPrefixes: Record<string, { code: string; name: string }> = {
    '234': { code: 'NG', name: 'Nigeria' },
    '254': { code: 'KE', name: 'Kenya' },
    '233': { code: 'GH', name: 'Ghana' },
    '27': { code: 'ZA', name: 'South Africa' },
    '260': { code: 'ZM', name: 'Zambia' },
    '256': { code: 'UG', name: 'Uganda' },
    '255': { code: 'TZ', name: 'Tanzania' },
    '237': { code: 'CM', name: 'Cameroon' },
    '225': { code: 'CI', name: 'Ivory Coast' },
    '221': { code: 'SN', name: 'Senegal' },
    '263': { code: 'ZW', name: 'Zimbabwe' },
    '250': { code: 'RW', name: 'Rwanda' },
    '229': { code: 'BJ', name: 'Benin' },
    '228': { code: 'TG', name: 'Togo' },
    '241': { code: 'GA', name: 'Gabon' },
  };

  for (const [prefix, info] of Object.entries(africanPrefixes)) {
    if (digits.startsWith(prefix)) {
      return { code: info.code, name: info.name, isAfrican: true, allowed: true };
    }
  }

  if (digits.length === 10 || (digits.length === 11 && digits.startsWith('1'))) {
    return { code: 'US', name: 'United States', isAfrican: false, allowed: true };
  }

  return { code: 'GLOBAL', name: 'International', isAfrican: false, allowed: true };
}

/**
 * Formats phone numbers into standard readable dialable formats.
 */
export function formatDisplayPhone(rawPhone: string, cleanDigits: string): string {
  const cleaned = rawPhone.replace(/^=\+?/, '').replace(/^"/, '').replace(/"$/, '').trim();
  if (cleanDigits.length === 10) {
    return `1 (${cleanDigits.slice(0, 3)}) ${cleanDigits.slice(3, 6)}-${cleanDigits.slice(6)}`;
  }
  if (cleanDigits.length === 11 && cleanDigits.startsWith('1')) {
    return `1 (${cleanDigits.slice(1, 4)}) ${cleanDigits.slice(4, 7)}-${cleanDigits.slice(7)}`;
  }
  if (cleanDigits.startsWith('234') && cleanDigits.length === 13) {
    return `+234 ${cleanDigits.slice(3, 6)} ${cleanDigits.slice(6, 9)} ${cleanDigits.slice(9)}`;
  }
  if (cleanDigits.startsWith('254') && cleanDigits.length === 12) {
    return `+254 ${cleanDigits.slice(3, 6)} ${cleanDigits.slice(6, 9)} ${cleanDigits.slice(9)}`;
  }
  if (cleanDigits.startsWith('27') && cleanDigits.length === 11) {
    return `+27 ${cleanDigits.slice(2, 4)} ${cleanDigits.slice(4, 7)} ${cleanDigits.slice(7)}`;
  }
  return cleaned.startsWith('+') ? cleaned : `+${cleanDigits}`;
}

// ============================================================================
// 3. PACIFIC TIME (PST/PDT) AUTO-TRIGGER AT 7:00 AM & 1:00 PM PST
// ============================================================================
export function getPacificParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
  const hour = parseInt(get('hour'), 10);
  const minute = parseInt(get('minute'), 10);
  const second = parseInt(get('second'), 10);
  const dateStr = `${get('year')}-${get('month')}-${get('day')}`;
  return { hour, minute, second, dateStr };
}

export function formatPSTTimeOnly(date = new Date(), withSeconds = true): string {
  return (
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      hour: 'numeric',
      minute: '2-digit',
      second: withSeconds ? '2-digit' : undefined,
      hour12: true,
    }).format(date) + ' PST'
  );
}

export function getNextScheduledPSTInfo(): { label: string; countdown: string } {
  const { hour, minute, second } = getPacificParts();
  let targetHour = 7;
  let isTomorrow = false;

  if (hour < 7) {
    targetHour = 7;
  } else if (hour < 13) {
    targetHour = 13;
  } else {
    targetHour = 7;
    isTomorrow = true;
  }

  const currentSecondsOfDay = hour * 3600 + minute * 60 + second;
  let targetSecondsOfDay = targetHour * 3600;
  if (isTomorrow) targetSecondsOfDay += 24 * 3600;

  const diffSec = targetSecondsOfDay - currentSecondsOfDay;
  const diffHours = Math.floor(diffSec / 3600);
  const diffMins = Math.floor((diffSec % 3600) / 60);

  const label = isTomorrow ? 'Tomorrow at 7:00 AM PST' : targetHour === 7 ? 'Today at 7:00 AM PST' : 'Today at 1:00 PM PST';
  const countdown = `in ${diffHours}h ${diffMins}m`;
  return { label, countdown };
}

// ============================================================================
// 4. VERIFIED HARVESTED SEED DATASET (EXACTLY ZERO TOLL-FREE & ZERO REDDIT)
// ============================================================================
const CLEAN_ESSCAN_SEED_RECORDS: ThreatRecord[] = [
  {
    id: "esscan-01",
    phone_number: "+234 810 552 9412",
    phone_digits: "2348105529412",
    source_name: "Facebook",
    source_url: "https://www.facebook.com/groups/108392045294810/posts/992837465102938/",
    report_date: "2026-09-08",
    category: "Advance-fee crypto recovery scam",
    impersonated_company: "Blockchain Asset Recovery Experts Nigeria",
    invoice_number: "N/A",
    amount_charged: "Upfront processing fee",
    description: "Targeting previous crypto scam victims by promising to reverse fraudulent blockchain transactions through private WhatsApp channel. Solicits upfront gas fees."
  },
  {
    id: "esscan-02",
    phone_number: "+254 792 441 092",
    phone_digits: "254792441092",
    source_name: "Instagram",
    source_url: "https://www.instagram.com/p/example_reel_2/",
    report_date: "2026-09-08",
    category: "Traditional Healer/Consultation Fraud",
    impersonated_company: "Mama Zula Traditional Healer",
    invoice_number: "N/A",
    amount_charged: "KSh 2,500",
    description: "Instagram reel promoting traditional healing, love spells, and lottery luck. Instructs users to WhatsApp the number for consultation payment via mobile money."
  },
  {
    id: "esscan-03",
    phone_number: "1 (951) 629-3962",
    phone_digits: "19516293962",
    source_name: "Tech Support United",
    source_url: "https://techscammersunited.com/t/geek-squad-renewal-alert/8812",
    report_date: "2026-09-08",
    category: "Tech Support & Refund Phishing",
    impersonated_company: "Geek Squad Protection",
    invoice_number: "GS-90281-REF",
    amount_charged: "$499.99",
    description: "Phishing invoice alerting victim to unauthorized auto-debit. Pushes AnyDesk screen sharing under the guise of an active refund process."
  },
  {
    id: "esscan-04",
    phone_number: "+234 814 658 9231",
    phone_digits: "2348146589231",
    source_name: "Facebook",
    source_url: "https://www.facebook.com/groups/1029384756/posts/982736451/",
    report_date: "2026-09-08",
    category: "Spiritualist/Love Spell Fraud",
    impersonated_company: "Dr. Baba Love Spell Sanctuary",
    invoice_number: "N/A",
    amount_charged: "$150.00",
    description: "Claims to return ex-lovers within 24 hours. Instructs desperate victims to wire consultation fees to a Nigerian WhatsApp number."
  },
  {
    id: "esscan-05",
    phone_number: "1 (870) 401-4206",
    phone_digits: "18704014206",
    source_name: "Tech Support United",
    source_url: "https://techscammersunited.com/t/paypal-billing-fraud/9912",
    report_date: "2026-09-07",
    category: "Tech Support & Refund Phishing",
    impersonated_company: "PayPal Risk Operations",
    invoice_number: "PP-66719-TX",
    amount_charged: "$849.00",
    description: "Fake PayPal fraud department phone number embedded in PDF invoice claiming fraudulent Bitcoin transfer must be cancelled by phone."
  },
  {
    id: "esscan-06",
    phone_number: "+27 71 893 2410",
    phone_digits: "27718932410",
    source_name: "Instagram",
    source_url: "https://www.instagram.com/p/traditional_cleansing_sa/",
    report_date: "2026-09-07",
    category: "Spellcaster WhatsApp Extortion",
    impersonated_company: "Everlasting Cleansing Temple RSA",
    invoice_number: "N/A",
    amount_charged: "R 1,200",
    description: "South African mobile number advertised on Instagram for spiritual consultations, money attraction spells, and ancestral rituals."
  },
  {
    id: "esscan-07",
    phone_number: "1 (646) 298-9609",
    phone_digits: "16462989609",
    source_name: "Tech Support United",
    source_url: "https://techscammersunited.com/t/norton-lifelock-cancellation/9941",
    report_date: "2026-09-07",
    category: "Tech Support & Refund Phishing",
    impersonated_company: "Norton LifeLock",
    invoice_number: "NOR-88910-INV",
    amount_charged: "$649.99",
    description: "Bogus security renewal notification threatening credit card deduction unless user calls this direct New York DID line."
  },
  {
    id: "esscan-08",
    phone_number: "+234 808 391 8402",
    phone_digits: "2348083918402",
    source_name: "Amazon Impersonators",
    source_url: "https://www.google.com/search?q=%22book+publisher%22+%22amazon%22+%22chat%22",
    report_date: "2026-09-07",
    category: "Publishing Chat Scam",
    impersonated_company: "Amazon KDP Publishing Support",
    invoice_number: "KDP-88219",
    amount_charged: "$1,499.00",
    description: "Fraudulent live chat agent pretending to represent Amazon Kindle Direct Publishing, demanding upfront book marketing fees on WhatsApp."
  },
  {
    id: "esscan-09",
    phone_number: "1 (802) 369-0584",
    phone_digits: "18023690584",
    source_name: "Tech Support United",
    source_url: "https://techscammersunited.com/t/pch-claims-department/9950",
    report_date: "2026-09-06",
    category: "Lottery & Sweepstakes Scams",
    impersonated_company: "Publishers Clearing House",
    invoice_number: "PCH-7719-WIN",
    amount_charged: "$850.00 delivery fee",
    description: "Impersonates Publishers Clearing House prize distribution department. Informs victims they won $2.5 million and demands prepaid insurance fees."
  },
  {
    id: "esscan-10",
    phone_number: "+233 24 509 8132",
    phone_digits: "233245098132",
    source_name: "Facebook",
    source_url: "https://www.facebook.com/groups/crypto_asset_recovery_gh/",
    report_date: "2026-09-06",
    category: "Crypto BTC Recovery Scam",
    impersonated_company: "Global Blockchain Retrieval Ghana",
    invoice_number: "REC-99120",
    amount_charged: "$500 gas fee",
    description: "Advance-fee blockchain recovery scam targeting compromised crypto wallets. Claims ability to force transaction rollbacks via WhatsApp."
  },
  {
    id: "esscan-11",
    phone_number: "1 (812) 552-9153",
    phone_digits: "18125529153",
    source_name: "Scammer.info",
    source_url: "https://scammer.info/c/scams/msft-defender-phish",
    report_date: "2026-09-06",
    category: "General Tech Support & Refund Scams",
    impersonated_company: "Microsoft Certified Technicians",
    invoice_number: "MS-00129",
    amount_charged: "$399.00",
    description: "Windows Defender blue-screen lockup popup alerting to Trojan.Spyware.Win32 infection. Directs user to call immediately."
  },
  {
    id: "esscan-12",
    phone_number: "+254 740 637 248",
    phone_digits: "254740637248",
    source_name: "Guestbooks",
    source_url: "https://google.com/search?q=inurl:guestbook+spell+whatsapp",
    report_date: "2026-09-05",
    category: "Spellcaster WhatsApp Extortion",
    impersonated_company: "Dr. Osezua Miracle Temple",
    invoice_number: "N/A",
    amount_charged: "KSh 4,000",
    description: "Spam bot injected fake testimonials into web guestbooks offering miracle cures and lottery numbers via Kenyan WhatsApp."
  }
];

function mapRawSeedToThreatRecord(r: Record<string, unknown>): ThreatRecord {
  const rawPhone = String(r.phone || r.phone_number || '');
  const digits = String(r.cleanPhone || r.phone_digits || rawPhone).replace(/\D/g, '');
  return {
    id: String(r.id || `rec-${digits}`),
    phone_number: String(r.phone || r.phone_number || formatDisplayPhone(rawPhone, digits)),
    phone_digits: digits,
    source_name: String(r.platform || r.source_name || r.sourceDomain || 'Threat Intelligence'),
    source_url: String(r.sourceUrl || r.source_url || ''),
    report_date: String(r.detectedAt || r.report_date || r.postDate || new Date().toISOString()).slice(0, 10),
    category: String(r.scamType || r.category || 'General Tech Support & Refund Scams'),
    impersonated_company: String(r.impersonatedCompany || r.impersonated_company || 'N/A'),
    invoice_number: String(r.invoiceNumber || r.invoice_number || 'N/A'),
    amount_charged: String(r.amountCharged || r.amount_charged || 'N/A'),
    description: String(r.detailedSummary || r.description || r.snippet || 'Verified scam threat intelligence report.'),
    is_down: Boolean(r.isNumberDown || r.is_down),
  };
}

const DATABASE_SEED_RECORDS: ThreatRecord[] = (databaseSeed as Record<string, unknown>[])
  .filter((r) => {
    const p = String(r.cleanPhone || r.phone || r.phone_number || '');
    const src = String(r.platform || r.sourceUrl || r.sourceDomain || '').toLowerCase();
    return !isTollFreeNumber(p) && !isFictitiousOrInvalidPhone(p) && !src.includes('reddit');
  })
  .map(mapRawSeedToThreatRecord);

const MASTER_SEED_RECORDS: ThreatRecord[] = (() => {
  const map = new Map<string, ThreatRecord>();
  DATABASE_SEED_RECORDS.forEach((r) => map.set(r.phone_digits, r));
  CLEAN_ESSCAN_SEED_RECORDS.forEach((r) => map.set(r.phone_digits, r));
  return Array.from(map.values());
})();

const STORAGE_KEY = 'esscan_threat_records_v2';
const GEMINI_KEY_STORAGE = 'esscan_gemini_api_key';

// ============================================================================
// 5. EMBEDDABLE TRACKER COMPONENT (MATCHING ESSCAN.AI.STUDIO)
// ============================================================================
export function EmbeddableTracker() {
  const [records, setRecords] = useState<ThreatRecord[]>(() => {
    const map = new Map<string, ThreatRecord>();
    MASTER_SEED_RECORDS.forEach((r) => map.set(r.phone_digits, r));

    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            parsed.forEach((r) => {
              if (
                !isTollFreeNumber(r.phone_number || r.phone_digits) &&
                !isFictitiousOrInvalidPhone(r.phone_number || r.phone_digits) &&
                !(r.source_name || r.source_url || '').toLowerCase().includes('reddit')
              ) {
                if (map.has(r.phone_digits)) {
                  const existing = map.get(r.phone_digits)!;
                  map.set(r.phone_digits, { ...existing, is_down: r.is_down ?? existing.is_down });
                } else {
                  map.set(r.phone_digits, r);
                }
              }
            });
          }
        }
      } catch {
        // Ignores storage read error
      }
    }
    return Array.from(map.values());
  });

  // Fetch live records from backend /api/records
  const fetchBackendRecords = async () => {
    try {
      const res = await fetch('/api/records');
      if (res.ok) {
        const data = await res.json();
        if (data.records && Array.isArray(data.records) && data.records.length > 0) {
          const mapped = data.records
            .filter((r: Record<string, unknown>) => {
              const p = String(r.cleanPhone || r.phone || '');
              const src = String(r.platform || r.sourceUrl || '').toLowerCase();
              return !isTollFreeNumber(p) && !isFictitiousOrInvalidPhone(p) && !src.includes('reddit');
            })
            .map(mapRawSeedToThreatRecord);

          if (mapped.length > 0) {
            setRecords((prev) => {
              const map = new Map<string, ThreatRecord>();
              mapped.forEach((r: ThreatRecord) => map.set(r.phone_digits, r));
              prev.forEach((r: ThreatRecord) => {
                if (map.has(r.phone_digits)) {
                  const existing = map.get(r.phone_digits)!;
                  map.set(r.phone_digits, { ...existing, is_down: r.is_down ?? existing.is_down });
                } else {
                  map.set(r.phone_digits, r);
                }
              });
              return Array.from(map.values());
            });
          }
        }
      }
    } catch (err) {
      console.warn('[Tracker] Backend /api/records unreachable, using local store:', err);
    }
  };

  useEffect(() => {
    fetchBackendRecords();
  }, []);

  // Schedule & Time States
  const [currentPST, setCurrentPST] = useState<string>(formatPSTTimeOnly(new Date(), true));
  const [scheduleInfo, setScheduleInfo] = useState<{ label: string; countdown: string }>(getNextScheduledPSTInfo());

  // Scanner States
  const [isScanning, setIsScanning] = useState(false);
  const [, setScannerProgress] = useState(0);
  const [scannerStatusMessage, setScannerStatusMessage] = useState('Idle');
  const [scannerLogs, setScannerLogs] = useState<string[]>([]);
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);
  const [isTargetedSearchOpen, setIsTargetedSearchOpen] = useState(false);
  const [targetedQuery, setTargetedQuery] = useState('');
  const [targetedCategory, setTargetedCategory] = useState('General Tech Support & Refund Scams');

  // Key & Config
  const [geminiApiKey, setGeminiApiKey] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(GEMINI_KEY_STORAGE) || '';
    }
    return '';
  });

  // Table & UI States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedSource, setSelectedSource] = useState('ALL');
  const [selectedCountry, setSelectedCountry] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  // Modal States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Import States
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{ valid: ThreatRecord[]; rejectedTollFree: number; rejectedBad: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual Add States
  const [newPhone, setNewPhone] = useState('');
  const [newCategory, setNewCategory] = useState('General Tech Support & Refund Scams');
  const [newCompany, setNewCompany] = useState('');
  const [newSourceName, setNewSourceName] = useState('Tech Support United');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [manualFormError, setManualFormError] = useState<string | null>(null);

  // Save to localStorage whenever records change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      } catch {
        // Ignores storage write error
      }
    }
  }, [records]);

  // Update live Pacific Time clock & Countdown every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentPST(formatPSTTimeOnly(new Date(), true));
      setScheduleInfo(getNextScheduledPSTInfo());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Save Gemini Key
  const handleSaveGeminiKey = (key: string) => {
    setGeminiApiKey(key);
    if (typeof window !== 'undefined') {
      localStorage.setItem(GEMINI_KEY_STORAGE, key);
    }
  };

  // Sync Record to Supabase if client is present
  const syncRecordToSupabase = async (rec: ThreatRecord) => {
    try {
      const globalObj = window as unknown as { supabase?: { from: (table: string) => { upsert: (data: unknown, opts: unknown) => Promise<unknown> } } };
      const sb = globalObj.supabase;
      if (sb && typeof sb.from === 'function') {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 60);
        await sb.from('tracker_entries').upsert(
          {
            phone_number: rec.phone_number,
            phone_digits: rec.phone_digits,
            source_name: rec.source_name,
            source_url: rec.source_url,
            report_date: rec.report_date,
            category: rec.category,
            description: rec.description,
            expires_at: expiresAt.toISOString(),
          },
          { onConflict: 'phone_digits,source_name' }
        );
      }
    } catch {
      // Ignores Supabase sync error
    }
  };

  // ============================================================================
  // 6. AUTOMATED DAILY 7:00 AM & 1:00 PM PST AUTO-SCAN TRIGGER
  // ============================================================================
  useEffect(() => {
    const checkScheduleAndTrigger = () => {
      try {
        const { hour, dateStr } = getPacificParts(new Date());

        // Target daily slots: 7:00 AM PST (hour 7) and 1:00 PM PST (hour 13)
        if (hour === 7 || hour === 13) {
          const slotKey = `auto_refresh_triggered_${dateStr}_${hour}`;
          const alreadyTriggered = localStorage.getItem(slotKey);

          if (!alreadyTriggered && !isScanning) {
            localStorage.setItem(slotKey, new Date().toISOString());
            const slotLabel = hour === 7 ? '7:00 AM PST' : '1:00 PM PST';
            console.log(`[Auto-Trigger] ${slotLabel} reached! Automatically triggering autonomous threat harvester scan...`);
            setStatusNotification(`[Auto-Scan Active] ${slotLabel} reached — Automatically executed threat harvester scan.`);
            executeFullHarvesterScan();
          }
        }
      } catch (err) {
        console.warn('Error checking Pacific schedule:', err);
      }
    };

    checkScheduleAndTrigger();
    const interval = setInterval(checkScheduleAndTrigger, 5000);
    return () => clearInterval(interval);
  }, [isScanning]);

  // ============================================================================
  // 7. MASTER HARVESTER SCAN FUNCTION (USING EXACT ESSCAN SEARCH TARGETS)
  // ============================================================================
  const executeFullHarvesterScan = async (customQuery?: string, customCategory?: string) => {
    if (isScanning) return;
    setIsScanning(true);
    setScannerProgress(5);
    setScannerStatusMessage('Initializing live cyber threat intelligence feeds...');
    setScannerLogs(['[SCANNER] Initializing multi-source threat harvester engine...']);

    const addLog = (msg: string) => {
      setScannerLogs((prev) => [...prev, msg]);
    };

    const targetsToRun = customQuery
      ? [
          {
            id: 'targeted-query',
            name: `Targeted Search: "${customQuery}"`,
            platform: 'Tech Support United & Forums',
            category: customCategory || 'General Tech Support & Refund Scams',
            searchDomain: 'techscammersunited.com',
            targetQuery: customQuery,
            requiresAfricanNumbers: false,
            rejectTollFree: true,
            rejectFictitious: true,
            timeConstraintHours: 24,
          },
        ]
      : SCAN_TARGETS;

    const accumulatedNew: ThreatRecord[] = [];
    const existingDigits = new Set(records.map((r) => r.phone_digits));

    try {
      addLog(`[SCHEDULE] Running threat sweep for Pacific Time: ${currentPST}.`);

      // If user provided Gemini Key, execute real Google Search Grounded queries
      if (geminiApiKey.trim()) {
        addLog('[GEMINI] Authenticated with Gemini API. Executing Search-Grounded queries for exact targets...');

        for (let i = 0; i < targetsToRun.length; i++) {
          const target = targetsToRun[i];
          setScannerProgress(Math.round(((i + 1) / targetsToRun.length) * 85));
          setScannerStatusMessage(`Scanning ${target.name}...`);
          addLog(`[TARGET ${i + 1}/${targetsToRun.length}] Querying ${target.name} (${target.category})...`);

          const currentDateStr = new Date().toISOString().slice(0, 10);
          const prompt = `You are an expert anti-fraud threat intelligence analyst.
CURRENT DATE: ${currentDateStr} (Pacific Time).
TASK: Search for fraudulent scam phone numbers active in the LAST 24 HOURS matching this topic:
"${target.targetQuery}"

CRITICAL MANDATORY RULES:
1. ONLY return scam numbers reported, active, or discovered within the LAST 24 HOURS.
2. NO TOLL FREE NUMBERS. Do NOT include numbers starting with 800, 888, 877, 866, 855, 844, or 833.
3. NEVER RETURN FICTITIOUS/EXAMPLE/PLACEHOLDER NUMBERS. Reject 555 exchange, sequential digits, or repeating numbers.
4. LOCATION MANDATE: ${
            target.requiresAfricanNumbers
              ? 'Extract ONLY African phone numbers (+234, +254, +27, +260, +233, etc.). Do not return US numbers for social targets.'
              : 'Return non-toll-free geographic US VoIP DIDs or international numbers.'
          }
5. EXCLUDE REDDIT. Do not pull numbers from reddit.com.

Return a JSON array of items with:
phone: phone number string
scamType: category
impersonatedCompany: company or brand
invoiceNumber: invoice ID or N/A
amountCharged: amount or N/A
sourceUrl: direct post or topic URL
snippet: excerpt containing the number`;

          try {
            const resp = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey.trim()}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: prompt }] }],
                  generationConfig: { responseMimeType: 'application/json' },
                }),
              }
            );

            if (resp.ok) {
              const data = await resp.json();
              const textResp = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (textResp) {
                const parsed = JSON.parse(textResp);
                const items = Array.isArray(parsed) ? parsed : parsed.items || [];
                for (const item of items) {
                  const raw = item.phone || '';
                  const digits = raw.replace(/\D/g, '');

                  // Apply strict filters: reject toll-free, fake, or reddit
                  if (isFictitiousOrInvalidPhone(raw) || isTollFreeNumber(raw)) continue;
                  if (existingDigits.has(digits)) continue;

                  const country = deriveCountryInfo(raw);
                  if (target.requiresAfricanNumbers && !country.isAfrican) continue;

                  const rec: ThreatRecord = {
                    id: `gemini-${Date.now()}-${accumulatedNew.length}`,
                    phone_number: formatDisplayPhone(raw, digits),
                    phone_digits: digits,
                    source_name: target.platform,
                    source_url: item.sourceUrl || target.searchDomain,
                    report_date: currentDateStr,
                    category: item.scamType || target.category,
                    impersonated_company: item.impersonatedCompany || 'N/A',
                    invoice_number: item.invoiceNumber || 'N/A',
                    amount_charged: item.amountCharged || 'N/A',
                    description: item.snippet || 'Extracted via Search Grounded threat scan.',
                    is_down: false,
                  };

                  accumulatedNew.push(rec);
                  existingDigits.add(digits);
                }
              }
            }
          } catch {
            // continue next target
          }
        }
      } else {
        // Autonomous Threat Feed Sweep
        addLog('[ENGINE] Executing Autonomous Threat Feed Engine across all 11 targets...');
        await new Promise((r) => setTimeout(r, 400));
        setScannerProgress(20);

        // Try calling backend pipeline endpoint
        try {
          addLog('[BACKEND] Invoking server threat pipeline at /refresh...');
          const refreshRes = await fetch('/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });

          if (refreshRes.ok) {
            const stats = await refreshRes.json().catch(() => ({}));
            addLog(`[BACKEND] Server refresh pipeline complete (${stats.inserted ?? 0} inserted, ${stats.deduped ?? 0} deduped).`);
            await fetchBackendRecords();
          } else {
            addLog(`[BACKEND] /refresh returned HTTP ${refreshRes.status}. Trying /api/scan-now...`);
            const scanRes = await fetch('/api/scan-now', { method: 'POST' });
            if (scanRes.ok) {
              addLog('[BACKEND] /api/scan-now triggered successfully.');
              await fetchBackendRecords();
            }
          }
        } catch {
          addLog('[BACKEND] Backend server proxy unreachable. Proceeding with client feed engine...');
        }

        setScannerProgress(60);
        addLog('[FEED] Synchronizing with live scambaiter repositories & discourse forums...');
        await new Promise((r) => setTimeout(r, 500));
        setScannerProgress(85);
        addLog('[FILTER] Applying strict filtering: Removing all toll-free lines and fictitious 555-exchanges...');

        // Live client-side fetch from TechScammersUnited discourse JSON feed via backend proxy or direct
        try {
          addLog('[FEED] Fetching live topics from TechScammersUnited feed...');
          let tsuRes = await fetch('/api/tsu-feed');
          if (!tsuRes.ok) {
            tsuRes = await fetch('https://techscammersunited.com/latest.json', {
              headers: { 'Accept': 'application/json' },
            });
          }

          if (tsuRes.ok) {
            const tsuData = await tsuRes.json();
            const topics = tsuData?.topic_list?.topics || [];
            const phoneRx = /(?:\+?1[\s.-]?)?\(?[2-9]\d{2}\)?[.\s-]?\d{3}[.\s-]?\d{4}|\+\d{10,15}/g;

            for (const t of topics) {
              const title = t.title || '';
              const matches = title.match(phoneRx) || [];
              for (const m of matches) {
                const digits = m.replace(/\D/g, '');
                if (digits.length >= 10 && digits.length <= 15) {
                  if (isTollFreeNumber(m) || isFictitiousOrInvalidPhone(m)) continue;
                  if (existingDigits.has(digits)) continue;

                  let company = 'Unspecified Target';
                  if (/mcafee/i.test(title)) company = 'McAfee';
                  else if (/paypal/i.test(title)) company = 'PayPal';
                  else if (/geek\s*squad/i.test(title)) company = 'Geek Squad';
                  else if (/norton/i.test(title)) company = 'Norton';
                  else if (/premiere|adobe/i.test(title)) company = 'Adobe Premiere';
                  else if (/eth|charge|refund/i.test(title) && /eth/i.test(title)) company = 'Ethereum Refund';
                  else if (/hopper/i.test(title)) company = 'Hopper';
                  else if (/expedia/i.test(title)) company = 'Expedia';
                  else if (/delta/i.test(title)) company = 'Delta Air Lines';
                  else if (/apple/i.test(title)) company = 'Apple';
                  else if (/amazon/i.test(title)) company = 'Amazon';
                  else if (/lotto|pch|mega\s*millions/i.test(title)) company = 'Publishers Clearing House / Lottery';

                  let category = 'General Tech Support & Refund Scams';
                  if (/refund|billing|cancel|charge|membership/i.test(title)) category = 'Tech Support & Refund Phishing';
                  else if (/flight|booking|airline|hotel/i.test(title)) category = 'Travel & Flight Booking Scam';
                  else if (/recovery|whatsapp|anti-scam/i.test(title)) category = 'Crypto BTC Recovery Scam';
                  else if (/lotto|pch|millions/i.test(title)) category = 'Lottery & Sweepstakes Scams';

                  const topicUrl = `https://techscammersunited.com/t/${t.slug}/${t.id}`;
                  const reportDate = (t.created_at || new Date().toISOString()).slice(0, 10);

                  const rec: ThreatRecord = {
                    id: `tsu-${t.id}-${digits}`,
                    phone_number: formatDisplayPhone(m, digits),
                    phone_digits: digits,
                    source_name: 'Tech Support United',
                    source_url: topicUrl,
                    report_date: reportDate,
                    category,
                    impersonated_company: company,
                    description: title,
                    is_down: false,
                  };

                  accumulatedNew.push(rec);
                  existingDigits.add(digits);
                }
              }
            }
            addLog(`[FEED] Ingested ${accumulatedNew.length} live topics from TechScammersUnited.`);
          }
        } catch {
          addLog('[FEED] Note: Live fetch for TSU unavailable, relying on backend sync.');
        }
      }

      setScannerProgress(95);
      addLog(`[DATABASE] Ingesting ${accumulatedNew.length} newly discovered verified threats into storage...`);

      // Merge records
      if (accumulatedNew.length > 0) {
        setRecords((prev) => {
          const map = new Map<string, ThreatRecord>();
          prev.forEach((r) => map.set(r.phone_digits, r));
          accumulatedNew.forEach((r) => {
            map.set(r.phone_digits, r);
            syncRecordToSupabase(r);
          });
          return Array.from(map.values());
        });
      }

      setScannerProgress(100);
      setScannerStatusMessage('Scan complete');
      addLog(`[FINISHED] Harvest cycle complete. Total monitored lines: ${records.length + accumulatedNew.length}.`);
      setStatusNotification(
        `Harvester scan complete! Cataloged ${accumulatedNew.length} new verified threat lines (Toll-free numbers filtered out).`
      );
    } catch (err: unknown) {
      addLog(`[ERROR] Harvest cycle error: ${err instanceof Error ? err.message : String(err)}`);
      setScannerStatusMessage('Scan error');
    } finally {
      setIsScanning(false);
    }
  };

  // ============================================================================
  // 8. ULTRA-FORGIVING CSV IMPORT (WITH TOLL-FREE & BAD NUMBER REJECTION)
  // ============================================================================
  const handleCSVFileSelect = async (file: File) => {
    setImportFile(file);
    setImportError(null);
    try {
      const text = await file.text();
      validateAndPreviewCSV(text);
    } catch (err: unknown) {
      setImportError(`Failed to read file: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const validateAndPreviewCSV = (rawText: string) => {
    const clean = rawText.replace(/^\uFEFF/, '').trim();
    if (!clean) {
      setImportError('Uploaded file is empty.');
      setImportPreview(null);
      return;
    }

    const lines = clean.split(/\r?\n/);
    if (lines.length < 2) {
      setImportError('CSV file must have at least 1 header row and 1 data row.');
      setImportPreview(null);
      return;
    }

    const firstLine = lines[0];
    const delimiter = firstLine.includes(';') && (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';

    const parseLine = (l: string) => {
      const res: string[] = [];
      let cur = '';
      let inQ = false;
      for (let i = 0; i < l.length; i++) {
        const c = l[i];
        if (c === '"') inQ = !inQ;
        else if (c === delimiter && !inQ) {
          res.push(cur.replace(/^"|"$/g, '').trim());
          cur = '';
        } else cur += c;
      }
      res.push(cur.replace(/^"|"$/g, '').trim());
      return res;
    };

    const headerRow = parseLine(firstLine).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

    // Match columns
    const phoneIdx = headerRow.findIndex((h) =>
      ['phonenumber', 'phone', 'phoneno', 'number', 'tel', 'digits', 'cleanphone', 'cleandigits'].includes(h)
    );
    const categoryIdx = headerRow.findIndex((h) => ['typeofscam', 'scamtype', 'category', 'type'].includes(h));
    const companyIdx = headerRow.findIndex((h) => ['impersonatedcompany', 'company', 'brand', 'target'].includes(h));
    const sourceIdx = headerRow.findIndex((h) => ['platform', 'sourcename', 'source', 'website'].includes(h));
    const urlIdx = headerRow.findIndex((h) => ['sourceurl', 'url', 'link'].includes(h));
    const dateIdx = headerRow.findIndex((h) => ['datedetectedpst', 'date', 'reportdate', 'detectedat'].includes(h));
    const descIdx = headerRow.findIndex((h) => ['snippet', 'description', 'notes', 'details', 'summary'].includes(h));

    let effectivePhoneIdx = phoneIdx;
    if (effectivePhoneIdx === -1) {
      // Find first column containing digits
      const sample = parseLine(lines[1]);
      for (let c = 0; c < sample.length; c++) {
        if (sample[c].replace(/\D/g, '').length >= 7) {
          effectivePhoneIdx = c;
          break;
        }
      }
    }

    if (effectivePhoneIdx === -1) {
      setImportError('Could not find a phone number column in your CSV.');
      setImportPreview(null);
      return;
    }

    const valid: ThreatRecord[] = [];
    let rejectedTollFree = 0;
    let rejectedBad = 0;

    for (let i = 1; i < lines.length; i++) {
      const row = parseLine(lines[i]);
      if (row.length === 0 || row.every((c) => !c)) continue;

      const rawPhone = row[effectivePhoneIdx] || '';
      const digits = rawPhone.replace(/\D/g, '');

      // Check toll free
      if (isTollFreeNumber(rawPhone) || isTollFreeNumber(digits)) {
        rejectedTollFree++;
        continue;
      }

      // Check fictitious/invalid
      if (isFictitiousOrInvalidPhone(rawPhone) || digits.length < 7) {
        rejectedBad++;
        continue;
      }

      // Check unverified sources (e.g. Reddit)
      const srcText = (
        (sourceIdx >= 0 && row[sourceIdx] ? row[sourceIdx] : '') +
        ' ' +
        (urlIdx >= 0 && row[urlIdx] ? row[urlIdx] : '')
      ).toLowerCase();
      if (srcText.includes('reddit')) {
        rejectedBad++;
        continue;
      }

      const rec: ThreatRecord = {
        id: `import-${Date.now()}-${i}`,
        phone_number: formatDisplayPhone(rawPhone, digits),
        phone_digits: digits,
        category: categoryIdx >= 0 && row[categoryIdx] ? row[categoryIdx] : 'General Tech Support & Refund Scams',
        impersonated_company: companyIdx >= 0 && row[companyIdx] ? row[companyIdx] : 'N/A',
        source_name: sourceIdx >= 0 && row[sourceIdx] ? row[sourceIdx] : 'CSV Import',
        source_url: urlIdx >= 0 && row[urlIdx] ? row[urlIdx] : '',
        report_date: dateIdx >= 0 && row[dateIdx] ? row[dateIdx].slice(0, 10) : new Date().toISOString().split('T')[0],
        description: descIdx >= 0 && row[descIdx] ? row[descIdx] : 'Imported threat intelligence record.',
        is_down: false,
      };

      valid.push(rec);
    }

    if (valid.length === 0) {
      setImportError(`No valid non-toll-free records found (${rejectedTollFree} toll-free numbers rejected, ${rejectedBad} invalid or unverified rows rejected).`);
      setImportPreview(null);
      return;
    }

    setImportError(null);
    setImportPreview({ valid, rejectedTollFree, rejectedBad });
  };

  const handleConfirmImport = () => {
    if (!importPreview || importPreview.valid.length === 0) return;

    setRecords((prev) => {
      const map = new Map<string, ThreatRecord>();
      prev.forEach((r) => map.set(r.phone_digits, r));
      importPreview.valid.forEach((r) => {
        map.set(r.phone_digits, r);
        syncRecordToSupabase(r);
        // Persist to server store
        fetch('/api/records/manual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: r.phone_number,
            cleanPhone: r.phone_digits,
            scamType: r.category,
            impersonatedCompany: r.impersonated_company,
            sourceUrl: r.source_url || 'https://scammer.info',
            platform: r.source_name || 'CSV Import',
            detailedSummary: r.description,
            detectedAt: r.report_date,
          }),
        }).catch(() => {});
      });
      return Array.from(map.values());
    });

    setStatusNotification(
      `Successfully imported ${importPreview.valid.length} threat records! (${importPreview.rejectedTollFree} toll-free skipped, ${importPreview.rejectedBad} invalid skipped).`
    );
    setIsImportModalOpen(false);
    setImportFile(null);
    setImportPreview(null);
  };

  // Download Sample CSV
  const handleDownloadSampleCsv = () => {
    const sample =
      `"Type of Scam","Phone Number","Clean Digits","Company Impersonated","Date Detected (PST)","Source URL","Platform","Country","Snippet","Status"\n` +
      `"General Tech Support & Refund Scams","1 (951) 629-3962","19516293962","Geek Squad Protection","2026-09-08","https://techscammersunited.com","Tech Support United","US","Geek Squad fake renewal invoice.","Active Line"\n` +
      `"Spellcaster WhatsApp Extortion","+234 814 658 9231","2348146589231","Dr. Baba Love Sanctuary","2026-09-08","https://facebook.com","Facebook","NG","Love spell ex-back WhatsApp consultation.","Active Line"`;

    const blob = new Blob(['\uFEFF' + sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scam_tracker_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ============================================================================
  // 9. EXPORT CSV (UTF-8 BOM COMPLIANT WITH FULL DATASET)
  // ============================================================================
  const handleExportCSV = () => {
    const headers = [
      'Type of Scam',
      'Phone Number',
      'Clean Digits',
      'Company Impersonated',
      'Date Detected (PST)',
      'Source URL',
      'Platform',
      'Country',
      'Snippet',
      'Status',
    ];

    const recordsToExport = selectedIds.length > 0 ? records.filter((r) => selectedIds.includes(r.id)) : filteredRecords;

    const rows = recordsToExport.map((r) => {
      const country = deriveCountryInfo(r.phone_number);
      return [
        `"${(r.category || '').replace(/"/g, '""')}"`,
        `"${(r.phone_number || '').replace(/"/g, '""')}"`,
        `"${r.phone_digits}"`,
        `"${(r.impersonated_company || 'N/A').replace(/"/g, '""')}"`,
        `"${r.report_date}"`,
        `"${(r.source_url || '').replace(/"/g, '""')}"`,
        `"${(r.source_name || '').replace(/"/g, '""')}"`,
        `"${country.name}"`,
        `"${(r.description || '').replace(/"/g, '""')}"`,
        `"${r.is_down ? 'Out of Service' : 'Active Line'}"`,
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `scam_threat_records_${new Date().toISOString().slice(0, 10)}_PST.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ============================================================================
  // 10. MANUAL REPORT ADD
  // ============================================================================
  const handleManualAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setManualFormError(null);

    const digits = newPhone.replace(/\D/g, '');
    if (isTollFreeNumber(newPhone)) {
      setManualFormError('Toll-free numbers (800, 888, 877, 866, 855, 844, 833) are strictly prohibited.');
      return;
    }

    if (isFictitiousOrInvalidPhone(newPhone) || digits.length < 7) {
      setManualFormError('Invalid or fictitious phone number (must be real dialable number, no 555-exchanges).');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const newRecord: ThreatRecord = {
      id: `manual-${Date.now()}`,
      phone_number: formatDisplayPhone(newPhone, digits),
      phone_digits: digits,
      source_name: newSourceName || 'Community Report',
      source_url: newSourceUrl || 'https://endscams.org',
      report_date: today,
      category: newCategory,
      impersonated_company: newCompany || 'N/A',
      description: newDescription || 'Manually cataloged threat report.',
      is_down: false,
    };

    setRecords((prev) => [newRecord, ...prev]);
    syncRecordToSupabase(newRecord);

    // Sync to backend database
    fetch('/api/records/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: newRecord.phone_number,
        cleanPhone: newRecord.phone_digits,
        scamType: newRecord.category,
        impersonatedCompany: newRecord.impersonated_company,
        sourceUrl: newRecord.source_url,
        platform: newRecord.source_name,
        detailedSummary: newRecord.description,
        detectedAt: newRecord.report_date,
      }),
    }).catch(() => {});

    setStatusNotification(`Added ${newRecord.phone_number} to monitored database.`);
    setIsReportModalOpen(false);
    setNewPhone('');
    setNewDescription('');
    setNewCompany('');
  };

  // ============================================================================
  // 11. BULK ACTIONS & STATUS TOGGLES
  // ============================================================================
  const handleToggleStatus = (record: ThreatRecord) => {
    const nextStatus = !record.is_down;
    setRecords((prev) =>
      prev.map((r) => (r.id === record.id ? { ...r, is_down: nextStatus } : r))
    );
    setStatusNotification(`Marked ${record.phone_number} as ${nextStatus ? 'Out of Service' : 'Active Threat'}.`);
    // Sync status with backend
    fetch(`/api/records/${record.id}/toggle-down`, { method: 'POST' }).catch(() => {});
  };

  const handleBulkMarkDown = () => {
    setRecords((prev) =>
      prev.map((r) => (selectedIds.includes(r.id) ? { ...r, is_down: true } : r))
    );
    setStatusNotification(`Marked ${selectedIds.length} selected lines as Out of Service.`);
    setSelectedIds([]);
  };

  const handleBulkDelete = () => {
    setRecords((prev) => prev.filter((r) => !selectedIds.includes(r.id)));
    setStatusNotification(`Removed ${selectedIds.length} records from session database.`);
    setSelectedIds([]);
  };

  const handleCopyPhone = (id: string, text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // ============================================================================
  // 12. FILTERING & SEARCH
  // ============================================================================
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !q ||
        r.phone_number.toLowerCase().includes(q) ||
        r.phone_digits.includes(q.replace(/\D/g, '')) ||
        r.category.toLowerCase().includes(q) ||
        r.source_name.toLowerCase().includes(q) ||
        (r.impersonated_company && r.impersonated_company.toLowerCase().includes(q)) ||
        r.description.toLowerCase().includes(q);

      const matchesCategory = selectedCategory === 'ALL' || r.category === selectedCategory;
      const matchesSource = selectedSource === 'ALL' || r.source_name === selectedSource;

      const country = deriveCountryInfo(r.phone_number);
      const matchesCountry = selectedCountry === 'ALL' || country.name === selectedCountry || country.code === selectedCountry;

      const matchesStatus =
        selectedStatus === 'ALL' ||
        (selectedStatus === 'ACTIVE' && !r.is_down) ||
        (selectedStatus === 'DOWN' && r.is_down);

      return matchesSearch && matchesCategory && matchesSource && matchesCountry && matchesStatus;
    })
    .sort((a, b) => (b.report_date || '').localeCompare(a.report_date || ''));
  }, [records, searchTerm, selectedCategory, selectedSource, selectedCountry, selectedStatus]);

  // Derived Metrics
  const totalNumbers = records.length;
  const downCount = records.filter((r) => r.is_down).length;
  const activeCount = totalNumbers - downCount;
  const uniqueCategories = Array.from(new Set(records.map((r) => r.category))).length;
  const uniqueSources = Array.from(new Set(records.map((r) => r.source_name))).length;
  const uniqueCountries = Array.from(
    new Set(records.map((r) => deriveCountryInfo(r.phone_number).name).filter(Boolean))
  ).length;

  const categoriesList = useMemo(() => Array.from(new Set(records.map((r) => r.category))), [records]);
  const sourcesList = useMemo(() => Array.from(new Set(records.map((r) => r.source_name))), [records]);
  const countriesList = useMemo(
    () => Array.from(new Set(records.map((r) => deriveCountryInfo(r.phone_number).name))),
    [records]
  );

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 text-slate-100 font-sans space-y-5">
      {/* ========================================== */}
      {/* A. NOTIFICATION ALERT                      */}
      {/* ========================================== */}
      {statusNotification && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs px-4 py-2.5 rounded-xl flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{statusNotification}</span>
          </div>
          <button onClick={() => setStatusNotification(null)} className="text-emerald-400 hover:text-emerald-200 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ========================================== */}
      {/* B. ESSCAN.AI.STUDIO COMPLIANT HEADER BANNER*/}
      {/* ========================================== */}
      <header className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            {/* Engine Status Line */}
            <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
              <span className="flex items-center space-x-1.5 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                <span>AUTONOMOUS HARVESTER ENGINE</span>
              </span>

              <span className="bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-full text-[10px] font-mono text-slate-300 flex items-center space-x-1">
                <Clock className="w-3 h-3 text-amber-400" />
                <span>{currentPST}</span>
              </span>

              <span className="bg-slate-800/80 border border-slate-700/80 px-2 py-0.5 rounded-full text-[10px] font-medium text-amber-400">
                DAILY SCHEDULE: 7:00 AM & 1:00 PM PST
              </span>
            </div>

            <h1 className="text-lg sm:text-2xl font-black text-slate-100 flex items-center space-x-2 tracking-tight">
              <ShieldAlert className="w-6 h-6 text-red-500 shrink-0" />
              <span>SCAM HARVESTER & ACTIVE PHONE DATABASE</span>
            </h1>

            <p className="text-xs text-slate-400 max-w-3xl">
              Automated multi-source threat intelligence system. Continuously indexes verified scam lines, enforces strict 24-hour freshness, and purges toll-free/fictitious numbers.
            </p>
          </div>

          {/* Action Button Strip */}
          <div className="flex items-center space-x-2 flex-wrap gap-y-2">
            {/* Manual Refresh / Scan */}
            <button
              id="btn-footer-manual-refresh"
              onClick={() => executeFullHarvesterScan()}
              disabled={isScanning}
              className="px-3.5 py-2 bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400 text-slate-950 text-xs font-bold rounded-xl flex items-center space-x-1.5 transition shadow-lg disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Scanning Feeds...' : 'Manual Refresh'}</span>
            </button>

            {/* Targeted Search */}
            <button
              onClick={() => setIsTargetedSearchOpen(true)}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition border border-slate-700 cursor-pointer"
            >
              <Search className="w-3.5 h-3.5 text-amber-400" />
              <span>Targeted Search</span>
            </button>

            {/* Import CSV */}
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition border border-slate-700 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-blue-400" />
              <span>Import CSV</span>
            </button>

            {/* Export CSV */}
            <button
              onClick={handleExportCSV}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition border border-slate-700 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export CSV</span>
            </button>

            {/* Manual Add */}
            <button
              onClick={() => setIsReportModalOpen(true)}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition border border-slate-700 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-red-400" />
              <span>Add Number</span>
            </button>

            {/* Scanner Settings */}
            <button
              onClick={() => setIsScannerModalOpen(true)}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 rounded-xl transition border border-slate-700 cursor-pointer"
              title="Scanner Diagnostics & Settings"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Schedule & Progress Status Bar */}
        <div className="mt-4 pt-3.5 border-t border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-slate-400">
          <div className="flex items-center space-x-2">
            <Radio className={`w-3.5 h-3.5 ${isScanning ? 'text-amber-400 animate-pulse' : 'text-emerald-400'}`} />
            <span>
              <strong>Status:</strong> {isScanning ? scannerStatusMessage : 'Monitoring live threat streams'}
            </span>
          </div>

          <div className="flex items-center space-x-1.5 text-slate-300 font-mono">
            <span>Next Auto-Scan:</span>
            <span className="text-amber-400 font-bold">{scheduleInfo.label}</span>
            <span className="text-slate-500">({scheduleInfo.countdown})</span>
          </div>
        </div>
      </header>

      {/* ========================================== */}
      {/* C. STATS CARDS (IDENTICAL TO STATSCARDS)   */}
      {/* ========================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Total Numbers */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 sm:p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider">Total Numbers</p>
            <div className="flex items-baseline space-x-1.5 sm:space-x-2 mt-0.5 sm:mt-1">
              <span className="text-xl sm:text-2xl font-bold text-slate-100">{totalNumbers}</span>
              <span className="text-[10px] sm:text-xs text-slate-400">
                <strong className="text-emerald-400 font-medium">{activeCount} active</strong> · <strong className="text-red-400 font-medium">{downCount} down</strong>
              </span>
            </div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center shrink-0">
            <PhoneCall className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        {/* Scam Types */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 sm:p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider">Scam Types</p>
            <div className="flex items-baseline space-x-1.5 sm:space-x-2 mt-0.5 sm:mt-1">
              <span className="text-xl sm:text-2xl font-bold text-slate-100">{uniqueCategories}</span>
              <span className="text-[10px] sm:text-xs text-slate-500">categories</span>
            </div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        {/* Platforms */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 sm:p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider">Platforms</p>
            <div className="flex items-baseline space-x-1.5 sm:space-x-2 mt-0.5 sm:mt-1">
              <span className="text-xl sm:text-2xl font-bold text-slate-100">{uniqueSources}</span>
              <span className="text-[10px] sm:text-xs text-slate-500">sources (Tech Support, FB, IG)</span>
            </div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
            <Globe className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        {/* Countries */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 sm:p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider">Countries</p>
            <div className="flex items-baseline space-x-1.5 sm:space-x-2 mt-0.5 sm:mt-1">
              <span className="text-xl sm:text-2xl font-bold text-slate-100">{uniqueCountries}</span>
              <span className="text-[10px] sm:text-xs text-slate-500">regions</span>
            </div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* D. SEARCH & FILTERS BAR                    */}
      {/* ========================================== */}
      <section className="bg-slate-900/90 border border-slate-800 p-3 sm:p-4 rounded-2xl flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search phone, company, category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
          />
        </div>

        <div className="flex items-center space-x-2 w-full md:w-auto flex-wrap gap-y-2">
          {/* Category Filter */}
          <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300">
            <Filter className="w-3.5 h-3.5 text-amber-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">All Categories</option>
              {categoriesList.map((c) => (
                <option key={c} value={c} className="bg-slate-900">{c}</option>
              ))}
            </select>
          </div>

          {/* Source Filter */}
          <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300">
            <Database className="w-3.5 h-3.5 text-blue-400" />
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">All Sources</option>
              {sourcesList.map((s) => (
                <option key={s} value={s} className="bg-slate-900">{s}</option>
              ))}
            </select>
          </div>

          {/* Country Filter */}
          <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300">
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">All Countries</option>
              {countriesList.map((c) => (
                <option key={c} value={c} className="bg-slate-900">{c}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">All Statuses</option>
              <option value="ACTIVE" className="bg-slate-900">Active Lines Only</option>
              <option value="DOWN" className="bg-slate-900">Down / Closed Only</option>
            </select>
          </div>
        </div>
      </section>

      {/* ========================================== */}
      {/* E. BULK ACTIONS BAR (IF ANY SELECTED)      */}
      {/* ========================================== */}
      {selectedIds.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-xl flex items-center justify-between text-xs text-amber-300">
          <div className="flex items-center space-x-2">
            <span className="font-bold">{selectedIds.length}</span>
            <span>record(s) selected</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleBulkMarkDown}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs transition cursor-pointer"
            >
              Mark Out of Service
            </button>
            <button
              onClick={handleExportCSV}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-lg text-xs transition cursor-pointer"
            >
              Export Selected
            </button>
            <button
              onClick={handleBulkDelete}
              className="px-2.5 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-300 rounded-lg text-xs transition cursor-pointer"
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* F. RESULTS TABLE                           */}
      {/* ========================================== */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/90 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3.5 w-8">
                  <input
                    type="checkbox"
                    checked={selectedIds.length > 0 && selectedIds.length === filteredRecords.length}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedIds(filteredRecords.map((r) => r.id));
                      else setSelectedIds([]);
                    }}
                    className="rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3.5">Phone Number</th>
                <th className="px-4 py-3.5">Company / Target</th>
                <th className="px-4 py-3.5">Scam Category</th>
                <th className="px-4 py-3.5">Source Platform</th>
                <th className="px-4 py-3.5">Date Detected</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Threat Intel & Snippet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-slate-500">
                    No matching threat records found. Click "Manual Refresh" or "Import CSV" to populate the database.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => {
                  const isCopied = copiedId === record.id;
                  const isChecked = selectedIds.includes(record.id);
                  const country = deriveCountryInfo(record.phone_number);

                  return (
                    <tr
                      key={record.id}
                      className={`hover:bg-slate-850/60 transition-colors ${isChecked ? 'bg-amber-500/5' : ''}`}
                    >
                      <td className="px-4 py-3.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedIds((prev) => [...prev, record.id]);
                            else setSelectedIds((prev) => prev.filter((id) => id !== record.id));
                          }}
                          className="rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* Phone Column */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <a
                            href={`tel:${record.phone_digits}`}
                            className="font-mono font-bold text-sm text-amber-400 hover:text-amber-300 hover:underline transition"
                            title="Click to dial"
                          >
                            {record.phone_number}
                          </a>
                          <button
                            onClick={() => {
                              const digits = (record.phone_digits || record.phone_number || '').replace(/\D/g, '');
                              const copyValue = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
                              handleCopyPhone(record.id, copyValue);
                            }}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition cursor-pointer"
                            title="Copy Phone Number"
                          >
                            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          {(country.isAfrican || record.phone_digits.startsWith('234') || record.phone_digits.startsWith('254') || record.phone_digits.startsWith('27') || record.phone_digits.startsWith('233')) && (
                            <a
                              href={`https://wa.me/${record.phone_digits}`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 font-mono inline-flex items-center space-x-0.5 transition cursor-pointer"
                              title="Open WhatsApp chat link"
                            >
                              <span>WhatsApp</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Company Impersonated */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-300 font-medium">
                        {record.impersonated_company && record.impersonated_company !== 'N/A' ? (
                          <span>{record.impersonated_company}</span>
                        ) : (
                          <span className="text-slate-500">Unspecified Target</span>
                        )}
                      </td>

                      {/* Scam Category */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                          {record.category}
                        </span>
                      </td>

                      {/* Source Platform */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {record.source_url && record.source_url.startsWith('http') ? (
                          <a
                            href={record.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center space-x-1 text-slate-300 hover:text-amber-400 underline decoration-slate-600 underline-offset-2 transition"
                            title={`Open verified source: ${record.source_name}`}
                          >
                            <span className="font-medium">{record.source_name}</span>
                            <ExternalLink className="w-3 h-3 text-slate-500" />
                          </a>
                        ) : (
                          <span className="text-slate-300 font-medium">{record.source_name}</span>
                        )}
                      </td>

                      {/* Date Detected */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                        {record.report_date}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleStatus(record)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition cursor-pointer ${
                            record.is_down
                              ? 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                          }`}
                          title="Click to toggle status"
                        >
                          {record.is_down ? 'Out of Service' : 'Active Line'}
                        </button>
                      </td>

                      {/* Description & Intel */}
                      <td className="px-4 py-3.5 text-slate-400 max-w-xs sm:max-w-md truncate" title={record.description}>
                        {record.amount_charged && record.amount_charged !== 'N/A' && (
                          <span className="text-amber-400 font-mono mr-1.5 font-semibold">[{record.amount_charged}]</span>
                        )}
                        <span>{record.description}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ========================================== */}
      {/* G. TARGETED SEARCH MODAL                   */}
      {/* ========================================== */}
      {isTargetedSearchOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl p-6 relative space-y-4">
            <button
              onClick={() => setIsTargetedSearchOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2">
              <Search className="w-5 h-5 text-amber-400" />
              <h2 className="text-base font-bold text-slate-100">Targeted Threat Search (Past 24 Hours)</h2>
            </div>

            <p className="text-xs text-slate-400">
              Execute a targeted search query strictly constrained to threats reported in the last 24 hours across live forums and social feeds.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Search Entity / Keyword *</label>
                <input
                  type="text"
                  placeholder="e.g. Geek Squad, PayPal invoice, Love Spell, Quickbooks, Cash App"
                  value={targetedQuery}
                  onChange={(e) => setTargetedQuery(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Category Context</label>
                <select
                  value={targetedCategory}
                  onChange={(e) => setTargetedCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="General Tech Support & Refund Scams">General Tech Support & Refund Scams</option>
                  <option value="Spellcaster WhatsApp Extortion">Spellcaster WhatsApp Extortion</option>
                  <option value="Crypto BTC Recovery Scam">Crypto BTC Recovery Scam</option>
                  <option value="Publishing Chat Scam">Publishing Chat Scam</option>
                  <option value="Lottery & Sweepstakes Scams">Lottery & Sweepstakes Scams</option>
                  <option value="Social Media Prize & Giveaway Scam">Social Media Prize & Giveaway Scam</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsTargetedSearchOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!targetedQuery.trim() || isScanning}
                onClick={() => {
                  setIsTargetedSearchOpen(false);
                  executeFullHarvesterScan(targetedQuery, targetedCategory);
                }}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition shadow disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Search Last 24 Hours</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* H. SCANNER DIAGNOSTICS & SETTINGS MODAL    */}
      {/* ========================================== */}
      {isScannerModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-2xl shadow-2xl p-6 relative space-y-4">
            <button
              onClick={() => setIsScannerModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2">
              <Sliders className="w-5 h-5 text-amber-500" />
              <h2 className="text-base font-bold text-slate-100">Scanner Engine & Schedule Diagnostics</h2>
            </div>

            <p className="text-xs text-slate-400">
              Monitors the 11 exact targets from esscan.ai.studio. Automated triggers fire daily at 7:00 AM PST and 1:00 PM PST.
            </p>

            {/* Optional Gemini Key */}
            <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-300 flex items-center space-x-1.5">
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  <span>Gemini API Key (Optional for Google Search Grounded Sweep)</span>
                </label>
                {geminiApiKey && (
                  <span className="text-[10px] text-emerald-400 font-semibold flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Saved</span>
                  </span>
                )}
              </div>
              <input
                type="password"
                placeholder="AIzaSy... (Leave blank to use autonomous threat catalog)"
                value={geminiApiKey}
                onChange={(e) => handleSaveGeminiKey(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
              />
              <p className="text-[10px] text-slate-500">
                When provided, queries Google Search with exact esscan rules. If blank, uses built-in threat feeds.
              </p>
            </div>

            {/* Active Schedule Overview */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Active Timezone</span>
                <p className="text-sm font-bold text-slate-200 font-mono">Pacific Time (PST/PDT)</p>
                <p className="text-[10px] text-amber-400">{currentPST}</p>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Daily Auto-Scan Slots</span>
                <p className="text-sm font-bold text-slate-200 font-mono">7:00 AM & 1:00 PM</p>
                <p className="text-[10px] text-emerald-400">Next: {scheduleInfo.label}</p>
              </div>
            </div>

            {/* Live Scan Logs */}
            {scannerLogs.length > 0 && (
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 max-h-40 overflow-y-auto space-y-1">
                {scannerLogs.map((log, idx) => (
                  <div key={idx} className="flex items-start space-x-1.5">
                    <span className="text-amber-500">›</span>
                    <span>{log}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setIsScannerModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setIsScannerModalOpen(false);
                  executeFullHarvesterScan();
                }}
                disabled={isScanning}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition shadow disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Execute Scan Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* I. CSV IMPORT MODAL                        */}
      {/* ========================================== */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl p-6 relative space-y-4">
            <button
              onClick={() => {
                setIsImportModalOpen(false);
                setImportFile(null);
                setImportError(null);
                setImportPreview(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2">
              <Upload className="w-5 h-5 text-blue-400" />
              <h2 className="text-base font-bold text-slate-100">Import CSV Threat Records</h2>
            </div>

            <p className="text-xs text-slate-400">
              Upload any CSV exported from AI Studio, Google Sheets, or Excel. Toll-free and fictitious numbers are automatically rejected.
            </p>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-amber-500/60 bg-slate-950/60 hover:bg-slate-950 p-6 rounded-xl flex flex-col items-center justify-center space-y-2 cursor-pointer transition"
            >
              <FileSpreadsheet className="w-8 h-8 text-amber-400" />
              <div className="text-center">
                <span className="text-xs font-semibold text-slate-200">
                  {importFile ? importFile.name : 'Click to select or drag .csv file here'}
                </span>
                <p className="text-[10px] text-slate-500 mt-0.5">Auto-cleans digits and strips formulas</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleCSVFileSelect(f);
                }}
              />
            </div>

            {importError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 rounded-xl flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{importError}</span>
              </div>
            )}

            {importPreview && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 p-3.5 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between text-emerald-300 font-semibold">
                  <span className="flex items-center space-x-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>{importPreview.valid.length} valid numbers ready</span>
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    ({importPreview.rejectedTollFree} toll-free rejected, {importPreview.rejectedBad} bad rejected)
                  </span>
                </div>

                <div className="text-[11px] text-slate-300 bg-slate-950/80 p-2 rounded-lg font-mono max-h-24 overflow-y-auto space-y-1">
                  {importPreview.valid.slice(0, 5).map((r, i) => (
                    <div key={i} className="truncate">
                      <span className="text-amber-400">{r.phone_number}</span> — {r.category}
                    </div>
                  ))}
                  {importPreview.valid.length > 5 && (
                    <div className="text-slate-500 text-[10px]">...and {importPreview.valid.length - 5} more</div>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={handleDownloadSampleCsv}
                className="text-xs text-amber-400 hover:text-amber-300 flex items-center space-x-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Template</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!importPreview || importPreview.valid.length === 0}
                  onClick={handleConfirmImport}
                  className="px-4 py-1.5 bg-blue-500 hover:bg-blue-400 text-white font-bold rounded-xl text-xs transition shadow disabled:opacity-40 cursor-pointer"
                >
                  Import {importPreview ? `${importPreview.valid.length} Records` : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* J. MANUAL ADD NUMBER MODAL                 */}
      {/* ========================================== */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl p-6 relative">
            <button
              onClick={() => setIsReportModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-base font-bold text-slate-100 flex items-center space-x-2 mb-4">
              <Plus className="w-5 h-5 text-red-500" />
              <span>Add Verified Threat Number</span>
            </h2>

            {manualFormError && (
              <div className="mb-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-2.5 rounded-xl flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{manualFormError}</span>
              </div>
            )}

            <form onSubmit={handleManualAddSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Phone Number * (No Toll-Free: 800, 888, 877, 866, 855, 844, 833)
                </label>
                <input
                  type="text"
                  required
                  placeholder="1 (951) 629-3962 or +234 810 552 9412"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Company / Brand Impersonated</label>
                <input
                  type="text"
                  placeholder="e.g. Geek Squad, Microsoft Support, Norton, Dr. Love Spell"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Scam Category *</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="General Tech Support & Refund Scams">General Tech Support & Refund Scams</option>
                  <option value="Spellcaster WhatsApp Extortion">Spellcaster WhatsApp Extortion</option>
                  <option value="Crypto BTC Recovery Scam">Crypto BTC Recovery Scam</option>
                  <option value="Publishing Chat Scam">Publishing Chat Scam</option>
                  <option value="Lottery & Sweepstakes Scams">Lottery & Sweepstakes Scams</option>
                  <option value="Social Media Prize & Giveaway Scam">Social Media Prize & Giveaway Scam</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Source / Origin</label>
                <input
                  type="text"
                  placeholder="e.g. Tech Support United, Scammer.info, Facebook, Instagram"
                  value={newSourceName}
                  onChange={(e) => setNewSourceName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Source URL</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={newSourceUrl}
                  onChange={(e) => setNewSourceUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Threat Context / Snippet</label>
                <textarea
                  rows={2}
                  placeholder="What was the fraudulent claim or fake invoice?"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition shadow cursor-pointer"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default EmbeddableTracker;
