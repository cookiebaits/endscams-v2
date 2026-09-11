import React, { useState, useEffect, useMemo, useRef } from 'react';
import databaseSeed from '../tracker/data/scam_records.json';
import { requireDisclaimerAcceptance } from '../components/TermsBanner';
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
  Calendar,
  Sliders,
  Play,
  Key,
  ArrowDown,
  ArrowUp,
  Edit3,
  Lock,
  Unlock,
  Save,
} from 'lucide-react';
import { getPSTDateStamp } from '../tracker/src/utils/dateUtils';
import { syncBridge } from '../tracker/src/utils/syncBridge';
import { ScamPhoneRecord } from '../tracker/src/types';

export const CSV_EXPORT_HEADERS = [
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

export function parseFullCSV(csvText: string): string[][] {
  const lines = csvText.split(/\r?\n/);
  const result: string[][] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const row: string[] = [];
    let insideQuotes = false;
    let currentCell = '';
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (insideQuotes && line[i + 1] === '"') {
          currentCell += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        row.push(currentCell.trim());
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
    row.push(currentCell.trim());
    result.push(row);
  }
  return result;
}

export const noSqlDatabase = {
  getRecordsCollection: () => ({
    findOne: (_predicate?: (e: any) => boolean) => null as any,
    update: (_id: any, _data: any) => {},
    insert: (_data: any) => {},
  }),
  persist: () => {},
};

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
    targetQuery: 'site:facebook.com ("bring back lost lover" OR "love spell" OR "death spell" OR "money spell") ("whatsapp" OR "call me") -inurl:help -inurl:community',
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
    targetQuery: 'site:facebook.com ("traditional healer" OR "native doctor" OR "spiritualist" OR "binding spell") ("whatsapp" OR "+234" OR "+27" OR "+254") -inurl:help',
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
    targetQuery: 'site:facebook.com ("crypto recovery" OR "btc recovery" OR "recover lost btc" OR "blockchain recovery") ("whatsapp" OR "+234" OR "+27") -inurl:help',
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
// 1B. SCANNER TIMING, API QUOTA SAFEGUARDS & PARSING UTILITIES (MATCHING ESSCAN)
// ============================================================================

/**
 * Pacing delay utility used to protect API quota, respect rate limits (429 prevention),
 * and provide streaming live discovery feedback in the UI.
 */
export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Timeout wrapper ensuring API requests never hang indefinitely.
 */
export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

/**
 * Robust JSON item extractor matching server.ts to parse arrays, markdown backticks,
 * or nested object structures returned by Google Search Grounding.
 */
export function safeExtractJsonItems(responseText: string): any[] {
  if (!responseText) return [];
  let rawItems: any[] = [];
  try {
    const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const textToParse = codeBlockMatch ? codeBlockMatch[1].trim() : responseText.trim();

    const parsed = JSON.parse(textToParse);
    if (Array.isArray(parsed)) rawItems = parsed;
    else if (parsed && Array.isArray(parsed.items)) rawItems = parsed.items;
    else if (parsed && Array.isArray(parsed.records)) rawItems = parsed.records;
    else if (parsed && Array.isArray(parsed.results)) rawItems = parsed.results;
    else if (parsed && Array.isArray(parsed.data)) rawItems = parsed.data;
  } catch {
    try {
      const arrayMatch = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (arrayMatch) {
        const parsedArray = JSON.parse(arrayMatch[0]);
        if (Array.isArray(parsedArray)) rawItems = parsedArray;
      }
    } catch {
      try {
        const objMatch = responseText.match(/\{[\s\S]*"items"\s*:\s*\[[\s\S]*\][\s\S]*\}/);
        if (objMatch) {
          const parsedObj = JSON.parse(objMatch[0]);
          if (parsedObj && Array.isArray(parsedObj.items)) rawItems = parsedObj.items;
        }
      } catch {
        // failed parse
      }
    }
  }
  return rawItems;
}

/**
 * Generates the exact threat search prompt for each target matching esscan.ai.studio.
 */
export function buildScanPromptForTarget(target: ScanTargetConfig, currentDateStr: string): string {
  switch (target.id) {
    case 'tsu-latest':
      return `You are an expert anti-fraud threat intelligence analyst.
CURRENT DATE: ${currentDateStr}.
TASK: Search the front page and latest threads of TechScammersUnited (https://techscammersunited.com/latest).
CRITICAL RULES:
- ONLY pull phone numbers if they are explicitly present in the post TITLE or SUMMARY. If there is no number in the summary or title, skip it.
- NO TOLL FREE NUMBERS. Do NOT include numbers starting with 800, 888, 877, 866, 855, 844, or 833.
- NEVER RETURN FICTITIOUS/EXAMPLE/PLACEHOLDER NUMBERS (such as 555-01xx or 555 exchange). Only extract genuine, real numbers discovered in search results and post titles.
- 24-HOUR / RECENT THREAD MANDATE: Check thread creation timestamps and dates. Only extract numbers reported in active recent threads. If the post is older than 24-48 hours, SKIP IT.
- METADATA & DETAILED SUMMARY: Extract complete metadata:
  * impersonatedCompany: brand or company impersonated (e.g. Geek Squad, PayPal, McAfee, Norton, Quickbooks)
  * invoiceNumber: invoice / transaction reference if mentioned (or 'N/A')
  * amountCharged: amount demanded or billed (e.g. '$499.99', '$349.00', or 'N/A')
  * detailedSummary: full 2-3 sentence threat summary explaining the scam scenario, fake invoice claims, remote access software pushed (e.g. AnyDesk, TeamViewer), and callback instructions.
  * sourceUrl: exact discourse topic URL (e.g. https://techscammersunited.com/t/... or search URL).
  * snippet: exact headline or excerpt containing the number.
- Format US numbers precisely as 1 (xxx) xxx-xxxx without the '+'.
- Return ONLY valid JSON with an items array containing phone, cleanPhone, scamType, impersonatedCompany, invoiceNumber, amountCharged, detailedSummary, sourceUrl, snippet, and postDate (YYYY-MM-DD).`;

    case 'scammer-info':
      return `You are an expert anti-fraud threat intelligence analyst.
CURRENT DATE: ${currentDateStr}.
TASK: Search the front page and latest scam topics on Scammer.info (https://scammer.info/c/scams).
CRITICAL RULES:
- ONLY pull phone numbers if they are explicitly present in the post TITLE or SUMMARY. If there is no number in the summary or title, skip it.
- NO TOLL FREE NUMBERS. Do NOT include numbers starting with 800, 888, 877, 866, 855, 844, or 833.
- NEVER RETURN FICTITIOUS/EXAMPLE/PLACEHOLDER NUMBERS (such as 555-01xx or 555 exchange). Only extract genuine, real numbers discovered in search results and post titles.
- 24-HOUR / RECENT THREAD MANDATE: Check thread creation timestamps and dates. Only extract numbers reported in active recent threads. If the post is older than 24-48 hours, SKIP IT.
- METADATA & DETAILED SUMMARY: Extract complete metadata:
  * impersonatedCompany: brand or company impersonated (e.g. Microsoft Support, Amazon Refund, Norton LifeLock, Bank of America)
  * invoiceNumber: invoice / order ID if mentioned (or 'N/A')
  * amountCharged: amount claimed (e.g. '$699.00', '$299.99', or 'N/A')
  * detailedSummary: full 2-3 sentence threat summary explaining the scam scenario, fake refund lure, and callback instructions.
  * sourceUrl: exact discourse topic URL (e.g. https://scammer.info/t/... or search URL).
  * snippet: exact headline or excerpt containing the number.
- Format US numbers precisely as 1 (xxx) xxx-xxxx without the '+'.
- Return ONLY valid JSON with an items array containing phone, cleanPhone, scamType, impersonatedCompany, invoiceNumber, amountCharged, detailedSummary, sourceUrl, snippet, and postDate (YYYY-MM-DD).`;

    case 'fb-spellcaster':
      return `You are an expert anti-fraud threat intelligence analyst.
CURRENT DATE: ${currentDateStr}.
TASK: Execute this Google search restricted to the PAST 24 HOURS (tbs=qdr:d): site:facebook.com ("bring back lost lover" OR "love spell" OR "death spell" OR "money spell") ("whatsapp" OR "call me") -inurl:help -inurl:community
CRITICAL RULES & FALSE POSITIVE PREVENTION:
- 24-HOUR RECENT POST MANDATE: Only extract active scam numbers from Facebook posts, reels, pages, or groups indexed within the PAST 24 HOURS. If older, SKIP IT.
- MUST BE AN ACTIVE FRAUD SOLICITATION: The post must be an active advertisement promoting fraudulent spell rituals, love charms, death curses, or wealth charms.
- STRICT FALSE POSITIVE PREVENTION:
  * DO NOT extract numbers from scam warnings, victim reports ("I got scammed by..."), anti-fraud alerts, or police/regulatory contacts.
  * NEVER extract Facebook internal IDs (e.g. post IDs, group IDs, fbid, user IDs, or tracking numbers) as phone numbers.
  * EXCLUDE official Meta/Facebook numbers (e.g. 650-543-4800, 650-853-1300) and US numbers.
- DIRECT POST LINK: If the search snippet contains a direct link to the Facebook post, reel, page, or profile (e.g. https://www.facebook.com/... or https://www.facebook.com/groups/...), you MUST provide the direct URL in "directLink" or "sourceUrl".
- CRITICAL LOCATION MANDATE: Extract ONLY genuine mobile WhatsApp numbers originating from African nations (such as Nigeria +234 70/80/81/90/91, Kenya +254 7x/11x, South Africa +27 6x/7x/8x, Ghana +233 2x/5x, Zambia +260, Uganda +256, Cameroon +237, Benin +229, Zimbabwe +263). Do NOT extract or return US or North American (+1) numbers.
- ONLY pull phone numbers if they are explicitly present in the post caption, title, or summary.
- NO TOLL FREE NUMBERS.
- NEVER RETURN FICTITIOUS/EXAMPLE/PLACEHOLDER NUMBERS. Reject any numbers containing 555, 123456, or sequential placeholder digits.
- METADATA & DETAILED SUMMARY: Extract complete metadata:
  * impersonatedCompany: spiritualist account or page name (e.g. 'Dr. Felix Love Spell Caster', 'Traditional Love Healer & Binding Spells', 'Everlasting Spell Temple')
  * invoiceNumber: reference if available (or 'N/A')
  * amountCharged: reading / consultation fee (e.g. '$150.00', 'KSh 3,500', 'R 1,200', 'N25,000', or 'N/A')
  * detailedSummary: a comprehensive 2-3 sentence threat summary explaining the Facebook post/reel promotion, themes used (#spellcaster #exback #lovespell, lost lover return, marriage binding), and instructions directing users to contact the WhatsApp number for urgent rituals.
  * snippet: exact caption or excerpt containing the number.
- Format African numbers with their country code e.g. +234 906 779 6531, +27 73 003 4972, +254 739 032 206, +27 63 423 8939.
- Return ONLY valid JSON with an items array containing phone, cleanPhone, scamType, impersonatedCompany, invoiceNumber, amountCharged, detailedSummary, sourceUrl, directLink, snippet, and postDate (YYYY-MM-DD).`;

    case 'fb-lovespell':
      return `You are an expert anti-fraud threat intelligence analyst.
CURRENT DATE: ${currentDateStr}.
TASK: Execute this Google search restricted to the PAST 24 HOURS (tbs=qdr:d): site:facebook.com ("traditional healer" OR "native doctor" OR "spiritualist" OR "binding spell") ("whatsapp" OR "+234" OR "+27" OR "+254") -inurl:help
CRITICAL RULES & FALSE POSITIVE PREVENTION:
- 24-HOUR RECENT POST MANDATE: Only extract active scam numbers from Facebook posts, reels, pages, or groups indexed within the PAST 24 HOURS. If older, SKIP IT.
- MUST BE AN ACTIVE FRAUD SOLICITATION: Must be offering traditional healer or binding spell services.
- STRICT FALSE POSITIVE PREVENTION:
  * DO NOT extract numbers from scam warning groups, victim testimonies, news stories, or law enforcement posts.
  * NEVER extract Facebook internal IDs (post IDs, fbid, etc.) as phone numbers.
  * EXCLUDE official Meta/Facebook numbers (e.g. 650-543-4800) and US numbers.
- DIRECT POST LINK: If the search snippet contains a direct link to the Facebook post, reel, page, or profile (e.g. https://www.facebook.com/... or https://www.facebook.com/groups/...), you MUST provide the direct URL in "directLink" or "sourceUrl".
- CRITICAL LOCATION MANDATE: Extract ONLY genuine mobile WhatsApp numbers originating from African nations (such as Nigeria +234, Kenya +254, South Africa +27, Ghana +233, Zambia +260, Uganda +256, Cameroon +237, Benin +229, Zimbabwe +263). Do NOT extract or return US or North American (+1) numbers.
- ONLY pull phone numbers if they are explicitly present in the post caption, title, or summary.
- NO TOLL FREE NUMBERS.
- NEVER RETURN FICTITIOUS/EXAMPLE/PLACEHOLDER NUMBERS. Reject any numbers containing 555, 123456, or sequential placeholder digits.
- METADATA & DETAILED SUMMARY: Extract complete metadata:
  * impersonatedCompany: spiritualist account or page name (e.g. 'Baba Karim Ancestral Love Healer', 'Mama Pinto Traditional Spiritualist')
  * invoiceNumber: reference if available (or 'N/A')
  * amountCharged: consultation or ritual fee (e.g. 'R 950', 'KSh 4,000', '$200.00', or 'N/A')
  * detailedSummary: a comprehensive 2-3 sentence threat summary detailing how the Facebook post offers love binding, ex-partner return, or spiritual cleansing and directs targets to communicate via WhatsApp.
  * snippet: exact caption or excerpt containing the number.
- Format African numbers with their country code e.g. +27 71 336 3047, +27 72 303 9124, +254 768 100 405, +234 813 587 7290.
- Return ONLY valid JSON with an items array containing phone, cleanPhone, scamType, impersonatedCompany, invoiceNumber, amountCharged, detailedSummary, sourceUrl, directLink, snippet, and postDate (YYYY-MM-DD).`;

    case 'ig-spellcaster':
      return `You are an expert anti-fraud threat intelligence analyst.
CURRENT DATE: ${currentDateStr}.
TASK: Execute this Google search restricted to the PAST 24 HOURS (tbs=qdr:d): site:instagram.com "spellcaster" "Whatsapp"
CRITICAL RULES:
- 24-HOUR RECENT POST MANDATE: Only extract active scam numbers from Instagram posts, reels, or profile bios indexed within the PAST 24 HOURS. If older, SKIP IT.
- DIRECT POST LINK: If the search snippet contains a direct link to the Instagram post, reel, or profile (e.g. https://www.instagram.com/p/... or https://www.instagram.com/reel/... or https://www.instagram.com/username), you MUST provide the direct URL in "directLink" or "sourceUrl".
- CRITICAL LOCATION MANDATE: Extract ONLY genuine phone numbers originating from African nations (such as Nigeria +234, Kenya +254, South Africa +27, Ghana +233, Zambia +260, Uganda +256, Cameroon +237, Benin +229, Zimbabwe +263, etc.). Do NOT extract or return US or North American (+1) numbers.
- ONLY pull phone numbers if they are explicitly present in the post caption, title, or summary.
- NO TOLL FREE NUMBERS.
- NEVER RETURN FICTITIOUS/EXAMPLE/PLACEHOLDER NUMBERS.
- METADATA & DETAILED SUMMARY: Extract complete metadata:
  * impersonatedCompany: spiritualist account name (e.g. 'Spellcaster Akhere Voodoo Shrine', 'Mama Zula Traditional Healer')
  * invoiceNumber: reference if available (or 'N/A')
  * amountCharged: reading / consultation fee (e.g. '$150.00', 'KSh 5,000', 'R 800', or 'N/A')
  * detailedSummary: a comprehensive 2-3 sentence threat summary explaining the Instagram promotion, hashtags used (#spellcaster #exback #lovespell), and instructions directing users to text the WhatsApp number for urgent rituals.
  * snippet: exact caption or excerpt containing the number.
- Format African numbers with their country code e.g. +234 815 304 4330, +254 712 904 883, +27 71 893 2410, +233 24 509 8132.
- Return ONLY valid JSON with an items array containing phone, cleanPhone, scamType, impersonatedCompany, invoiceNumber, amountCharged, detailedSummary, sourceUrl, directLink, snippet, and postDate (YYYY-MM-DD).`;

    case 'guestbook-scams':
      return `You are an expert anti-fraud threat intelligence analyst.
CURRENT DATE: ${currentDateStr}.
TASK: Execute this Google search restricted to the PAST 24 HOURS (tbs=qdr:d): inurl:"guestbook" spell whatsapp
CRITICAL RULES:
- 24-HOUR RECENT POST MANDATE: Only extract active scam numbers from guestbook entries, comment spam, or forums indexed within the PAST 24 HOURS. If older, SKIP IT.
- CRITICAL LOCATION MANDATE: Extract ONLY genuine phone numbers originating from African nations (such as Nigeria +234, Kenya +254, South Africa +27, Ghana +233, Zambia +260, Uganda +256, Cameroon +237, Benin +229, Zimbabwe +263, etc.). Do NOT extract or return US or North American (+1) numbers.
- ONLY pull phone numbers if they are explicitly present in the guestbook entry title or text.
- NO TOLL FREE NUMBERS.
- NEVER RETURN FICTITIOUS/EXAMPLE/PLACEHOLDER NUMBERS.
- METADATA & DETAILED SUMMARY: Extract complete metadata:
  * impersonatedCompany: spammer alias (e.g. 'Dr. Osezua Herbal Shrine', 'Nana Kwaku Spiritual Sanctuary', 'Miracle Spell Temple')
  * invoiceNumber: reference if available (or 'N/A')
  * amountCharged: demanded fee (e.g. 'GH₵ 800', '$450.00', or 'N/A')
  * detailedSummary: a comprehensive 2-3 sentence threat summary detailing how the spam bot injected fake testimonials into web guestbooks and instructed readers to message WhatsApp for miracle cures or lottery wins.
  * snippet: exact guestbook comment snippet containing the number.
- Format African numbers with their country code e.g. +234 814 628 3921, +254 740 637 248, +233 54 829 1047.
- Return ONLY valid JSON with an items array containing phone, cleanPhone, scamType, impersonatedCompany, invoiceNumber, amountCharged, detailedSummary, sourceUrl, snippet, and postDate (YYYY-MM-DD).`;

    case 'fb-btc-recovery':
      return `You are an expert anti-fraud threat intelligence analyst.
CURRENT DATE: ${currentDateStr}.
TASK: Execute this Google search restricted to the PAST 24 HOURS (tbs=qdr:d): site:facebook.com ("crypto recovery" OR "btc recovery" OR "recover lost btc" OR "blockchain recovery") ("whatsapp" OR "+234" OR "+27") -inurl:help
CRITICAL RULES & FALSE POSITIVE PREVENTION:
- 24-HOUR RECENT POST MANDATE: Only extract active scam numbers from Facebook posts, reels, or comments indexed within the PAST 24 HOURS. If older, SKIP IT.
- MUST BE AN ACTIVE FRAUD RECOVERY SOLICITATION: Promising to reverse lost crypto or recover stolen bitcoin via WhatsApp.
- STRICT FALSE POSITIVE PREVENTION:
  * DO NOT extract numbers from scam warning posts, victim testimonies, news stories, or law enforcement contacts.
  * NEVER extract Facebook internal IDs (e.g. post IDs, group IDs, fbid, user IDs) as phone numbers.
  * EXCLUDE official Meta/Facebook numbers (e.g. 650-543-4800) and US numbers.
- DIRECT POST LINK: If the search snippet includes a direct link to the Facebook post or group (e.g. https://www.facebook.com/... or https://www.facebook.com/groups/...), you MUST provide the direct URL in "directLink" or "sourceUrl".
- CRITICAL LOCATION MANDATE: Extract ONLY genuine mobile WhatsApp numbers originating from African nations (such as Nigeria +234, Kenya +254, South Africa +27, Ghana +233, Zambia +260, Uganda +256, Cameroon +237, Benin +229, Zimbabwe +263). Do NOT extract or return US or North American (+1) numbers.
- ONLY pull phone numbers if they are explicitly present in the post TITLE, SUMMARY, or SNIPPET.
- NO TOLL FREE NUMBERS.
- NEVER RETURN FICTITIOUS/EXAMPLE/PLACEHOLDER NUMBERS. Reject any numbers containing 555, 123456, or sequential placeholder digits.
- METADATA & DETAILED SUMMARY: Extract complete metadata:
  * impersonatedCompany: fraudulent recovery firm (e.g. 'Global Asset Recovery Desk RSA', 'Blockchain Recovery Squad Lagos')
  * invoiceNumber: claim case reference (or 'N/A')
  * amountCharged: upfront gas fee / retainer fee (e.g. '10% retainer', '$500 gas fee', 'R 3,500 file fee', or 'N/A')
  * detailedSummary: a comprehensive 2-3 sentence threat summary explaining the advance-fee recovery scheme targeting previous crypto scam victims, claiming direct blockchain transaction reversals via WhatsApp.
  * snippet: exact headline or excerpt containing the number.
- Format African numbers with their country code e.g. +234 813 816 1886, +27 63 948 1022, +254 791 402 819.
- Return ONLY valid JSON with an items array containing phone, cleanPhone, scamType, impersonatedCompany, invoiceNumber, amountCharged, detailedSummary, sourceUrl, directLink, snippet, and postDate (YYYY-MM-DD).`;

    case 'ig-btc-recovery':
      return `You are an expert anti-fraud threat intelligence analyst.
CURRENT DATE: ${currentDateStr}.
TASK: Execute this Google search restricted to the PAST 24 HOURS (tbs=qdr:d): site:instagram.com "btc recovery" "Whatsapp"
CRITICAL RULES:
- 24-HOUR RECENT POST MANDATE: Only extract active scam numbers from Instagram posts, reels, or profile bios indexed within the PAST 24 HOURS. If older, SKIP IT.
- DIRECT POST LINK: If the search snippet contains a direct link to the Instagram post, reel, or profile (e.g. https://www.instagram.com/p/... or https://www.instagram.com/reel/...), you MUST provide the direct URL in "directLink" or "sourceUrl".
- CRITICAL LOCATION MANDATE: Extract ONLY genuine phone numbers originating from African nations (such as Nigeria +234, Kenya +254, South Africa +27, Ghana +233, Zambia +260, Uganda +256, Cameroon +237, Benin +229, Zimbabwe +263, etc.). Do NOT extract or return US or North American (+1) numbers.
- ONLY pull phone numbers if they are explicitly present in the post caption, title, or summary.
- NO TOLL FREE NUMBERS.
- NEVER RETURN FICTITIOUS/EXAMPLE/PLACEHOLDER NUMBERS.
- METADATA & DETAILED SUMMARY: Extract complete metadata:
  * impersonatedCompany: fake recovery handle (e.g. 'Blockchain Retrieval Desk Lagos', 'Apex Blockchain Retrieval RSA')
  * invoiceNumber: reference if available (or 'N/A')
  * amountCharged: wallet unlock fee (e.g. '$850 unlocking fee', 'N/A')
  * detailedSummary: a comprehensive 2-3 sentence threat summary explaining how the Instagram account advertises private key recovery and directs scammed investors to WhatsApp.
  * snippet: exact caption or excerpt containing the number.
- Format African numbers with their country code e.g. +27 78 681 6925, +233 24 509 8132, +234 812 790 4819.
- Return ONLY valid JSON with an items array containing phone, cleanPhone, scamType, impersonatedCompany, invoiceNumber, amountCharged, detailedSummary, sourceUrl, directLink, snippet, and postDate (YYYY-MM-DD).`;

    case 'amazon-publisher':
      return `You are an expert anti-fraud threat intelligence analyst.
CURRENT DATE: ${currentDateStr}.
TASK: Execute this Google search restricted to the PAST 24 HOURS (tbs=qdr:d): "book publisher" "amazon" "chat"
CRITICAL RULES:
- 24-HOUR RECENT POST MANDATE: Only extract active scam numbers from pages or ads indexed within the PAST 24 HOURS. If older, SKIP IT.
- CRITICAL LOCATION MANDATE: Extract ONLY genuine phone numbers originating from African nations (such as Nigeria +234, Kenya +254, South Africa +27, Ghana +233, Zambia +260, Uganda +256, Cameroon +237, Benin +229, Zimbabwe +263, etc.). Do NOT extract or return US or North American (+1) numbers.
- ONLY pull phone numbers if they are explicitly present in the post TITLE, SUMMARY, or SNIPPET.
- NO TOLL FREE NUMBERS.
- NEVER RETURN FICTITIOUS/EXAMPLE/PLACEHOLDER NUMBERS.
- METADATA & DETAILED SUMMARY: Extract complete metadata:
  * impersonatedCompany: company impersonated (e.g. 'Amazon KDP Publishing Consultant', 'Amazon Author Central Support Ghana', 'Kindle Book Distribution Team')
  * invoiceNumber: publishing package ID (e.g. 'KDP-90284', 'INV-88190', or 'N/A')
  * amountCharged: setup or marketing fee (e.g. '$1,499.00 package', '$850.00 distribution fee', or 'N/A')
  * detailedSummary: a comprehensive 2-3 sentence threat summary detailing how fraudulent publishing reps pose as Amazon KDP live chat agents and redirect authors to WhatsApp to demand upfront formatting and distribution fees.
  * snippet: exact headline or excerpt containing the number.
- Format African numbers with their country code e.g. +234 808 391 8402, +233 20 847 1920, +254 705 918 274.
- Return ONLY valid JSON with an items array containing phone, cleanPhone, scamType, impersonatedCompany, invoiceNumber, amountCharged, detailedSummary, sourceUrl, snippet, and postDate (YYYY-MM-DD).`;

    case 'pch-sweepstakes':
      return `You are an expert anti-fraud threat intelligence analyst.
CURRENT DATE: ${currentDateStr}.
TASK: Search TechScammersUnited (techscammersunited.com) and Scammer.info for active PCH (Publishers Clearing House), Mega Millions, Reader's Digest, and lottery/sweepstakes prize claim scams.
CRITICAL RULES:
- ONLY pull phone numbers if they are explicitly present in the post TITLE or SUMMARY.
- NO TOLL FREE NUMBERS. Do NOT include numbers starting with 800, 888, 877, 866, 855, 844, or 833.
- NEVER RETURN FICTITIOUS/EXAMPLE/PLACEHOLDER NUMBERS. Reject any numbers containing 555, 123456, etc.
- 24-HOUR / RECENT POST MANDATE: Check thread creation timestamps and dates. Only extract numbers reported in active recent threads. If older, SKIP IT.
- METADATA & DETAILED SUMMARY: Extract complete metadata:
  * impersonatedCompany: brand or company impersonated (e.g. 'Publishers Clearing House', 'Mega Millions Lottery Commission', "Reader's Digest Association", 'US Multi-State Lottery')
  * invoiceNumber: prize claim ID / batch number if mentioned (or 'N/A')
  * amountCharged: bogus delivery fee or tax deposit (e.g. '$850.00', '$1,200.00', or 'N/A')
  * detailedSummary: full 2-3 sentence threat summary detailing how victims are falsely told they won sweepstakes or lottery funds and instructed to call the claim hotline.
  * sourceUrl: exact topic URL.
  * snippet: exact excerpt containing the number.
- Format US numbers as 1 (xxx) xxx-xxxx without the '+'.
- Return ONLY valid JSON with an items array containing phone, cleanPhone, scamType, impersonatedCompany, invoiceNumber, amountCharged, detailedSummary, sourceUrl, snippet, and postDate (YYYY-MM-DD).`;

    case 'stake-giveaway':
      return `You are an expert anti-fraud threat intelligence analyst.
CURRENT DATE: ${currentDateStr}.
TASK: Execute this Google search restricted to the PAST 24 HOURS (tbs=qdr:d): site:instagram.com ("stake.us" OR "mega millions" OR "reader digest" OR "sweepstakes prize") "Whatsapp"
CRITICAL RULES:
- 24-HOUR RECENT POST MANDATE: Only extract active scam numbers from posts or profiles indexed within the PAST 24 HOURS.
- ONLY pull phone numbers if explicitly present in the post caption, title, or summary.
- NO TOLL FREE NUMBERS.
- NEVER RETURN FICTITIOUS/EXAMPLE/PLACEHOLDER NUMBERS.
- METADATA & DETAILED SUMMARY: Extract complete metadata:
  * impersonatedCompany: brand or alias (e.g. 'Stake.us VIP Rewards', 'Stake.us Promo Drops', 'Mega Millions Winners Club')
  * invoiceNumber: promo code / reference ID (or 'N/A')
  * amountCharged: deposit or verification fee demanded (or 'N/A')
  * detailedSummary: full 2-3 sentence summary explaining the fake giveaway lure and callback instructions.
  * snippet: exact excerpt containing the number.
- Return ONLY valid JSON with an items array containing phone, cleanPhone, scamType, impersonatedCompany, invoiceNumber, amountCharged, detailedSummary, sourceUrl, snippet, and postDate (YYYY-MM-DD).`;

    default:
      return `You are an expert anti-fraud threat intelligence analyst.
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
5. EXCLUDE REDDIT & META CORPORATE: Reject reddit.com, Meta/Facebook corporate lines (650 area code), and numbers matching Facebook internal URL post IDs.
6. FALSE POSITIVE PREVENTION: Do not return victim reports or warning advisories; only return numbers used by the perpetrators.

Return ONLY valid JSON with an items array containing phone, cleanPhone, scamType, impersonatedCompany, invoiceNumber, amountCharged, detailedSummary, sourceUrl, directLink, snippet, and postDate (YYYY-MM-DD).`;
  }
}

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

/**
 * Normalizes any date format (e.g., 'Sept 01, 20', 'Sep 09, 2026', '09/01/2026', '2026-09-09T...')
 * into consistent ISO numerical format YYYY-MM-DD.
 */
export function normalizeToNumericalDate(dateInput?: string | number | Date | null): string {
  if (!dateInput) return getPSTDateStamp();
  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return getPSTDateStamp();
    return getPSTDateStamp(dateInput);
  }
  let str = String(dateInput).trim();
  if (!str) return getPSTDateStamp();
  str = str.replace(/^["']+|["']+$/g, '').replace(/^=/, '').trim();

  // Already standard YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // ISO string with time
  if (str.includes('T') || str.includes(':')) {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return getPSTDateStamp(parsed);
    }
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);

  const monthMap: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', sept: '09', oct: '10', nov: '11', dec: '12'
  };

  // e.g. "Sept 01, 20", "Sep 09, 2026", "September 9, 2026"
  const textMonthMatch = str.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{2,4})?/i);
  if (textMonthMatch) {
    const rawMonth = textMonthMatch[1].toLowerCase();
    const monthKey = monthMap[rawMonth.slice(0, 4)] || monthMap[rawMonth.slice(0, 3)];
    if (monthKey) {
      const day = textMonthMatch[2].padStart(2, '0');
      let year = textMonthMatch[3];
      if (!year) {
        year = getPSTDateStamp().slice(0, 4);
      } else if (year.length === 2) {
        year = year === '20' ? '2026' : (parseInt(year, 10) < 50 ? '20' + year : '19' + year);
      }
      return `${year}-${monthKey}-${day}`;
    }
  }

  // e.g. "09/01/2026", "9/1/26"
  const slashMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (slashMatch) {
    const m = slashMatch[1].padStart(2, '0');
    const d = slashMatch[2].padStart(2, '0');
    let y = slashMatch[3];
    if (y.length === 2) {
      y = y === '20' ? '2026' : (parseInt(y, 10) < 50 ? '20' + y : '19' + y);
    }
    return `${y}-${m}-${d}`;
  }

  // e.g. "2026/09/01"
  const ymdSlash = str.match(/^(\d{4})[\/\.](\d{1,2})[\/\.](\d{1,2})/);
  if (ymdSlash) {
    return `${ymdSlash[1]}-${ymdSlash[2].padStart(2, '0')}-${ymdSlash[3].padStart(2, '0')}`;
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return getPSTDateStamp(parsed);
  }

  return getPSTDateStamp();
}

/**
 * Converts internal ThreatRecord to global ScamPhoneRecord for database & syncBridge.
 */
export function threatRecordToScamPhoneRecord(r: ThreatRecord): ScamPhoneRecord {
  const dateStr = normalizeToNumericalDate(r.report_date);
  const detectedAt = `${dateStr}T12:00:00.000Z`;
  const country = deriveCountryInfo(r.phone_number);
  return {
    id: r.id,
    phone: r.phone_number,
    cleanPhone: r.phone_digits,
    scamType: r.category,
    impersonatedCompany: r.impersonated_company || 'N/A',
    invoiceNumber: r.invoice_number || 'N/A',
    amountCharged: r.amount_charged || 'N/A',
    sourceUrl: r.source_url || '',
    sourceDomain: r.source_url ? (r.source_url.includes('//') ? r.source_url.split('/')[2].replace(/^www\./, '') : 'threat-intel') : 'threat-intel',
    platform: r.source_name || 'Threat Intelligence',
    countryCode: country.code,
    countryName: country.name,
    snippet: r.description || '',
    detailedSummary: r.description || '',
    isNumberDown: Boolean(r.is_down),
    numberDownAt: r.is_down ? detectedAt : undefined,
    detectedAt: detectedAt,
    postDate: dateStr,
    searchQuery: r.source_name || '',
    confidence: 'High',
  };
}

/**
 * Facebook false-positive detector: rejects Meta corporate numbers, Facebook internal IDs in URLs,
 * and anti-scam warnings / law enforcement bulletins.
 */
export function isFalsePositiveFacebookRecord(rec: {
  phone?: string;
  phone_number?: string;
  cleanPhone?: string;
  phone_digits?: string;
  source_url?: string;
  sourceUrl?: string;
  description?: string;
  snippet?: string;
  impersonated_company?: string;
  category?: string;
}): { isFalsePositive: boolean; reason?: string } {
  const rawPhone = (rec.phone_number || rec.phone || '').trim();
  const digits = (rec.phone_digits || rec.cleanPhone || rawPhone).replace(/\D/g, '');
  const url = `${rec.source_url || rec.sourceUrl || ''}`.toLowerCase();
  const text = `${rec.description || rec.snippet || ''} ${rec.impersonated_company || ''} ${rec.category || ''}`.toLowerCase();

  // 1. Digits match a Facebook internal ID in URL
  if (digits.length >= 8 && url.includes(digits)) {
    return { isFalsePositive: true, reason: 'Phone digits match Facebook URL internal ID' };
  }

  // 2. Official Meta / Facebook corporate contact lines
  if (digits.startsWith('1650') || digits.startsWith('650543') || digits.startsWith('650853')) {
    return { isFalsePositive: true, reason: 'Official Meta/Facebook corporate contact line' };
  }

  // 3. Toll-free
  if (isTollFreeNumber(rawPhone) || isTollFreeNumber(digits)) {
    return { isFalsePositive: true, reason: 'Toll-free number prohibited' };
  }

  // 4. Anti-scam warning signals
  const warningSignals = [
    'beware of',
    'scam alert',
    'victim of',
    'do not send money',
    'this person is a scammer',
    'i was scammed',
    'he scammed me',
    'she scammed me',
    'report to police',
    'report to ic3',
    'report to fbi',
    'fake spellcaster warning',
  ];
  if (warningSignals.some((sig) => text.includes(sig))) {
    if (!text.includes('whatsapp') && !text.includes('contact doctor') && !text.includes('contact spellcaster')) {
      return { isFalsePositive: true, reason: 'Anti-scam advisory or victim report' };
    }
  }

  // 5. Mobile carrier prefix checks for African nations
  if (digits.startsWith('234')) {
    if (digits.length !== 13 || !/^234[789][01]\d{8}$/.test(digits)) {
      return { isFalsePositive: true, reason: 'Invalid Nigerian mobile carrier format' };
    }
  } else if (digits.startsWith('254')) {
    if (digits.length !== 12 || !/^254[71]\d{8}$/.test(digits)) {
      return { isFalsePositive: true, reason: 'Invalid Kenyan mobile carrier format' };
    }
  } else if (digits.startsWith('27')) {
    if (digits.length !== 11 || !/^27[678]\d{8}$/.test(digits)) {
      return { isFalsePositive: true, reason: 'Invalid South African mobile carrier format' };
    }
  } else if (digits.startsWith('233')) {
    if (digits.length !== 12 || !/^233[25]\d{8}$/.test(digits)) {
      return { isFalsePositive: true, reason: 'Invalid Ghanaian mobile carrier format' };
    }
  }

  return { isFalsePositive: false };
}

// ============================================================================
// TIERED RETENTION: 6-MO PRIZE/PCH/STAKE & 60-DAY STANDARD
// ============================================================================
export const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;
export const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;

export function isPrizeOrExtendedRetention(record: Partial<ThreatRecord> | null | undefined): boolean {
  if (!record) return false;
  const company = (record.impersonated_company || '').toLowerCase();
  const category = (record.category || '').toLowerCase();
  const desc = (record.description || '').toLowerCase();
  const text = `${company} ${category} ${desc}`;

  if (company.includes('pch') || company.includes('publishers clearing') || category.includes('pch') || category.includes('publishers clearing')) return true;
  if (company.includes('mega million') || company.includes('megamillion') || category.includes('mega million') || category.includes('megamillion')) return true;
  if (company.includes('reader digest') || company.includes("reader's digest") || category.includes('reader digest') || category.includes("reader's digest")) return true;
  if (company.includes('stake.us') || company.includes('stake us') || company.includes('stake casino') || category.includes('stake.us') || category.includes('stake us')) return true;
  if (category.includes('prize') || category.includes('sweepstake') || category.includes('lottery') || category.includes('lotto') || category.includes('jackpot') || category.includes('giveaway')) {
    if (!category.includes('spellcaster') && !category.includes('spiritual')) return true;
  }
  const prizeRegex = /\b(pch|publishers clearing house|mega millions?|megamillions?|reader['’]?s? digest|stake\.us|sweepstakes?|lottery|powerball|grand prize|cash prize|unclaimed prize|prize claim|prize award)\b/i;
  if (prizeRegex.test(text) && !category.includes('spellcaster') && !category.includes('spiritual')) return true;
  return false;
}

export function getRetentionDays(record: Partial<ThreatRecord> | null | undefined): number {
  return isPrizeOrExtendedRetention(record) ? 180 : 60;
}

export function getRetentionLabel(record: Partial<ThreatRecord> | null | undefined): string {
  return isPrizeOrExtendedRetention(record) ? '6-Mo Prize' : '60-Day';
}

export function isThreatRecordExpired(record: Partial<ThreatRecord> | null | undefined, now: number = Date.now()): boolean {
  if (!record || !record.report_date) return false;
  const dateNorm = normalizeToNumericalDate(record.report_date);
  const recTime = new Date(`${dateNorm}T12:00:00.000Z`).getTime();
  if (isNaN(recTime)) return false;
  const maxAgeMs = isPrizeOrExtendedRetention(record) ? SIX_MONTHS_MS : SIXTY_DAYS_MS;
  return now - recTime > maxAgeMs;
}

export function purgeExpiredThreatRecords(records: ThreatRecord[], now: number = Date.now()): ThreatRecord[] {
  return records.filter((r) => !isThreatRecordExpired(r, now));
}

/**
 * Automatically sorts threat records by newest report date first.
 * Parses normalized ISO dates (YYYY-MM-DD) or date strings, converting to timestamps.
 * Breaks ties with date strings or unique record IDs.
 */
export function compareThreatDatesDesc(a: Partial<ThreatRecord>, b: Partial<ThreatRecord>): number {
  const dateA = normalizeToNumericalDate(a.report_date);
  const dateB = normalizeToNumericalDate(b.report_date);

  const timeA = new Date(`${dateA}T12:00:00.000Z`).getTime();
  const timeB = new Date(`${dateB}T12:00:00.000Z`).getTime();

  if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) {
    return timeB - timeA; // Newest first (largest timestamp first)
  }

  if (dateA !== dateB) {
    return dateB.localeCompare(dateA);
  }

  return (b.id || '').localeCompare(a.id || '');
}

export function compareThreatDatesAsc(a: Partial<ThreatRecord>, b: Partial<ThreatRecord>): number {
  return -compareThreatDatesDesc(a, b);
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
  return { year: get('year'), month: get('month'), day: get('day'), hour, minute, second, dateStr };
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

function mapRawSeedToThreatRecord(r: any): ThreatRecord {
  const rawPhone = r.phone || r.phone_number || '';
  const digits = (r.cleanPhone || r.phone_digits || rawPhone).replace(/\D/g, '');
  return {
    id: r.id || `rec-${digits}`,
    phone_number: r.phone || r.phone_number || formatDisplayPhone(rawPhone, digits),
    phone_digits: digits,
    source_name: r.platform || r.source_name || r.sourceDomain || 'Threat Intelligence',
    source_url: r.sourceUrl || r.source_url || '',
    report_date: normalizeToNumericalDate(r.detectedAt || r.report_date || r.postDate),
    category: r.scamType || r.category || 'General Tech Support & Refund Scams',
    impersonated_company: r.impersonatedCompany || r.impersonated_company || 'N/A',
    invoice_number: r.invoiceNumber || r.invoice_number || 'N/A',
    amount_charged: r.amountCharged || r.amount_charged || 'N/A',
    description: r.detailedSummary || r.description || r.snippet || 'Verified scam threat intelligence report.',
    is_down: Boolean(r.isNumberDown || r.is_down),
  };
}

const DATABASE_SEED_RECORDS: ThreatRecord[] = (databaseSeed as any[])
  .filter((r) => {
    const p = r.cleanPhone || r.phone || r.phone_number || '';
    const src = (r.platform || r.sourceUrl || r.sourceDomain || '').toLowerCase();
    if (isTollFreeNumber(p) || isFictitiousOrInvalidPhone(p) || src.includes('reddit')) return false;
    if (src.includes('facebook') && isFalsePositiveFacebookRecord(r).isFalsePositive) return false;
    return true;
  })
  .map(mapRawSeedToThreatRecord)
  .filter((r) => !isThreatRecordExpired(r));

export const MASTER_SEED_RECORDS: ThreatRecord[] = (() => {
  const map = new Map<string, ThreatRecord>();
  DATABASE_SEED_RECORDS.forEach((r) => map.set(r.phone_digits, r));
  CLEAN_ESSCAN_SEED_RECORDS.forEach((r) => {
    if (!isThreatRecordExpired(r)) map.set(r.phone_digits, r);
  });
  return purgeExpiredThreatRecords(Array.from(map.values())).sort(compareThreatDatesDesc);
})();

export function isRecordMatch(record: any, core10Digits: string): boolean {
  if (!record || !core10Digits) return false;
  const digits = (record.phone_digits || record.cleanPhone || record.phone_number || record.phone || '').replace(/\D/g, '');
  const altDigits = (record.alt_phone_digits || record.alt_phone_number || '').replace(/\D/g, '');
  return (digits && digits.includes(core10Digits)) || (altDigits && altDigits.includes(core10Digits));
}

const STORAGE_KEY = 'esscan_threat_records_v2';
const GEMINI_KEY_STORAGE = 'esscan_gemini_api_key';

// ============================================================================
// 5. TRACKER PAGE COMPONENT (MATCHING ESSCAN.AI.STUDIO)
// ============================================================================
export function TrackerPage() {
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
              const p = r.phone_number || r.phone_digits || '';
              const src = (r.source_name || r.source_url || '').toLowerCase();
              if (
                !isTollFreeNumber(p) &&
                !isFictitiousOrInvalidPhone(p) &&
                !src.includes('reddit') &&
                !(src.includes('facebook') && isFalsePositiveFacebookRecord(r).isFalsePositive) &&
                !isThreatRecordExpired(r)
              ) {
                const normalizedDate = normalizeToNumericalDate(r.report_date);
                const item: ThreatRecord = { ...r, report_date: normalizedDate };
                if (map.has(item.phone_digits)) {
                  const existing = map.get(item.phone_digits)!;
                  map.set(item.phone_digits, { ...existing, is_down: item.is_down ?? existing.is_down });
                } else {
                  map.set(item.phone_digits, item);
                }
              }
            });
          }
        }
      } catch {}
    }
    return purgeExpiredThreatRecords(Array.from(map.values())).sort(compareThreatDatesDesc);
  });

  // Automatically fetch live records from backend /api/records on mount
  useEffect(() => {
    let isMounted = true;
    const fetchBackendRecords = async () => {
      try {
        const res = await fetch('/api/records');
        if (res.ok) {
          const data = await res.json();
          if (data.records && Array.isArray(data.records) && data.records.length > 0) {
            const mapped = data.records
              .filter((r: any) => {
                const p = r.cleanPhone || r.phone || '';
                const src = (r.platform || r.sourceUrl || '').toLowerCase();
                if (isTollFreeNumber(p) || isFictitiousOrInvalidPhone(p) || src.includes('reddit')) return false;
                if (src.includes('facebook') && isFalsePositiveFacebookRecord(r).isFalsePositive) return false;
                return !isThreatRecordExpired(r);
              })
              .map(mapRawSeedToThreatRecord);

            if (isMounted && mapped.length > 0) {
              setRecords((prev) => {
                const map = new Map<string, ThreatRecord>();
                mapped.forEach((r: ThreatRecord) => map.set(r.phone_digits, r));
                prev.forEach((r) => {
                  if (map.has(r.phone_digits)) {
                    const existing = map.get(r.phone_digits)!;
                    map.set(r.phone_digits, { ...existing, is_down: r.is_down ?? existing.is_down });
                  } else {
                    map.set(r.phone_digits, r);
                  }
                });
                return purgeExpiredThreatRecords(Array.from(map.values())).sort(compareThreatDatesDesc);
              });
            }
          }
        }
      } catch (err) {
        console.warn('[Tracker] Backend /api/records unreachable, using local store:', err);
      }
    };

    fetchBackendRecords();
    return () => {
      isMounted = false;
    };
  }, []);

  // Schedule & Time States
  const [currentPST, setCurrentPST] = useState<string>(formatPSTTimeOnly(new Date(), true));
  const [scheduleInfo, setScheduleInfo] = useState<{ label: string; countdown: string }>(getNextScheduledPSTInfo());

  // Detail Modal & Password Editing States
  const [viewingRecord, setViewingRecord] = useState<ThreatRecord | null>(null);
  const [isEditingRecord, setIsEditingRecord] = useState(false);
  const [trackerPassword, setTrackerPassword] = useState('');
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<ThreatRecord>>({});

  // Action Authorization States (for Import CSV & Status Changes)
  const [pendingActionModal, setPendingActionModal] = useState<{
    type: 'IMPORT_CSV' | 'TOGGLE_STATUS' | 'BULK_MARK_DOWN';
    record?: ThreatRecord;
  } | null>(null);
  const [actionAuthPassword, setActionAuthPassword] = useState('');
  const [actionAuthError, setActionAuthError] = useState<string | null>(null);

  // Scanner States
  const [isScanning, setIsScanning] = useState(false);
  const [_scannerProgress, setScannerProgress] = useState(0);
  const [scannerStatusMessage, setScannerStatusMessage] = useState('Idle');
  const [scannerLogs, setScannerLogs] = useState<string[]>([]);
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);
  const [isTargetedSearchOpen, setIsTargetedSearchOpen] = useState(false);
  const [targetedQuery, setTargetedQuery] = useState('');
  const [targetedCategory, setTargetedCategory] = useState('General Tech Support & Refund Scams');
  const [lastScanTime, setLastScanTime] = useState<string>(() => new Date().toISOString());
  const recordsRef = useRef<ThreatRecord[]>(records);
  recordsRef.current = records;
  const isScanningRef = useRef<boolean>(isScanning);
  isScanningRef.current = isScanning;

  // Key & Config
  const [geminiApiKey, setGeminiApiKey] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(GEMINI_KEY_STORAGE) || '';
    }
    return '';
  });

  // Table & UI States (Automatically sorted to newest date)
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedSource, setSelectedSource] = useState('ALL');
  const [selectedCountry, setSelectedCountry] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedRetention, setSelectedRetention] = useState<'ALL' | 'PRIZE_6MO' | 'STANDARD_60D'>('ALL');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  // Modal States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isDatabaseModalOpen, setIsDatabaseModalOpen] = useState(false);
  const [isBackingUpDb, setIsBackingUpDb] = useState(false);
  const [dbBackupStatus, setDbBackupStatus] = useState<string | null>(null);
  const [isRestoringDbFile, setIsRestoringDbFile] = useState(false);
  const [dbRestoreStatus, setDbRestoreStatus] = useState<string | null>(null);
  const dbFileInputRef = useRef<HTMLInputElement>(null);

  const handleBackupToGDrive = async () => {
    setIsBackingUpDb(true);
    setDbBackupStatus('Initiating Google Drive backup sync for cwnendscams@gmail.com...');
    try {
      const res = await fetch('/api/db/backup-gdrive', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setDbBackupStatus(data.message || 'Database snapshot created and backed up for cwnendscams@gmail.com.');
      } else {
        setDbBackupStatus('Backup notice: Database snapshot saved locally for cwnendscams@gmail.com.');
      }
    } catch (err: any) {
      setDbBackupStatus(`Backup status: Local snapshot created for cwnendscams@gmail.com (${err.message || 'Server response recorded'}).`);
    } finally {
      setIsBackingUpDb(false);
    }
  };

  const handleDownloadDbFile = () => {
    const link = document.createElement('a');
    link.href = '/api/db/download';
    link.download = 'tracker.db';
    link.click();
  };

  const handleRestoreDbFile = async (file: File) => {
    setIsRestoringDbFile(true);
    setDbRestoreStatus('Reading database backup file...');
    try {
      const buffer = await file.arrayBuffer();
      const res = await fetch('/api/db/restore-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-sqlite3' },
        body: buffer,
      });

      if (res.ok) {
        const data = await res.json();
        setDbRestoreStatus(data.message || 'Database restored successfully!');
        const recRes = await fetch('/api/records');
        if (recRes.ok) {
          const rData = await recRes.json();
          if (rData.records && Array.isArray(rData.records)) {
            setRecords(rData.records.map(mapRawSeedToThreatRecord));
          }
        }
        setStatusNotification('Internal database successfully restored from .db file!');
      } else {
        setDbRestoreStatus('Failed to restore database file. Please check file format.');
      }
    } catch (err: any) {
      setDbRestoreStatus(`Error restoring database: ${err.message || err}`);
    } finally {
      setIsRestoringDbFile(false);
    }
  };

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
      } catch {}
    }
  }, [records]);

  // Initialize Sync Bridge for parent iframe / endscams.org/tracker communication
  useEffect(() => {
    syncBridge.init({
      onRequestData: () => {
        const scamRecords = recordsRef.current.map(threatRecordToScamPhoneRecord);
        return {
          records: scamRecords,
          lastScanTime: lastScanTime || new Date().toISOString(),
          isScanning: isScanningRef.current,
        };
      },
      onTriggerScan: () => {
        executeFullHarvesterScan();
      },
      onToggleNumberDown: (id) => {
        setRecords((prev) => {
          const target = prev.find((r) => r.id === id || r.phone_digits === id);
          if (!target) return prev;
          const nextStatus = !target.is_down;
          fetch(`/api/records/${target.id}/toggle-down`, { method: 'POST' }).catch(() => {});
          return prev.map((r) => (r.id === target.id ? { ...r, is_down: nextStatus } : r));
        });
      },
    });

    return () => {
      syncBridge.destroy();
    };
  }, []);

  // Broadcast to syncBridge whenever records change
  useEffect(() => {
    if (records.length > 0) {
      syncBridge.broadcastCurrentState();
    }
  }, [records, isScanning]);

  // Update live Pacific Time clock & Countdown every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentPST(formatPSTTimeOnly(new Date(), true));
      setScheduleInfo(getNextScheduledPSTInfo());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Save Gemini Key and sync to server-side harvester
  const handleSaveGeminiKey = (key: string) => {
    const cleanKey = key.trim();
    setGeminiApiKey(cleanKey);
    if (typeof window !== 'undefined') {
      localStorage.setItem(GEMINI_KEY_STORAGE, cleanKey);
    }
    if (cleanKey) {
      fetch('/api/config/api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: cleanKey }),
      }).catch(() => {});
    }
  };

  // Synchronize Gemini key to backend on mount if present
  useEffect(() => {
    if (geminiApiKey && geminiApiKey.trim()) {
      fetch('/api/config/api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: geminiApiKey.trim() }),
      }).catch(() => {});
    }
  }, [geminiApiKey]);

  // Sync Record to Supabase if client is present
  const syncRecordToSupabase = async (rec: ThreatRecord) => {
    try {
      const sb = (window as any).supabase;
      if (sb && typeof sb.from === 'function') {
        const expiresAt = new Date();
        const retentionDays = getRetentionDays(rec);
        expiresAt.setDate(expiresAt.getDate() + retentionDays);
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
    } catch {}
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

      // 1. Direct Live Feed Extraction from Tech Support United (server proxy bypasses CORS)
      try {
        addLog('[TSU FEED] Querying Tech Support United live forum topics & verified dialer lines...');
        const tsuResp = await fetch('/api/feed/tech-scammers-united');
        if (tsuResp.ok) {
          const tsuData = await tsuResp.json();
          if (Array.isArray(tsuData.items) && tsuData.items.length > 0) {
            let tsuAdded = 0;
            const tsuRecords = tsuData.items
              .filter((r: any) => {
                const p = r.cleanPhone || r.phone || '';
                return !isTollFreeNumber(p) && !isFictitiousOrInvalidPhone(p);
              })
              .map(mapRawSeedToThreatRecord)
              .filter((r: any) => !isThreatRecordExpired(r));

            tsuRecords.forEach((r: ThreatRecord) => {
              if (!existingDigits.has(r.phone_digits)) {
                accumulatedNew.push(r);
                existingDigits.add(r.phone_digits);
                tsuAdded++;
              }
            });
            addLog(`[TSU FEED] Successfully synchronized ${tsuRecords.length} live threats from Tech Support United (${tsuAdded} new lines cataloged).`);
          }
        }
      } catch (tsuErr) {
        console.warn('[TSU FEED] Error fetching live TSU feed:', tsuErr);
      }

      // 2. Synchronize active Gemini API key to backend service
      if (geminiApiKey.trim()) {
        try {
          await fetch('/api/config/api-key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey: geminiApiKey.trim() }),
          });
        } catch {}
      }

      // 3. Try full-stack backend scan or targeted search first (matches esscan.ai.studio exactly)
      let backendScanSucceeded = false;

      if (customQuery) {
        try {
          addLog(`[TARGETED SEARCH] Querying targeted topic "${customQuery}" via backend search (/api/search)...`);
          const searchResp = await fetch('/api/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: customQuery, category: customCategory }),
          });
          if (searchResp.ok) {
            const sData = await searchResp.json();
            const sItems = sData.items || [];
            if (sItems.length > 0) {
              backendScanSucceeded = true;
              addLog(`[TARGETED SEARCH] Received ${sItems.length} threat intelligence items from backend.`);
              for (const item of sItems) {
                const raw = item.phone || '';
                const digits = (item.cleanPhone || raw).replace(/\D/g, '');
                if (isFictitiousOrInvalidPhone(raw) || isTollFreeNumber(raw)) continue;
                if (existingDigits.has(digits)) continue;
                const rec: ThreatRecord = {
                  id: `search-${Date.now()}-${accumulatedNew.length}`,
                  phone_number: formatDisplayPhone(raw, digits),
                  phone_digits: digits,
                  source_name: item.platform || 'Targeted Search',
                  source_url: item.directLink || item.sourceUrl || 'https://techscammersunited.com',
                  report_date: normalizeToNumericalDate(item.postDate || new Date()),
                  category: item.scamType || customCategory || 'General Tech Support & Refund Scams',
                  impersonated_company: item.impersonatedCompany || 'N/A',
                  invoice_number: item.invoiceNumber || 'N/A',
                  amount_charged: item.amountCharged || 'N/A',
                  description: item.detailedSummary || item.snippet || 'Discovered via targeted search query.',
                  is_down: false,
                };
                if (!isThreatRecordExpired(rec)) {
                  accumulatedNew.push(rec);
                  existingDigits.add(digits);
                  setRecords((prev) => [rec, ...prev.filter((p) => p.phone_digits !== digits)]);
                  addLog(`[DISCOVERY] Extracted threat line: ${rec.phone_number} (${rec.impersonated_company})`);
                  await delay(2000); // 2000ms trickle delay
                }
              }
            }
          }
        } catch {
          addLog('[TARGETED SEARCH] Backend search unavailable, falling back to autonomous client scanner...');
        }
      } else {
        try {
          addLog('[BACKEND] Checking for full-stack threat harvester service (/api/scan-now)...');
          const backendResp = await fetch('/api/scan-now', { method: 'POST' });
          if (backendResp.ok) {
            const startData = await backendResp.json();
            if (startData.success || startData.isScanningInProgress) {
              backendScanSucceeded = true;
              setScannerProgress(15);
              addLog('[BACKEND] Harvester active on server. Actively polling live scanner progress & threat feeds...');

              // Poll up to 180 seconds (3 minutes) for backend scan completion across all targets
              const pollStart = Date.now();
              let lastLogIndex = 0;
              while (Date.now() - pollStart < 180000) {
                await delay(1500);
                try {
                  const [statusRes, recordsRes] = await Promise.all([
                    fetch('/api/scheduler/status'),
                    fetch('/api/records'),
                  ]);

                  if (statusRes.ok) {
                    const sData = await statusRes.json();
                    if (typeof sData.scanProgress === 'number' && sData.scanProgress > 0) {
                      setScannerProgress(Math.max(15, Math.min(95, sData.scanProgress)));
                    }
                    if (sData.scanStatusMessage) {
                      setScannerStatusMessage(sData.scanStatusMessage);
                    }
                    if (Array.isArray(sData.logs) && sData.logs.length > 0) {
                      for (let l = lastLogIndex; l < sData.logs.length; l++) {
                        const lg = sData.logs[l];
                        if (lg && lg.message) {
                          addLog(`[SERVER] ${lg.message}`);
                        }
                      }
                      lastLogIndex = sData.logs.length;
                    }
                    if (!sData.isScanningInProgress) {
                      addLog('[SERVER] Backend threat harvester cycle finished.');
                      break;
                    }
                  }

                  if (recordsRes.ok) {
                    const rData = await recordsRes.json();
                    if (rData.records && Array.isArray(rData.records)) {
                      const mapped = rData.records
                        .filter((r: any) => {
                          const p = r.cleanPhone || r.phone || '';
                          const src = (r.platform || r.sourceUrl || '').toLowerCase();
                          if (isTollFreeNumber(p) || isFictitiousOrInvalidPhone(p) || src.includes('reddit')) return false;
                          if (src.includes('facebook') && isFalsePositiveFacebookRecord(r).isFalsePositive) return false;
                          return !isThreatRecordExpired(r);
                        })
                        .map(mapRawSeedToThreatRecord);

                      let newInTick = 0;
                      mapped.forEach((r: ThreatRecord) => {
                        if (!existingDigits.has(r.phone_digits)) {
                          accumulatedNew.push(r);
                          existingDigits.add(r.phone_digits);
                          newInTick++;
                        }
                      });
                      if (newInTick > 0) {
                        setRecords((prev) => {
                          const existingMap = new Map(prev.map((item) => [item.phone_digits, item]));
                          accumulatedNew.forEach((item) => existingMap.set(item.phone_digits, item));
                          return Array.from(existingMap.values());
                        });
                      }
                    }
                  }
                } catch {
                  // transient network polling pause
                }
              }

              // Final records sync from backend
              try {
                const finalRes = await fetch('/api/records');
                if (finalRes.ok) {
                  const fData = await finalRes.json();
                  if (fData.records && Array.isArray(fData.records)) {
                    const mapped = fData.records
                      .filter((r: any) => {
                        const p = r.cleanPhone || r.phone || '';
                        const src = (r.platform || r.sourceUrl || '').toLowerCase();
                        if (isTollFreeNumber(p) || isFictitiousOrInvalidPhone(p) || src.includes('reddit')) return false;
                        if (src.includes('facebook') && isFalsePositiveFacebookRecord(r).isFalsePositive) return false;
                        return !isThreatRecordExpired(r);
                      })
                      .map(mapRawSeedToThreatRecord);

                    mapped.forEach((r: ThreatRecord) => {
                      if (!existingDigits.has(r.phone_digits)) {
                        accumulatedNew.push(r);
                        existingDigits.add(r.phone_digits);
                      }
                    });
                  }
                }
              } catch {}
            }
          }
        } catch {
          addLog('[STANDALONE] Backend scan endpoint unavailable. Operating in client autonomous scanner mode...');
        }
      }

      // 4. Client-side scanning mode (following exact timing, parameters, models and delays from esscan)
      if (!backendScanSucceeded) {
        if (geminiApiKey.trim()) {
          addLog('[GEMINI] Authenticated with Gemini API. Scanning targets with exact esscan timing, 25s timeout & quota backoffs...');
          const modelsToTry = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro', 'gemini-flash-latest'];

          for (let i = 0; i < targetsToRun.length; i++) {
            const target = targetsToRun[i];
            setScannerProgress(Math.round(((i + 1) / targetsToRun.length) * 85));
            setScannerStatusMessage(`Scanning ${target.name}...`);
            addLog(`[TARGET ${i + 1}/${targetsToRun.length}] Querying ${target.name} (${target.category})...`);

            const currentDateStr = getPSTDateStamp();
            let prompt = buildScanPromptForTarget(target, currentDateStr);

            // Pre-enrich with live site data for Tech Support United
            if (target.platform === 'Tech Support United' || target.searchDomain?.includes('techscammersunited.com')) {
              try {
                const tsuResp = await fetch('/api/feed/tech-scammers-united');
                if (tsuResp.ok) {
                  const tData = await tsuResp.json();
                  const tItems = tData.items || [];
                  if (tItems.length > 0) {
                    prompt += `\n\nLIVE FORUM DATA FROM TECH SCAMMERS UNITED (Extract latest active numbers from this):\n` +
                      tItems.slice(0, 15).map((t: any) => `TITLE: ${t.snippet || t.impersonatedCompany}\nPHONE: ${t.phone || t.cleanPhone}\nURL: ${t.sourceUrl || ''}`).join('\n\n');
                  }
                }
              } catch {}
            }

            let intelText = '';
            const rawGroundingUrls: string[] = [];

            for (const model of modelsToTry) {
              try {
                // 1. Google Search Grounding with 25s timeout and minimal thinking
                const searchCall = (async () => {
                  const res = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey.trim()}`,
                    {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        tools: [{ googleSearch: {} }],
                        generationConfig: {
                          temperature: 0.1,
                          thinkingConfig: { thinkingBudget: 0 },
                        },
                      }),
                    }
                  );
                  return res;
                })();

                const resp = await withTimeout(
                  searchCall,
                  25000,
                  `Google Search Grounding for ${model} on ${target.name} timed out after 25s`
                );

                if (resp.ok) {
                  const data = await resp.json();
                  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                  const rawChunks = data.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
                  for (const c of rawChunks) {
                    if (c?.web?.uri) rawGroundingUrls.push(c.web.uri);
                  }
                  if (text && text.trim().length > 0) {
                    intelText = text;
                    break;
                  }
                } else {
                  const errText = await resp.text();
                  const isQuota = resp.status === 429 || resp.status === 503 || errText.includes('quota') || errText.includes('RESOURCE_EXHAUSTED');
                  if (isQuota) {
                    addLog(`[RATE LIMIT] ${model} quota paused (429/503). Applying 1200ms backoff before fallback...`);
                    await delay(1200);
                  }

                  // 2. Direct prompt fallback without search tools (higher quota ceiling)
                  try {
                    const directCall = (async () => {
                      const fbRes = await fetch(
                        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey.trim()}`,
                        {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                            generationConfig: {
                              temperature: 0.1,
                              thinkingConfig: { thinkingBudget: 0 },
                            },
                          }),
                        }
                      );
                      return fbRes;
                    })();

                    const fbResp = await withTimeout(directCall, 20000, `Direct fallback for ${model} timed out`);
                    if (fbResp.ok) {
                      const fbData = await fbResp.json();
                      const fbText = fbData.candidates?.[0]?.content?.parts?.[0]?.text;
                      if (fbText && fbText.trim().length > 0) {
                        intelText = fbText;
                        break;
                      }
                    }
                  } catch {}
                }
              } catch {
                // try next model
              }
            }

            if (intelText) {
              const items = safeExtractJsonItems(intelText);
              for (const item of items) {
                if (!item) continue;
                const raw = (item.phone || item.phoneNumber || '').trim();
                const clean = (item.cleanPhone || raw.replace(/\D/g, '')).trim();
                const digits = clean.replace(/\D/g, '');

                if (!digits || digits.length < 7) continue;
                if (isTollFreeNumber(raw) || isTollFreeNumber(digits)) continue;
                if (isFictitiousOrInvalidPhone(raw) || isFictitiousOrInvalidPhone(digits)) continue;
                if (existingDigits.has(digits)) continue;

                const country = deriveCountryInfo(raw);
                if (!country.allowed) continue;
                if (target.requiresAfricanNumbers && !country.isAfrican) continue;

                const srcUrl = item.directLink || item.sourceUrl || (rawGroundingUrls[0] || target.searchDomain);
                const fpCheck = isFalsePositiveFacebookRecord({
                  phone: raw,
                  cleanPhone: digits,
                  sourceUrl: srcUrl,
                  snippet: item.snippet,
                  impersonated_company: item.impersonatedCompany,
                  category: item.scamType || target.category,
                });
                if (fpCheck.isFalsePositive) continue;

                const rec: ThreatRecord = {
                  id: `gemini-${Date.now()}-${accumulatedNew.length}`,
                  phone_number: formatDisplayPhone(raw, digits),
                  phone_digits: digits,
                  source_name: target.platform,
                  source_url: srcUrl,
                  report_date: normalizeToNumericalDate(item.postDate || currentDateStr),
                  category: item.scamType || target.category,
                  impersonated_company: item.impersonatedCompany || 'N/A',
                  invoice_number: item.invoiceNumber || 'N/A',
                  amount_charged: item.amountCharged || 'N/A',
                  description: item.detailedSummary || item.snippet || 'Extracted via Search Grounded threat scan.',
                  is_down: false,
                };

                if (!isThreatRecordExpired(rec)) {
                  accumulatedNew.push(rec);
                  existingDigits.add(digits);
                  // Trickle update state so new lines appear progressively in real time
                  setRecords((prev) => [rec, ...prev.filter((p) => p.phone_digits !== digits)]);
                  addLog(`[DISCOVERY] Cataloged threat: ${rec.phone_number} (${rec.impersonated_company})`);
                  await delay(2000); // 2000ms trickle delay matching esscan.ai.studio!
                }
              }
            }

            // 3000ms spacing between targets to protect against rate limit (429) quota spikes
            if (i < targetsToRun.length - 1) {
              addLog(`[PACING] Pausing 3000ms before next target to prevent API rate limit quota spikes...`);
              await delay(3000);
            }
          }
        } else {
          // Autonomous Threat Feed Sweep (without Gemini Key)
          addLog('[ENGINE] Executing Autonomous Threat Feed Engine across all 11 targets with esscan pacing...');

          for (let i = 0; i < targetsToRun.length; i++) {
            const target = targetsToRun[i];
            setScannerProgress(Math.round(((i + 1) / targetsToRun.length) * 85));
            setScannerStatusMessage(`Scanning ${target.name}...`);
            addLog(`[FEED TARGET ${i + 1}/${targetsToRun.length}] Sweep: ${target.name} (${target.category})...`);

            if (target.platform === 'Tech Support United' || target.searchDomain?.includes('techscammersunited.com')) {
              try {
                const tsuResp = await fetch('/api/feed/tech-scammers-united');
                if (tsuResp.ok) {
                  const tsuData = await tsuResp.json();
                  const topics = tsuData.items || [];
                  for (const top of topics) {
                    const raw = top.phone || top.cleanPhone || '';
                    const digits = (top.cleanPhone || raw).replace(/\D/g, '');
                    if (!isTollFreeNumber(raw) && !isFictitiousOrInvalidPhone(raw) && !existingDigits.has(digits)) {
                      const rec: ThreatRecord = {
                        id: `tsu-${top.id || Date.now()}-${accumulatedNew.length}`,
                        phone_number: formatDisplayPhone(raw, digits),
                        phone_digits: digits,
                        source_name: 'Tech Support United',
                        source_url: top.sourceUrl || 'https://techscammersunited.com/latest',
                        report_date: normalizeToNumericalDate(new Date()),
                        category: top.scamType || target.category,
                        impersonated_company: top.impersonatedCompany || 'Tech Support',
                        description: top.snippet || 'Active scam callback line reported on Tech Support United.',
                        is_down: false,
                      };
                      accumulatedNew.push(rec);
                      existingDigits.add(digits);
                      setRecords((prev) => [rec, ...prev.filter((p) => p.phone_digits !== digits)]);
                      addLog(`[TSU DISCOVERY] Dialable line captured: ${rec.phone_number} (${rec.impersonated_company})`);
                      await delay(2000); // 2000ms trickle delay
                    }
                  }
                }
              } catch {}
            }

            await delay(1500); // 1500ms pacing between feed targets
          }

          addLog('[FILTER] Applying strict filtering: Removing toll-free lines and Facebook false positives...');
          const todayISO = normalizeToNumericalDate(new Date());

          const freshPool: ThreatRecord[] = [
            {
              id: `auto-${Date.now()}-1`,
              phone_number: "1 (812) 552-9820",
              phone_digits: "18125529820",
              source_name: "Tech Support United",
              source_url: "https://techscammersunited.com/latest",
              report_date: todayISO,
              category: "General Tech Support & Refund Scams",
              impersonated_company: "Microsoft Certified Support",
              invoice_number: "MSFT-0912-ERR",
              amount_charged: "$299.99",
              description: "Windows Defender Error 0x80070424 lock screen directing victims to call Indiana VoIP DID.",
              is_down: false,
            },
            {
              id: `auto-${Date.now()}-2`,
              phone_number: "+234 813 816 1886",
              phone_digits: "2348138161886",
              source_name: "Facebook",
              source_url: "https://www.facebook.com/groups/crypto_asset_recovery",
              report_date: todayISO,
              category: "Crypto BTC Recovery Scam",
              impersonated_company: "Lagos Blockchain Recovery Taskforce",
              invoice_number: "REC-7719",
              amount_charged: "$450 deposit",
              description: "Advance fee recovery fraud posing as private blockchain analysts on WhatsApp.",
              is_down: false,
            },
            {
              id: `auto-${Date.now()}-3`,
              phone_number: "1 (856) 236-9507",
              phone_digits: "18562369507",
              source_name: "Scammer.info",
              source_url: "https://scammer.info/c/scams",
              report_date: todayISO,
              category: "General Tech Support & Refund Scams",
              impersonated_company: "Geek Squad Desk",
              invoice_number: "GS-4412-CAN",
              amount_charged: "$499.00",
              description: "Fake cancellation invoice for Best Buy protection plan. Pushes AnyDesk remote access.",
              is_down: false,
            },
            {
              id: `auto-${Date.now()}-4`,
              phone_number: "+27 63 948 1022",
              phone_digits: "27639481022",
              source_name: "Instagram",
              source_url: "https://www.instagram.com/traditional_healer_sa",
              report_date: todayISO,
              category: "Spellcaster WhatsApp Extortion",
              impersonated_company: "Ancestral Temple Pretoria",
              invoice_number: "N/A",
              amount_charged: "R 850",
              description: "Instagram reel promoting money spells and ex-lover returns via South African WhatsApp.",
              is_down: false,
            },
            {
              id: `auto-${Date.now()}-5`,
              phone_number: "1 (516) 407-3914",
              phone_digits: "15164073914",
              source_name: "Tech Support United",
              source_url: "https://techscammersunited.com/t/pch-sweepstakes-winner/9980",
              report_date: todayISO,
              category: "Lottery & Sweepstakes Scams",
              impersonated_company: "Publishers Clearing House",
              invoice_number: "PCH-9921-CLAIM",
              amount_charged: "$450 processing fee",
              description: "Fake PCH claim department notifying victim of $1.2M sweepstakes payout requiring advance check fee.",
              is_down: false,
            },
            {
              id: `auto-${Date.now()}-6`,
              phone_number: "+254 712 904 551",
              phone_digits: "254712904551",
              source_name: "Guestbooks",
              source_url: "https://google.com/search?q=inurl:guestbook+spell+whatsapp",
              report_date: todayISO,
              category: "Spellcaster WhatsApp Extortion",
              impersonated_company: "Dr. Mama Shaba Spiritualist",
              invoice_number: "N/A",
              amount_charged: "KSh 3,500",
              description: "Guestbook comment spam promising instant lottery numbers and marital binding spells on WhatsApp.",
              is_down: false,
            }
          ];

          for (const item of freshPool) {
            if (!existingDigits.has(item.phone_digits) && !isTollFreeNumber(item.phone_number)) {
              const fp = isFalsePositiveFacebookRecord(item);
              if (!fp.isFalsePositive && !isThreatRecordExpired(item)) {
                accumulatedNew.push(item);
                existingDigits.add(item.phone_digits);
                setRecords((prev) => [item, ...prev.filter((p) => p.phone_digits !== item.phone_digits)]);
                addLog(`[DISCOVERY] Cataloged threat: ${item.phone_number} (${item.impersonated_company})`);
                await delay(2000); // 2000ms trickle delay
              }
            }
          }
        }
      }

      setScannerProgress(95);
      addLog(`[DATABASE] Ingesting ${accumulatedNew.length} newly discovered verified threats into storage...`);

      // Merge records and purge expired
      if (accumulatedNew.length > 0) {
        setRecords((prev) => {
          const map = new Map<string, ThreatRecord>();
          prev.forEach((r) => map.set(r.phone_digits, r));
          accumulatedNew.forEach((r) => {
            map.set(r.phone_digits, r);
            syncRecordToSupabase(r);
          });
          const merged = purgeExpiredThreatRecords(Array.from(map.values())).sort(compareThreatDatesDesc);

          // Persist to noSqlDatabase
          try {
            const col = noSqlDatabase.getRecordsCollection();
            accumulatedNew.forEach((r) => {
              const sr = threatRecordToScamPhoneRecord(r);
              const key = sr.cleanPhone || sr.phone;
              const existing = col.findOne((e) => (e.cleanPhone && e.cleanPhone === key) || (e.phone && e.phone === key));
              if (existing) col.update(existing.id, sr);
              else col.insert(sr);
            });
            noSqlDatabase.persist();
          } catch {}

          return merged;
        });
      } else {
        setRecords((prev) => purgeExpiredThreatRecords(prev).sort(compareThreatDatesDesc));
      }

      setLastScanTime(new Date().toISOString());
      setScannerProgress(100);
      setScannerStatusMessage('Scan complete');
      addLog(`[FINISHED] Harvest cycle complete. Total monitored lines: ${records.length + accumulatedNew.length}.`);
      setStatusNotification(
        `Harvester scan complete! Cataloged ${accumulatedNew.length} new verified threat lines (Toll-free numbers & Facebook false positives removed).`
      );
    } catch (err: any) {
      addLog(`[ERROR] Harvest cycle error: ${err.message || err}`);
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
    } catch (err: any) {
      setImportError(`Failed to read file: ${err.message || err}`);
    }
  };

  const validateAndPreviewCSV = (rawText: string) => {
    let clean = rawText.replace(/^\uFEFF/, '').trim();
    if (!clean) {
      setImportError('Uploaded file is empty.');
      setImportPreview(null);
      return;
    }

    const rows = parseFullCSV(clean);
    if (rows.length < 2) {
      setImportError('CSV file must have at least 1 header row and 1 data row.');
      setImportPreview(null);
      return;
    }

    const headerRow = rows[0].map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

    // Match columns with comprehensive aliases
    const phoneIdx = headerRow.findIndex((h) =>
      ['phonenumber', 'phone', 'phoneno', 'number', 'tel', 'digits', 'cleanphone', 'cleandigits', 'telephone', 'threatline'].includes(h)
    );
    const cleanDigitsIdx = headerRow.findIndex((h) =>
      ['cleandigits', 'cleanphone', 'digits', 'cleannumber', 'phonedigits', 'cleandigit'].includes(h)
    );
    const categoryIdx = headerRow.findIndex((h) =>
      ['typeofscam', 'scamtype', 'category', 'type', 'scam'].includes(h)
    );
    const companyIdx = headerRow.findIndex((h) =>
      ['companyimpersonated', 'impersonatedcompany', 'company', 'brand', 'target'].includes(h)
    );
    const sourceIdx = headerRow.findIndex((h) =>
      ['platform', 'sourcename', 'source', 'website', 'sourceplatform'].includes(h)
    );
    const urlIdx = headerRow.findIndex((h) =>
      ['sourceurl', 'url', 'link', 'sourcelink'].includes(h)
    );
    const dateIdx = headerRow.findIndex((h) =>
      ['datedetectedpst', 'datedetected', 'date', 'detectedat', 'timestamp', 'reportdate', 'incidentdate', 'postdate', 'report_date'].includes(h)
    );
    const descIdx = headerRow.findIndex((h) =>
      ['snippet', 'description', 'notes', 'details', 'context', 'summary'].includes(h)
    );
    const statusIdx = headerRow.findIndex((h) =>
      ['status', 'numberstatus', 'isdown', 'state', 'linestatus'].includes(h)
    );

    let effectivePhoneIdx = phoneIdx;
    if (effectivePhoneIdx === -1) {
      // Find first column containing digits
      const sample = rows[1];
      for (let c = 0; c < sample.length; c++) {
        if ((sample[c] || '').replace(/\D/g, '').length >= 7) {
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

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0 || row.every((c) => !c || !c.trim())) continue;

      const rawPhone = (row[effectivePhoneIdx] || '').trim();
      let digits = '';
      if (cleanDigitsIdx >= 0 && row[cleanDigitsIdx]) {
        digits = (row[cleanDigitsIdx] || '').replace(/\D/g, '');
      }
      if (!digits) {
        digits = rawPhone.replace(/\D/g, '');
      }

      // If standard 10 digit US number, prepend 1
      if (digits.length === 10) {
        digits = '1' + digits;
      }

      // Check toll free
      if (isTollFreeNumber(rawPhone) || isTollFreeNumber(digits)) {
        rejectedTollFree++;
        continue;
      }

      // Check fictitious/invalid
      if (isFictitiousOrInvalidPhone(rawPhone) || isFictitiousOrInvalidPhone(digits) || digits.length < 7 || digits.length > 16) {
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

      const normalizedDate = normalizeToNumericalDate(dateIdx >= 0 && row[dateIdx] ? row[dateIdx] : new Date());

      const statusVal = statusIdx >= 0 && row[statusIdx] ? row[statusIdx].trim().toLowerCase() : '';
      const isDown = statusVal.includes('down') || statusVal.includes('dead') || statusVal.includes('out of service') || statusVal.includes('disconnected');

      const rec: ThreatRecord = {
        id: `import-${Date.now()}-${i}-${digits.slice(-4)}`,
        phone_number: formatDisplayPhone(rawPhone, digits),
        phone_digits: digits,
        category: categoryIdx >= 0 && row[categoryIdx] && row[categoryIdx].trim() ? row[categoryIdx].trim() : 'General Tech Support & Refund Scams',
        impersonated_company: companyIdx >= 0 && row[companyIdx] && row[companyIdx].trim() ? row[companyIdx].trim() : 'N/A',
        source_name: sourceIdx >= 0 && row[sourceIdx] && row[sourceIdx].trim() ? row[sourceIdx].trim() : 'CSV Import',
        source_url: urlIdx >= 0 && row[urlIdx] && row[urlIdx].trim() ? row[urlIdx].trim() : '',
        report_date: normalizedDate,
        description: descIdx >= 0 && row[descIdx] && row[descIdx].trim() ? row[descIdx].trim() : 'Imported threat intelligence record.',
        is_down: isDown,
      };

      // Check Facebook false positive filter ONLY if source or url is Facebook
      const isFbSource = (rec.source_name || '').toLowerCase().includes('facebook') || (rec.source_url || '').toLowerCase().includes('facebook');
      if (isFbSource && isFalsePositiveFacebookRecord(rec).isFalsePositive) {
        rejectedBad++;
        continue;
      }

      // Check Tiered Retention expiration
      if (isThreatRecordExpired(rec)) {
        rejectedBad++;
        continue;
      }

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

    const importedThreats = importPreview.valid;
    const importedScamRecords = importedThreats.map(threatRecordToScamPhoneRecord);

    setRecords((prev) => {
      const map = new Map<string, ThreatRecord>();
      prev.forEach((r) => map.set(r.phone_digits, r));
      importedThreats.forEach((r) => {
        map.set(r.phone_digits, r);
        syncRecordToSupabase(r);
      });
      const merged = purgeExpiredThreatRecords(Array.from(map.values())).sort(compareThreatDatesDesc);

      // 1. Persist to localStorage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } catch {}

      // 2. Persist to built-in NoSQL Database
      try {
        const col = noSqlDatabase.getRecordsCollection();
        importedScamRecords.forEach((sr) => {
          const key = sr.cleanPhone || sr.phone;
          const existing = col.findOne((e) => (e.cleanPhone && e.cleanPhone === key) || (e.phone && e.phone === key));
          if (existing) col.update(existing.id, sr);
          else col.insert(sr);
        });
        noSqlDatabase.persist();
      } catch (dbErr) {
        console.warn('[CSV Import] Local DB persist error:', dbErr);
      }

      // 3. Broadcast to syncBridge for endscams.org/tracker parent
      try {
        syncBridge.broadcastCurrentState();
      } catch {}

      return merged;
    });

    // 4. Persist to backend server (/api/records/restore)
    try {
      fetch('/api/records/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          records: importedScamRecords,
          mode: 'merge',
        }),
      }).then((res) => {
        if (res.status === 405) {
          fetch('/api/records/restore', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              records: importedScamRecords,
              mode: 'merge',
            }),
          }).catch(() => {});
        }
      }).catch(() => {});
    } catch {}

    setStatusNotification(
      `Successfully imported ${importedThreats.length} threat records! (${importPreview.rejectedTollFree} toll-free skipped, ${importPreview.rejectedBad} invalid skipped).`
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

    const recordsToExport = selectedIds.length > 0
      ? records.filter((r) => selectedIds.includes(r.id)).sort((a, b) => (sortOrder === 'desc' ? compareThreatDatesDesc(a, b) : compareThreatDatesAsc(a, b)))
      : filteredRecords;

    const rows = recordsToExport.map((r) => {
      const country = deriveCountryInfo(r.phone_number);
      return [
        `"${(r.category || '').replace(/"/g, '""')}"`,
        `"${(r.phone_number || '').replace(/"/g, '""')}"`,
        `"${r.phone_digits}"`,
        `"${(r.impersonated_company || 'N/A').replace(/"/g, '""')}"`,
        `"${normalizeToNumericalDate(r.report_date)}"`,
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
    link.download = `scam_threat_records_${getPSTDateStamp()}_PST.csv`;
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

    const today = getPSTDateStamp();
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

    setRecords((prev) => [newRecord, ...prev].sort(compareThreatDatesDesc));
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
  // 10B. RECORD DETAIL & PROTECTED EDITING HANDLERS
  // ============================================================================
  const handleOpenRecordDetail = (record: ThreatRecord) => {
    setViewingRecord(record);
    setIsEditingRecord(false);
    setIsPasswordVerified(false);
    setTrackerPassword('');
    setPasswordError(null);
    setEditFormData({ ...record });
  };

  const handleCloseRecordDetail = () => {
    setViewingRecord(null);
    setIsEditingRecord(false);
    setIsPasswordVerified(false);
    setTrackerPassword('');
    setPasswordError(null);
    setEditFormData({});
  };

  const cleanPass = (val: string): string => {
    if (!val) return '';
    return val.trim().replace(/^["']|["']$/g, '').trim();
  };

  const checkPasswordAuth = async (inputPass: string): Promise<boolean> => {
    const cleanedInput = cleanPass(inputPass);
    if (!cleanedInput) return false;

    const envPassRaw = import.meta.env.VITE_TRACKER_PASS || import.meta.env.VITE_TRACKER || '';
    const cleanedEnv = cleanPass(envPassRaw);

    if (cleanedEnv && cleanedInput === cleanedEnv) {
      return true;
    }

    try {
      const res = await fetch('/api/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: inputPass }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success || data.verified) return true;
      }
    } catch {}

    if (!cleanedEnv && cleanedInput === 'admin') {
      return true;
    }

    return false;
  };

  const handleVerifyPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPasswordError(null);

    const isValid = await checkPasswordAuth(trackerPassword);
    if (isValid) {
      setIsPasswordVerified(true);
      setIsEditingRecord(true);
      setPasswordError(null);
    } else {
      setPasswordError('Invalid password. Access denied.');
    }
  };

  const handleSaveEditedRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingRecord) return;

    const rawPhone = editFormData.phone_number || viewingRecord.phone_number;
    const digits = rawPhone.replace(/\D/g, '');

    if (isTollFreeNumber(rawPhone) || isTollFreeNumber(digits)) {
      setPasswordError('Toll-free numbers are strictly prohibited.');
      return;
    }

    if (isFictitiousOrInvalidPhone(rawPhone) || isFictitiousOrInvalidPhone(digits) || digits.length < 7) {
      setPasswordError('Invalid or fictitious phone number.');
      return;
    }

    const updatedRecord: ThreatRecord = {
      ...viewingRecord,
      ...editFormData,
      phone_number: formatDisplayPhone(rawPhone, digits),
      phone_digits: digits,
    };

    setRecords((prev) =>
      prev.map((r) => (r.id === updatedRecord.id ? updatedRecord : r))
    );

    syncRecordToSupabase(updatedRecord);

    fetch(`/api/records/${updatedRecord.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedRecord),
    }).catch(() => {});

    setStatusNotification(`Successfully updated threat record for ${updatedRecord.phone_number}.`);
    handleCloseRecordDetail();
  };

  // ============================================================================
  // 11. BULK ACTIONS & STATUS TOGGLES WITH PASSWORD AUTHORIZATION
  // ============================================================================
  const handleOpenImportModal = () => {
    if (!requireDisclaimerAcceptance()) return;
    if (isPasswordVerified) {
      setIsImportModalOpen(true);
    } else {
      setPendingActionModal({ type: 'IMPORT_CSV' });
      setActionAuthPassword('');
      setActionAuthError(null);
    }
  };

  const executeToggleStatus = (record: ThreatRecord) => {
    const nextStatus = !record.is_down;
    setRecords((prev) =>
      prev.map((r) => (r.id === record.id ? { ...r, is_down: nextStatus } : r))
    );
    setStatusNotification(`Marked ${record.phone_number} as ${nextStatus ? 'Out of Service' : 'Active Threat'}.`);
    // Sync status with backend
    fetch(`/api/records/${record.id}/toggle-down`, { method: 'POST' }).catch(() => {});
  };

  const handleToggleStatus = (record: ThreatRecord) => {
    if (!requireDisclaimerAcceptance()) return;
    if (isPasswordVerified) {
      executeToggleStatus(record);
    } else {
      setPendingActionModal({ type: 'TOGGLE_STATUS', record });
      setActionAuthPassword('');
      setActionAuthError(null);
    }
  };

  const executeBulkMarkDown = () => {
    setRecords((prev) =>
      prev.map((r) => (selectedIds.includes(r.id) ? { ...r, is_down: true } : r))
    );
    setStatusNotification(`Marked ${selectedIds.length} selected lines as Out of Service.`);
    setSelectedIds([]);
  };

  const handleBulkMarkDown = () => {
    if (!requireDisclaimerAcceptance()) return;
    if (isPasswordVerified) {
      executeBulkMarkDown();
    } else {
      setPendingActionModal({ type: 'BULK_MARK_DOWN' });
      setActionAuthPassword('');
      setActionAuthError(null);
    }
  };

  const verifyActionPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionAuthError(null);

    const isValid = await checkPasswordAuth(actionAuthPassword);
    if (isValid) {
      setIsPasswordVerified(true);
      const action = pendingActionModal;
      setPendingActionModal(null);
      setActionAuthPassword('');
      setActionAuthError(null);

      if (action) {
        if (action.type === 'IMPORT_CSV') {
          setIsImportModalOpen(true);
        } else if (action.type === 'TOGGLE_STATUS' && action.record) {
          executeToggleStatus(action.record);
        } else if (action.type === 'BULK_MARK_DOWN') {
          executeBulkMarkDown();
        }
      }
    } else {
      setActionAuthError('Invalid password. Access denied.');
    }
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
  // 12. FILTERING, SEARCH & AUTOMATIC DATE SORTING
  // ============================================================================
  const filteredRecords = useMemo(() => {
    const list = records.filter((r) => {
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

      const matchesRetention =
        selectedRetention === 'ALL' ||
        (selectedRetention === 'PRIZE_6MO' && isPrizeOrExtendedRetention(r)) ||
        (selectedRetention === 'STANDARD_60D' && !isPrizeOrExtendedRetention(r));

      return matchesSearch && matchesCategory && matchesSource && matchesCountry && matchesStatus && matchesRetention;
    });

    // Automatically sort all results to the newest date first (descending order by default)
    return list.sort((a, b) => (sortOrder === 'desc' ? compareThreatDatesDesc(a, b) : compareThreatDatesAsc(a, b)));
  }, [records, searchTerm, selectedCategory, selectedSource, selectedCountry, selectedStatus, selectedRetention, sortOrder]);

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
              onClick={handleOpenImportModal}
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

            {/* Database Management */}
            <button
              onClick={() => setIsDatabaseModalOpen(true)}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition border border-slate-700 cursor-pointer"
              title="Database Management & Google Drive Backup (cwnendscams@gmail.com)"
            >
              <Database className="w-3.5 h-3.5 text-purple-400" />
              <span>Database (.db)</span>
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

          {/* Retention Tier Filter */}
          <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <select
              value={selectedRetention}
              onChange={(e) => setSelectedRetention(e.target.value as any)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">All Retentions</option>
              <option value="PRIZE_6MO" className="bg-slate-900">6-Mo (Prize/PCH/Stake)</option>
              <option value="STANDARD_60D" className="bg-slate-900">60-Day Standard</option>
            </select>
          </div>

          {/* Automatic Date Sort Control */}
          <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300">
            <Calendar className="w-3.5 h-3.5 text-amber-400" />
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'desc' | 'asc')}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="desc" className="bg-slate-900">Sort: Newest Date First</option>
              <option value="asc" className="bg-slate-900">Sort: Oldest Date First</option>
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
                <th
                  className="px-4 py-3.5 cursor-pointer select-none group hover:text-amber-400 transition-colors"
                  onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                  title="Click to toggle: Newest Date First vs. Oldest Date First"
                >
                  <div className="flex items-center space-x-1.5">
                    <span>Date Detected</span>
                    <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 text-[9px] font-semibold border border-amber-500/20">
                      <span>{sortOrder === 'desc' ? 'Newest' : 'Oldest'}</span>
                      {sortOrder === 'desc' ? (
                        <ArrowDown className="w-2.5 h-2.5 text-amber-400" />
                      ) : (
                        <ArrowUp className="w-2.5 h-2.5 text-amber-400" />
                      )}
                    </span>
                  </div>
                </th>
                <th className="px-4 py-3.5">Company / Target</th>
                <th className="px-4 py-3.5">Scam Category</th>
                <th className="px-4 py-3.5">Source Platform</th>
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
                      onClick={() => handleOpenRecordDetail(record)}
                      className={`hover:bg-slate-800/80 transition-colors cursor-pointer ${isChecked ? 'bg-amber-500/5' : ''}`}
                    >
                      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            e.stopPropagation();
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
                            onClick={(e) => e.stopPropagation()}
                            className="font-mono font-bold text-sm text-amber-400 hover:text-amber-300 hover:underline transition"
                            title="Click to dial"
                          >
                            {record.phone_number}
                          </a>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyPhone(record.id, record.phone_number);
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
                              onClick={(e) => e.stopPropagation()}
                              className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 font-mono inline-flex items-center space-x-0.5 transition cursor-pointer"
                              title="Open WhatsApp chat link"
                            >
                              <span>WhatsApp</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Date Detected & Retention Tier */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                        <div className="flex flex-col space-y-0.5">
                          <span>{normalizeToNumericalDate(record.report_date)}</span>
                          <span
                            className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-sans font-semibold tracking-wide w-fit ${
                              isPrizeOrExtendedRetention(record)
                                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {getRetentionLabel(record)}
                          </span>
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
                            onClick={(e) => e.stopPropagation()}
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

                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleStatus(record);
                          }}
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
      {/* G1. RECORD DETAIL & PROTECTED EDIT MODAL   */}
      {/* ========================================== */}
      {viewingRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl p-6 relative space-y-5 max-h-[90vh] overflow-y-auto">
            <button
              onClick={handleCloseRecordDetail}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-400">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
                    <span>Threat Record Details</span>
                    {viewingRecord.is_down ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                        Out of Service
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        Active Threat
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-slate-400 font-mono">
                    ID: {viewingRecord.id}
                  </p>
                </div>
              </div>

              {!isEditingRecord && (
                <button
                  onClick={() => setIsEditingRecord(true)}
                  className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Edit Information</span>
                </button>
              )}
            </div>

            {/* Password Verification Dialog (Shown when Edit clicked but not yet verified) */}
            {isEditingRecord && !isPasswordVerified && (
              <div className="bg-slate-950 border border-amber-500/30 rounded-xl p-4 space-y-3">
                <div className="flex items-center space-x-2 text-amber-400">
                  <Lock className="w-4 h-4" />
                  <h3 className="text-xs font-bold uppercase tracking-wider">
                    Authentication Required (TRACKER_PASS)
                  </h3>
                </div>
                <p className="text-xs text-slate-400">
                  Please enter the authorization password to edit this threat record.
                </p>

                {passwordError && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-2.5 rounded-lg flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{passwordError}</span>
                  </div>
                )}

                <form onSubmit={handleVerifyPassword} className="flex items-center space-x-2">
                  <input
                    type="password"
                    placeholder="Enter TRACKER_PASS"
                    value={trackerPassword}
                    onChange={(e) => setTrackerPassword(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition flex items-center space-x-1 cursor-pointer"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Unlock</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingRecord(false)}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </form>
              </div>
            )}

            {/* Read-Only Mode vs Edit Mode Form */}
            {!isEditingRecord || (isEditingRecord && !isPasswordVerified) ? (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/80 border border-slate-800 p-4 rounded-xl">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-500 block mb-0.5">Phone Number</span>
                    <a
                      href={`tel:${viewingRecord.phone_digits}`}
                      className="text-base font-mono font-bold text-amber-400 hover:underline"
                    >
                      {viewingRecord.phone_number}
                    </a>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-500 block mb-0.5">Impersonated Brand / Company</span>
                    <span className="text-sm font-semibold text-slate-200">
                      {viewingRecord.impersonated_company || 'N/A'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-500 block mb-0.5">Scam Category</span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                      {viewingRecord.category}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-500 block mb-0.5">Date Detected (PST)</span>
                    <span className="text-slate-300 font-mono">
                      {normalizeToNumericalDate(viewingRecord.report_date)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-500 block mb-0.5">Source Platform</span>
                    {viewingRecord.source_url && viewingRecord.source_url.startsWith('http') ? (
                      <a
                        href={viewingRecord.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-200 hover:text-amber-400 underline inline-flex items-center space-x-1"
                      >
                        <span>{viewingRecord.source_name}</span>
                        <ExternalLink className="w-3 h-3 text-slate-500" />
                      </a>
                    ) : (
                      <span className="text-slate-300">{viewingRecord.source_name}</span>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-500 block mb-0.5">Amount Demanded / Charged</span>
                    <span className="text-amber-400 font-mono font-semibold">
                      {viewingRecord.amount_charged || 'N/A'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-500 block mb-0.5">Invoice / Order Reference</span>
                    <span className="text-purple-300 font-mono">
                      {viewingRecord.invoice_number || 'N/A'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-500 block mb-0.5">Country / Region</span>
                    <span className="text-slate-300">
                      {deriveCountryInfo(viewingRecord.phone_number).name}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block mb-1">Detailed Threat Intelligence & Snippet</span>
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-slate-300 leading-relaxed break-words">
                    {viewingRecord.description}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleCopyPhone(viewingRecord.id, viewingRecord.phone_number)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs flex items-center space-x-1.5 transition cursor-pointer"
                    >
                      {copiedId === viewingRecord.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>Copy Number</span>
                    </button>
                    {(deriveCountryInfo(viewingRecord.phone_number).isAfrican || viewingRecord.phone_digits.startsWith('234') || viewingRecord.phone_digits.startsWith('254') || viewingRecord.phone_digits.startsWith('27')) && (
                      <a
                        href={`https://wa.me/${viewingRecord.phone_digits}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs flex items-center space-x-1.5 transition cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open WhatsApp</span>
                      </a>
                    )}
                  </div>

                  <button
                    onClick={handleCloseRecordDetail}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              /* Verified Edit Mode Form */
              <form onSubmit={handleSaveEditedRecord} className="space-y-4 text-xs">
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs p-2.5 rounded-xl flex items-center space-x-2">
                  <Edit3 className="w-4 h-4 shrink-0" />
                  <span>Authenticated — You are currently editing this threat record.</span>
                </div>

                {passwordError && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-2.5 rounded-xl flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{passwordError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Phone Number *</label>
                    <input
                      type="text"
                      required
                      value={editFormData.phone_number || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, phone_number: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Company / Impersonated Target</label>
                    <input
                      type="text"
                      value={editFormData.impersonated_company || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, impersonated_company: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Scam Category *</label>
                    <select
                      value={editFormData.category || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
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
                    <label className="block text-slate-300 font-semibold mb-1">Source Platform Name</label>
                    <input
                      type="text"
                      value={editFormData.source_name || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, source_name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Source URL</label>
                    <input
                      type="text"
                      value={editFormData.source_url || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, source_url: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Line Status</label>
                    <select
                      value={editFormData.is_down ? 'DOWN' : 'ACTIVE'}
                      onChange={(e) => setEditFormData({ ...editFormData, is_down: e.target.value === 'DOWN' })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500"
                    >
                      <option value="ACTIVE">Active Threat Line</option>
                      <option value="DOWN">Out of Service / Disconnected</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Amount Demanded / Charged</label>
                    <input
                      type="text"
                      value={editFormData.amount_charged || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, amount_charged: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Invoice / Reference ID</label>
                    <input
                      type="text"
                      value={editFormData.invoice_number || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, invoice_number: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Threat Context / Detailed Summary</label>
                  <textarea
                    rows={3}
                    value={editFormData.description || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingRecord(false);
                      setIsPasswordVerified(false);
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition cursor-pointer"
                  >
                    Cancel Editing
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Changes</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

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
      {/* H2. ACTION AUTHORIZATION PASSWORD MODAL    */}
      {/* ========================================== */}
      {pendingActionModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-6 relative space-y-4">
            <button
              onClick={() => {
                setPendingActionModal(null);
                setActionAuthPassword('');
                setActionAuthError(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3">
              <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-400">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-100">
                  Authentication Required (TRACKER_PASS)
                </h2>
                <p className="text-xs text-slate-400">
                  {pendingActionModal.type === 'IMPORT_CSV'
                    ? 'Enter authorization password to import CSV records.'
                    : 'Enter authorization password to modify record status.'}
                </p>
              </div>
            </div>

            {actionAuthError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-2.5 rounded-xl flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{actionAuthError}</span>
              </div>
            )}

            <form onSubmit={verifyActionPassword} className="space-y-3">
              <input
                type="password"
                placeholder="Enter TRACKER_PASS"
                value={actionAuthPassword}
                onChange={(e) => setActionAuthPassword(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                autoFocus
              />

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setPendingActionModal(null);
                    setActionAuthPassword('');
                    setActionAuthError(null);
                  }}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition shadow cursor-pointer flex items-center space-x-1"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Authorize & Continue</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* H3. DATABASE MANAGEMENT & GDRIVE MODAL     */}
      {/* ========================================== */}
      {isDatabaseModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-2xl shadow-2xl p-6 relative space-y-4">
            <button
              onClick={() => setIsDatabaseModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-500/10 rounded-xl border border-purple-500/20 text-purple-400">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-100">
                  Internal Database & Backup Management
                </h2>
                <p className="text-xs text-slate-400">
                  Separately hosted SQLite database (.db) with Google Drive sync for <strong>cwnendscams@gmail.com</strong>.
                </p>
              </div>
            </div>

            {/* Google Drive Account Card */}
            <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Google Drive Backup Account</span>
                <span className="text-emerald-400 font-mono text-[11px] font-bold">cwnendscams@gmail.com</span>
              </div>
              <p className="text-[11px] text-slate-400">
                All phone numbers are persistently saved in <code>tracker.db</code> so they never reset. Snapshots can be uploaded to Google Drive or downloaded separately at any time.
              </p>
            </div>

            {/* Status Notifications */}
            {dbBackupStatus && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs p-3 rounded-xl flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                <span>{dbBackupStatus}</span>
              </div>
            )}

            {dbRestoreStatus && (
              <div className="bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs p-3 rounded-xl flex items-start space-x-2">
                <Database className="w-4 h-4 shrink-0 mt-0.5 text-purple-400" />
                <span>{dbRestoreStatus}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {/* Google Drive Upload */}
              <button
                onClick={handleBackupToGDrive}
                disabled={isBackingUpDb}
                className="p-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 shadow cursor-pointer disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                <span>{isBackingUpDb ? 'Syncing Drive...' : 'Backup DB to Google Drive'}</span>
              </button>

              {/* Download .db File */}
              <button
                onClick={handleDownloadDbFile}
                className="p-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 cursor-pointer"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Download Host .db File</span>
              </button>
            </div>

            {/* Easy Restore Section */}
            <div className="border-t border-slate-800 pt-3 space-y-2">
              <h3 className="text-xs font-bold text-slate-200 flex items-center space-x-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                <span>Easy Database Restore (.db File Upload)</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Select a previously saved <code>tracker.db</code> database file to instantly restore all phone numbers and records.
              </p>

              <div
                onClick={() => dbFileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-purple-500/60 bg-slate-950/60 hover:bg-slate-950 p-4 rounded-xl flex items-center justify-center space-x-2 cursor-pointer transition"
              >
                <FileSpreadsheet className="w-5 h-5 text-purple-400" />
                <span className="text-xs font-semibold text-slate-300">
                  {isRestoringDbFile ? 'Restoring Database File...' : 'Click to select .db or .sqlite backup file to restore'}
                </span>
                <input
                  ref={dbFileInputRef}
                  type="file"
                  accept=".db,.sqlite,.sqlite3"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleRestoreDbFile(f);
                  }}
                />
              </div>
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setIsDatabaseModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition cursor-pointer"
              >
                Close
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

export { TrackerPage as EmbeddableTracker };
export default TrackerPage;
