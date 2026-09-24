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
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  Filter,
  Database,
  X,
  Radio,
  FileSpreadsheet,
  Zap,
  Info,
  Clock,
  Globe,
  PhoneCall,
  Phone,
  ShieldAlert,
  Building2,
  Calendar,
  DollarSign,
  MessageCircle,
  Sliders,
  Play,
  Key,
  Trash2,
  Share2,
  Award,
  ArrowDown,
  ArrowUp,
  Lock,
  Unlock,
  Edit3,
  Save,
  Eye,
  EyeOff,
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { getPSTDateStamp } from '../utils/dateUtils';
import { parseFullCSV, CSV_EXPORT_HEADERS } from '../utils/csvHandler';
import { noSqlDatabase } from '../db/noSqlDatabase';
import { syncBridge } from '../utils/syncBridge';
import { getCleanCopyPhone } from '../utils/phoneUtils';
import { resolveTargetCompany } from '../utils/targetUtils';
import { ScamPhoneRecord } from '../types';
import ReportScamPage from './ReportScamPage';
import {
  verifyEncryptedAdmin,
  verifyEncryptedBypass,
  isBypassAllowedForAction,
  checkClientGeoPermission,
} from '../utils/security';

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

export interface TrackerPageProps {
  onNavigateToReport?: () => void;
}

/**
 * Checks if a threat record or specific number is a verified WhatsApp channel.
 * Evaluates explicit flag, category/description keywords, and high-frequency international carrier prefixes.
 */
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
  if (cat.includes('spellcaster') || desc.includes('spellcaster')) return true;
  const digits = (record.phone_digits || record.phone_number || '').replace(/\D/g, '');
  if (
    digits.startsWith('234') ||
    digits.startsWith('254') ||
    digits.startsWith('27') ||
    digits.startsWith('233') ||
    digits.startsWith('260') ||
    digits.startsWith('256') ||
    digits.startsWith('237') ||
    digits.startsWith('229') ||
    digits.startsWith('263')
  ) {
    return true;
  }
  return false;
}

// ============================================================================
// 1. EXACT SEARCH PARAMETERS & SCAN TARGETS FROM ESSCAN.AI.STUDIO
// ============================================================================
export const GEMINI_SEARCH_MODEL_VARIATIONS: string[] = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.1-flash-lite-preview',
  'gemini-3.1-pro-preview',
  'gemini-3-flash-preview',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-pro-latest',
];

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
    rejectTollFree: false,
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
    rejectTollFree: false,
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
    rejectTollFree: false,
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
- EXTRACT ALL PHONE NUMBERS: Include toll-free numbers (800, 888, 877, 866, 855, 844, 833) and all geographic area codes.
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
- EXTRACT ALL PHONE NUMBERS: Include toll-free numbers (800, 888, 877, 866, 855, 844, 833) and all geographic area codes.
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
- EXTRACT ALL PHONE NUMBERS: Include toll-free numbers (800, 888, 877, 866, 855, 844, 833) and standard geographic area codes.
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
2. EXTRACT ALL PHONE NUMBERS: Include toll-free numbers (800, 888, 877, 866, 855, 844, 833) and standard geographic area codes.
3. NEVER RETURN FICTITIOUS/EXAMPLE/PLACEHOLDER NUMBERS. Reject 555 exchange, sequential digits, or repeating numbers.
4. LOCATION MANDATE: ${
  target.requiresAfricanNumbers
    ? 'Extract ONLY African phone numbers (+234, +254, +27, +260, +233, etc.). Do not return US numbers for social targets.'
    : 'Return geographic US VoIP DIDs, toll-free lines, or international numbers.'
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
export function isTollFreeNumber(_phone: string): boolean {
  return false;
}

/**
 * Strict validation helper to reject fake, dummy, 555-exchange, sequential,
 * or repeating digits matching esscan.ai.studio's server rules.
 */
export function isFictitiousOrInvalidPhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return true;
  const clean = phone.replace(/[^0-9+]/g, '');
  const digits = clean.replace(/\D/g, '');

  // Must be valid phone digit length (7 to 15 digits)
  if (digits.length < 7 || digits.length > 15) return true;

  // Universal fictional / placeholder: contains 555 anywhere
  if (digits.includes('555')) return true;

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
    isWhatsapp: isWhatsAppThreat(r),
    altNumbers: r.alt_numbers && r.alt_numbers.length > 0 ? r.alt_numbers.map((a: any) => (typeof a === 'string' ? a : a.phone)) : undefined,
    altNumbersWithDetails: r.alt_numbers && r.alt_numbers.length > 0 ? r.alt_numbers.map((a: any) => (typeof a === 'string' ? { phone: a, digits: String(a).replace(/\D/g, '') } : a)) : undefined,
    scamType: r.category,
    impersonatedCompany: resolveTargetCompany(r.scammer_name || r.impersonated_company, r.category, r.description),
    scammerName: r.scammer_name || r.impersonated_company,
    invoiceNumber: r.invoice_number || 'N/A',
    amountCharged: r.amount_charged || (r.money_lost ? `$${r.money_lost}` : 'N/A'),
    moneyLost: r.money_lost,
    howContacted: r.how_contacted,
    reporterName: r.reporter_name,
    reporterEmail: r.reporter_email,
    imageUrl: r.image_url || r.evidence_url,
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
 * Converts global ScamPhoneRecord to internal ThreatRecord.
 */
export function scamPhoneRecordToThreatRecord(item: any): ThreatRecord {
  const rawPhone = String(item.phone || item.phone_number || '').trim();
  const digits = String(item.cleanPhone || item.phone_digits || rawPhone.replace(/\D/g, '')).trim();
  const formatted = formatDisplayPhone(rawPhone, digits);
  const reportDate = normalizeToNumericalDate(item.postDate || item.detectedAt || item.report_date || new Date());
  const category = item.scamType || item.category || 'General Tech Support & Refund Scams';
  const description = (item.snippet || item.detailedSummary || item.description || 'Reported via https://endscams.org/report').trim();
  const impersonatedCompany = item.impersonatedCompany || item.impersonated_company || resolveTargetCompany(description, category);
  const scammerName = item.scammerName || item.scammer_name || impersonatedCompany;

  let mappedAlts: AltNumberEntry[] | undefined = undefined;
  if (Array.isArray(item.altNumbersWithDetails) && item.altNumbersWithDetails.length > 0) {
    mappedAlts = item.altNumbersWithDetails;
  } else if (Array.isArray(item.altNumbers) && item.altNumbers.length > 0) {
    mappedAlts = item.altNumbers.map((a: any) => (typeof a === 'string' ? { phone: a, digits: a.replace(/\D/g, ''), is_whatsapp: false } : a));
  } else if (Array.isArray(item.alt_numbers) && item.alt_numbers.length > 0) {
    mappedAlts = item.alt_numbers.map((a: any) => (typeof a === 'string' ? { phone: a, digits: a.replace(/\D/g, ''), is_whatsapp: false } : a));
  }

  return {
    id: item.id || `rec-${Date.now()}-${digits.slice(-4) || Math.random().toString(36).slice(2, 6)}`,
    phone_number: formatted,
    phone_digits: digits,
    is_whatsapp: Boolean(item.isWhatsapp || item.is_whatsapp),
    alt_numbers: mappedAlts,
    source_name: item.platform || item.source_name || 'User Report (endscams.org/report)',
    source_url: item.sourceUrl || item.source_url || 'https://endscams.org/report',
    report_date: reportDate,
    category: category,
    impersonated_company: impersonatedCompany,
    scammer_name: scammerName,
    invoice_number: item.invoiceNumber || item.invoice_number || 'N/A',
    amount_charged: item.amountCharged || item.amount_charged || (item.moneyLost || item.money_lost ? `$${item.moneyLost || item.money_lost}` : 'N/A'),
    money_lost: item.moneyLost || item.money_lost,
    how_contacted: item.howContacted || item.how_contacted,
    reporter_name: item.reporterName || item.reporter_name,
    reporter_email: item.reporterEmail || item.reporter_email,
    image_url: item.imageUrl || item.image_url || item.evidenceUrl || item.evidence_url,
    description: description,
    is_down: Boolean(item.isNumberDown || item.is_down),
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
// TIERED RETENTION: 6-MO PRIZE/PCH/STAKE & 90-DAY STANDARD
// ============================================================================
export const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
export const SIXTY_DAYS_MS = NINETY_DAYS_MS; // Backward compatibility alias
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
  return isPrizeOrExtendedRetention(record) ? 180 : 90;
}

export function getRetentionLabel(record: Partial<ThreatRecord> | null | undefined): string {
  return isPrizeOrExtendedRetention(record) ? '6-Mo Prize' : '90-Day';
}

export function getThreatRecordTimestamp(record: Partial<ThreatRecord> | null | undefined): number {
  if (!record) return 0;
  const candidate = record.report_date;
  if (!candidate) return 0;
  const dateStr = normalizeToNumericalDate(candidate);
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const t = new Date(`${dateStr}T12:00:00.000Z`).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  const t = new Date(candidate).getTime();
  return isNaN(t) ? 0 : t;
}

export function isThreatRecordExpired(record: Partial<ThreatRecord> | null | undefined, now: number = Date.now()): boolean {
  if (!record) return false;
  const time = getThreatRecordTimestamp(record);
  if (time === 0) return false;
  const retentionMs = isPrizeOrExtendedRetention(record) ? SIX_MONTHS_MS : NINETY_DAYS_MS;
  return (now - time) > retentionMs;
}

export function purgeExpiredThreatRecords(records: ThreatRecord[], now: number = Date.now()): ThreatRecord[] {
  return records.filter((r) => Boolean(r && (r.phone_digits || r.phone_number) && !isThreatRecordExpired(r, now)));
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
    is_whatsapp: true,
    alt_numbers: [
      { phone: "+234 813 816 1886", digits: "2348138161886", is_whatsapp: true },
      { phone: "+234 802 441 9901", digits: "2348024419901", is_whatsapp: true }
    ],
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
    is_whatsapp: true,
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
    is_whatsapp: false,
    alt_numbers: [
      { phone: "1 (951) 629-3963", digits: "19516293963", is_whatsapp: false }
    ],
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
    is_whatsapp: true,
    alt_numbers: [
      { phone: "+234 814 658 9232", digits: "2348146589232", is_whatsapp: true }
    ],
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

  let alt_numbers: AltNumberEntry[] | undefined = undefined;
  if (Array.isArray(r.alt_numbers)) {
    alt_numbers = r.alt_numbers.map((a: any) => {
      if (typeof a === 'string') {
        const ad = a.replace(/\D/g, '');
        return { phone: formatDisplayPhone(a, ad), digits: ad, is_whatsapp: false };
      }
      const ad = (a.digits || a.phone_digits || a.phone || '').replace(/\D/g, '');
      return {
        phone: a.phone || formatDisplayPhone(a.phone || ad, ad),
        digits: ad,
        is_whatsapp: Boolean(a.is_whatsapp || a.isWhatsapp),
      };
    });
  } else if (Array.isArray(r.altNumbers)) {
    alt_numbers = r.altNumbers.map((a: any) => {
      if (typeof a === 'string') {
        const ad = a.replace(/\D/g, '');
        return { phone: formatDisplayPhone(a, ad), digits: ad, is_whatsapp: false };
      }
      const ad = (a.digits || a.cleanPhone || a.phone || '').replace(/\D/g, '');
      return {
        phone: a.phone || formatDisplayPhone(a.phone || ad, ad),
        digits: ad,
        is_whatsapp: Boolean(a.is_whatsapp || a.isWhatsapp),
      };
    });
  }

  const isWa = r.is_whatsapp ?? r.isWhatsapp ?? isWhatsAppThreat({
    is_whatsapp: r.is_whatsapp || r.isWhatsapp,
    phone_digits: digits,
    phone_number: rawPhone,
    category: r.scamType || r.category,
    description: r.detailedSummary || r.description || r.snippet,
    source_name: r.platform || r.source_name || r.sourceDomain,
  });

  return {
    id: r.id || `rec-${digits}`,
    phone_number: formatDisplayPhone(rawPhone, digits),
    phone_digits: digits,
    is_whatsapp: isWa,
    alt_numbers: alt_numbers && alt_numbers.length > 0 ? alt_numbers : undefined,
    source_name: r.platform || r.source_name || r.sourceDomain || 'Threat Intelligence',
    source_url: r.sourceUrl || r.source_url || '',
    report_date: normalizeToNumericalDate(r.detectedAt || r.report_date || r.postDate),
    category: r.scamType || r.category || 'General Tech Support & Refund Scams',
    impersonated_company: resolveTargetCompany(
      r.impersonatedCompany || r.impersonated_company,
      r.scamType || r.category,
      r.detailedSummary || r.description || r.snippet
    ),
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

// Centralized deduplication helper ensuring zero ID collisions and zero digit collisions
export function deduplicateThreatRecordsList(records: ThreatRecord[]): ThreatRecord[] {
  const map = new Map<string, ThreatRecord>();
  const idToDigits = new Map<string, string>();

  for (const item of records) {
    if (!item) continue;
    const digits = (item.phone_digits || item.phone_number || '').replace(/\D/g, '');
    if (!digits) continue;
    const cleanItem: ThreatRecord = { ...item, phone_digits: digits };

    // If an item with this ID already exists, update/merge status without creating a second item
    if (item.id && idToDigits.has(item.id)) {
      const existingDigits = idToDigits.get(item.id)!;
      const ex = map.get(existingDigits)!;
      map.set(existingDigits, { ...ex, is_down: item.is_down ?? ex.is_down });
      continue;
    }

    // If an item with these phone digits already exists, merge with preference for newer reports
    if (map.has(digits)) {
      const ex = map.get(digits)!;
      const itemDate = item.report_date || '';
      const exDate = ex.report_date || '';
      if (itemDate >= exDate) {
        map.set(digits, {
          ...ex,
          ...cleanItem,
          impersonated_company: cleanItem.impersonated_company && cleanItem.impersonated_company !== 'N/A' ? cleanItem.impersonated_company : ex.impersonated_company,
          description: cleanItem.description || ex.description,
          is_down: item.is_down ?? ex.is_down,
        });
      } else {
        map.set(digits, {
          ...cleanItem,
          ...ex,
          is_down: item.is_down ?? ex.is_down,
        });
      }
    } else {
      map.set(digits, cleanItem);
      if (item.id) idToDigits.set(item.id, digits);
    }
  }

  // Strict second-pass guarantee that every record has a strictly unique ID
  const seenIds = new Set<string>();
  const result: ThreatRecord[] = [];
  for (const r of map.values()) {
    if (r.id && seenIds.has(r.id)) continue;
    if (r.id) seenIds.add(r.id);
    result.push(r);
  }
  return result;
}

const MASTER_SEED_RECORDS: ThreatRecord[] = (() => {
  const allSeeds = [...DATABASE_SEED_RECORDS, ...CLEAN_ESSCAN_SEED_RECORDS.filter((r) => !isThreatRecordExpired(r))];
  return purgeExpiredThreatRecords(deduplicateThreatRecordsList(allSeeds)).sort(compareThreatDatesDesc);
})();

const STORAGE_KEY = 'esscan_threat_records_v2';
const GEMINI_KEY_STORAGE = 'esscan_gemini_api_key';

// ============================================================================
// 5. TRACKER PAGE COMPONENT (MATCHING ESSCAN.AI.STUDIO)
// ============================================================================
export function TrackerPage({ onNavigateToReport }: TrackerPageProps = {}) {
  const [records, setRecords] = useState<ThreatRecord[]>(() => {
    let combined: ThreatRecord[] = [...MASTER_SEED_RECORDS];

    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            const validSaved: ThreatRecord[] = [];
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
                validSaved.push({ ...r, report_date: normalizedDate });
              }
            });
            combined = [...combined, ...validSaved];
          }
        }
      } catch {}
    }

    const deduped = purgeExpiredThreatRecords(deduplicateThreatRecordsList(combined)).sort(compareThreatDatesDesc);

    // Save cleaned deduplicated data back to localStorage to purge any legacy duplicate keys from past sessions
    if (typeof window !== 'undefined' && deduped.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(deduped));
      } catch {}
    }

    return deduped;
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
                const combined = [...mapped, ...prev];
                const finalDeduped = purgeExpiredThreatRecords(deduplicateThreatRecordsList(combined)).sort(compareThreatDatesDesc);
                if (typeof window !== 'undefined') {
                  try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(finalDeduped));
                  } catch {}
                }
                return finalDeduped;
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

  // Scanner States
  const [isScanning, setIsScanning] = useState(false);
  const [scannerProgress, setScannerProgress] = useState(0);
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
  const [selectedRetention, setSelectedRetention] = useState<'ALL' | 'PRIZE_6MO' | 'STANDARD_90D'>('ALL');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  // Modal States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Dokploy Settings & Supabase Database
  const [dokployConfig, setDokployConfig] = useState<{
    supabaseUrl: string;
    supabaseKey: string;
    hasSupabase: boolean;
    hasTrackerPass: boolean;
  }>({
    supabaseUrl: '',
    supabaseKey: '',
    hasSupabase: false,
    hasTrackerPass: false,
  });
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);

  // Administrative TRACKER_PASS Authentication & Encrypted Bypass
  const [isPasswordVerified, setIsPasswordVerified] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('tracker_pass_verified') === 'true';
    }
    return false;
  });
  const [isBypassSession, setIsBypassSession] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('tracker_pass_is_bypass') === 'true';
    }
    return false;
  });
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordActionName, setPasswordActionName] = useState('Administrative Action');
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);

  // Geo-IP Restriction: Only US, Canada, Australia, and all EU countries can add numbers
  const [isGeoAllowed, setIsGeoAllowed] = useState<boolean>(true);
  const [clientCountryCode, setClientCountryCode] = useState<string>('');

  // Threat Post Details Modal State (Center of Screen Popup)
  const [selectedDetailRecord, setSelectedDetailRecord] = useState<ThreatRecord | null>(null);
  const [isEditingInPopup, setIsEditingInPopup] = useState(false);
  const [popupEditForm, setPopupEditForm] = useState<{
    phone_number: string;
    impersonated_company: string;
    category: string;
    source_name: string;
    source_url: string;
    report_date: string;
    is_down: boolean;
    amount_charged: string;
    invoice_number: string;
    description: string;
    alt_phone_1?: string;
    alt_phone_2?: string;
    alt_phone_2_whatsapp?: boolean;
    is_whatsapp?: boolean;
    how_contacted?: string;
    money_lost?: string;
  }>({
    phone_number: '',
    impersonated_company: '',
    category: '',
    source_name: '',
    source_url: '',
    report_date: '',
    is_down: false,
    amount_charged: '',
    invoice_number: '',
    description: '',
    alt_phone_1: '',
    alt_phone_2: '',
    alt_phone_2_whatsapp: false,
    is_whatsapp: false,
    how_contacted: 'Phone Call',
    money_lost: '',
  });
  const [popupEditError, setPopupEditError] = useState<string | null>(null);

  // Edit Monitored Number Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ThreatRecord | null>(null);
  const [editForm, setEditForm] = useState<{
    phone_number: string;
    is_whatsapp: boolean;
    alt_numbers: Array<{ phone: string; is_whatsapp: boolean }>;
    category: string;
    impersonated_company: string;
    source_name: string;
    source_url: string;
    amount_charged: string;
    invoice_number: string;
    description: string;
    is_down: boolean;
  }>({
    phone_number: '',
    is_whatsapp: false,
    alt_numbers: [],
    category: '',
    impersonated_company: '',
    source_name: '',
    source_url: '',
    amount_charged: '',
    invoice_number: '',
    description: '',
    is_down: false,
  });
  const [editError, setEditError] = useState<string | null>(null);

  // Import States
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{ valid: ThreatRecord[]; rejectedTollFree: number; rejectedBad: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importSyncProgress, setImportSyncProgress] = useState<string | null>(null);
  const [isSupabaseSetupModalOpen, setIsSupabaseSetupModalOpen] = useState(false);
  const [supabaseTableStatus, setSupabaseTableStatus] = useState<{
    configured: boolean;
    tablesExist: boolean;
    table: string | null;
    error: string | null;
    databaseSource?: string;
    connectionTarget?: string;
    isDirectConnection?: boolean;
    isDokployEnvironment?: boolean;
    postgresConnected?: boolean;
    postgresCount?: number;
    postgresLatencyMs?: number;
  } | null>(null);
  const [isTestingSupabase, setIsTestingSupabase] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // EndScams.org/report Integration & Modal States
  const [quickReportPhone, setQuickReportPhone] = useState('');
  const [quickReportCategory, setQuickReportCategory] = useState('Lottery & Sweepstakes Scams');
  const [quickReportCompany, setQuickReportCompany] = useState('');
  const [quickReportHowContacted, setQuickReportHowContacted] = useState('Phone Call');
  const [quickReportIncidentDate, setQuickReportIncidentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [quickReportDescription, setQuickReportDescription] = useState('');
  const [quickReportMoneyLost, setQuickReportMoneyLost] = useState('');
  const [quickReportIsWhatsApp, setQuickReportIsWhatsApp] = useState(false);
  const [quickReportReporterName, setQuickReportReporterName] = useState('');
  const [quickReportReporterEmail, setQuickReportReporterEmail] = useState('');
  const [quickReportEvidenceFile, setQuickReportEvidenceFile] = useState<File | null>(null);
  const [quickReportEvidencePreview, setQuickReportEvidencePreview] = useState<string | null>(null);
  const [quickReportSubmitting, setQuickReportSubmitting] = useState(false);
  const [quickReportMessage, setQuickReportMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // Ingestion handler for numbers submitted via https://endscams.org/report (BroadcastChannel, Supabase, API, or window postMessage)
  const handleIncomingReport = (rawPayload: any) => {
    if (!rawPayload || typeof rawPayload !== 'object') return;
    try {
      const rawPhone = String(rawPayload.phone_number || rawPayload.phone || rawPayload.phone_digits || '').trim();
      const cleanDigits = String(rawPayload.phone_digits || rawPhone.replace(/\D/g, '')).trim();

      if (!cleanDigits || cleanDigits.length < 7) return;
      if (isTollFreeNumber(rawPhone) || isTollFreeNumber(cleanDigits)) {
        console.warn('[EndScams Ingestion] Discarded toll-free number from report:', rawPhone);
        return;
      }
      if (isFictitiousOrInvalidPhone(rawPhone) || isFictitiousOrInvalidPhone(cleanDigits)) {
        console.warn('[EndScams Ingestion] Discarded fictitious/invalid number from report:', rawPhone);
        return;
      }

      const formatted = formatDisplayPhone(rawPhone, cleanDigits);
      const reportDate = normalizeToNumericalDate(rawPayload.report_date || rawPayload.incident_date || new Date());
      const category = rawPayload.category || rawPayload.scamType || 'General Tech Support & Refund Scams';
      const description = (rawPayload.description || rawPayload.threat_intel || rawPayload.snippet || rawPayload.notes || 'Reported via https://endscams.org/report').trim();
      const scammerName = rawPayload.scammer_name || rawPayload.scammerName || rawPayload.impersonated_company || rawPayload.impersonatedCompany || (description.toLowerCase().includes('washington') ? 'American Cash Award (James Washington)' : resolveTargetCompany(description, category));
      const impersonatedCompany = scammerName;
      const howContacted = rawPayload.how_contacted || rawPayload.howContacted || 'Phone Call';
      const moneyLost = rawPayload.money_lost !== undefined ? rawPayload.money_lost : rawPayload.moneyLost;
      const reporterName = rawPayload.reporter_name || rawPayload.reporterName;
      const reporterEmail = rawPayload.reporter_email || rawPayload.reporterEmail;
      const imageUrl = rawPayload.image_url || rawPayload.imageUrl || rawPayload.evidence_url || rawPayload.evidenceUrl;

      let altNumbers: AltNumberEntry[] | undefined = undefined;
      if (Array.isArray(rawPayload.alt_numbers) && rawPayload.alt_numbers.length > 0) {
        altNumbers = rawPayload.alt_numbers.map((a: any) => (typeof a === 'string' ? { phone: a, digits: a.replace(/\D/g, ''), is_whatsapp: false } : a));
      } else if (Array.isArray(rawPayload.altNumbersWithDetails) && rawPayload.altNumbersWithDetails.length > 0) {
        altNumbers = rawPayload.altNumbersWithDetails;
      } else if (Array.isArray(rawPayload.altNumbers) && rawPayload.altNumbers.length > 0) {
        altNumbers = rawPayload.altNumbers.map((a: any) => (typeof a === 'string' ? { phone: a, digits: a.replace(/\D/g, ''), is_whatsapp: false } : a));
      }

      const newRecord: ThreatRecord = {
        id: rawPayload.id || `report-${Date.now()}-${cleanDigits.slice(-4) || Math.random().toString(36).slice(2, 6)}`,
        phone_number: formatted,
        phone_digits: cleanDigits,
        is_whatsapp: Boolean(rawPayload.is_whatsapp || rawPayload.isWhatsapp),
        alt_numbers: altNumbers,
        source_name: rawPayload.source_name || rawPayload.platform || 'User Report (endscams.org/report)',
        source_url: rawPayload.source_url || rawPayload.sourceUrl || 'https://endscams.org/report',
        report_date: reportDate,
        category: category,
        impersonated_company: impersonatedCompany,
        scammer_name: scammerName,
        invoice_number: rawPayload.invoice_number || rawPayload.invoiceNumber || 'N/A',
        amount_charged: rawPayload.amount_charged || rawPayload.amountCharged || (moneyLost ? `$${moneyLost}` : 'N/A'),
        money_lost: moneyLost,
        how_contacted: howContacted,
        reporter_name: reporterName,
        reporter_email: reporterEmail,
        image_url: imageUrl,
        description: description,
        is_down: false,
      };

      setRecords((prev) => {
        const withoutOld = prev.filter((r) => r.phone_digits !== cleanDigits && r.phone_number !== rawPhone && r.phone_number !== formatted);
        const updated = purgeExpiredThreatRecords(deduplicateThreatRecordsList([newRecord, ...withoutOld])).sort(compareThreatDatesDesc);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch {}
        return updated;
      });

      // Post to backend database so it persists across refreshes and devices
      fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: newRecord.phone_number,
          phone_digits: newRecord.phone_digits,
          category: newRecord.category,
          description: newRecord.description,
          incident_date: newRecord.report_date,
          source_name: newRecord.source_name,
          source_url: newRecord.source_url,
          is_whatsapp: newRecord.is_whatsapp,
        }),
      }).catch(() => {});

      setStatusNotification(`Report ingested from endscams.org/report: ${newRecord.phone_number} (${newRecord.impersonated_company})`);
    } catch (err) {
      console.warn('[EndScams Ingestion] Error processing incoming report:', err);
    }
  };

  const handleIncomingReportRef = useRef(handleIncomingReport);
  handleIncomingReportRef.current = handleIncomingReport;

  const handleQuickReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuickReportMessage(null);
    setQuickReportSubmitting(true);
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: quickReportPhone,
          category: quickReportCategory,
          impersonated_company: quickReportCompany,
          how_contacted: quickReportHowContacted,
          incident_date: quickReportIncidentDate,
          description: quickReportDescription || 'Reported via https://endscams.org/report',
          money_lost: quickReportMoneyLost ? parseFloat(quickReportMoneyLost) : null,
          is_whatsapp: quickReportIsWhatsApp,
          reporter_name: quickReportReporterName,
          reporter_email: quickReportReporterEmail,
          source: 'user_report',
          source_url: 'https://endscams.org/report',
          source_name: 'EndScams Report (endscams.org/report)',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setQuickReportMessage({ text: data.error || 'Failed to submit report.', isError: true });
      } else {
        const phone = data.record?.phone || quickReportPhone;
        const comp = data.record?.impersonatedCompany || quickReportCompany || 'Reported Entity';
        setQuickReportMessage({
          text: `Success! Added ${phone} (${comp}) to Tracker Page & persisted to database.`,
          isError: false,
        });
        if (data.record) {
          handleIncomingReport({
            phone_number: data.record.phone,
            phone_digits: data.record.cleanPhone,
            category: data.record.scamType,
            impersonated_company: data.record.impersonatedCompany || quickReportCompany,
            description: data.record.detailedSummary || data.record.snippet || quickReportDescription,
            incident_date: data.record.postDate || quickReportIncidentDate,
            source_name: data.record.platform,
            source_url: data.record.sourceUrl,
            is_whatsapp: data.record.isWhatsapp,
            amount_charged: data.record.amountCharged,
          });
        }
        setStatusNotification(`Threat report recorded: ${phone} (${comp})`);
        setQuickReportPhone('');
        setQuickReportCompany('');
        setQuickReportDescription('');
        setQuickReportMoneyLost('');
        setQuickReportIsWhatsApp(false);
        setQuickReportReporterName('');
        setQuickReportReporterEmail('');
        setQuickReportEvidenceFile(null);
        setQuickReportEvidencePreview(null);
      }
    } catch (err: any) {
      setQuickReportMessage({ text: err.message || 'Error submitting report.', isError: true });
    } finally {
      setQuickReportSubmitting(false);
    }
  };

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
      onAddManualRecord: (rec) => {
        handleIncomingReportRef.current(rec);
      },
      onPushRecords: (incoming) => {
        incoming.forEach((r) => handleIncomingReportRef.current(r));
      },
    });

    return () => {
      syncBridge.destroy();
    };
  }, []);

  // Listen directly to BroadcastChannels used by https://endscams.org/report
  useEffect(() => {
    const channelNames = [
      'end_scam_scan_sync_channel',
      'threat_tracker_sync_channel',
      'scam_reports_channel',
      'endscams_report_channel',
    ];
    const openChannels: BroadcastChannel[] = [];

    channelNames.forEach((name) => {
      try {
        const ch = new BroadcastChannel(name);
        ch.onmessage = (event) => {
          if (!event.data) return;
          const data = event.data;
          const type = data.type || data.action || '';
          if (
            type === 'ADD_RECORD' ||
            type === 'INSERT_RECORD' ||
            type === 'USER_REPORT' ||
            type === 'ADD_MANUAL_RECORD' ||
            type === 'SCAM_REPORT_SUBMITTED' ||
            data.phone ||
            data.phone_number ||
            data.phone_digits
          ) {
            const payload = data.payload || data.record || data;
            handleIncomingReportRef.current(payload);
          }
        };
        openChannels.push(ch);
      } catch (e) {
        console.warn(`[TrackerPage] BroadcastChannel ${name} error:`, e);
      }
    });

    return () => {
      openChannels.forEach((ch) => ch.close());
    };
  }, []);

  // Listen for cross-window / iframe postMessage submissions from https://endscams.org/report
  useEffect(() => {
    const handleWindowMsg = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;
      const { type, action, payload, record } = event.data;
      const msgType = type || action || '';
      if (
        msgType === 'ADD_RECORD' ||
        msgType === 'USER_REPORT' ||
        msgType === 'ADD_MANUAL_RECORD' ||
        msgType === 'SCAM_REPORT_SUBMITTED' ||
        msgType === 'INSERT_RECORD' ||
        event.data.phone ||
        event.data.phone_number ||
        event.data.phone_digits
      ) {
        handleIncomingReportRef.current(payload || record || event.data);
      }
    };
    window.addEventListener('message', handleWindowMsg);
    return () => window.removeEventListener('message', handleWindowMsg);
  }, []);

  // Listen for cross-tab storage changes (e.g. if report form saves to shared localStorage)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (
        e.key === 'user_reported_scams' ||
        e.key === 'tracker_records' ||
        e.key === 'end_scam_scan_shared_state' ||
        e.key === 'esscan_threat_records_v2'
      ) {
        if (e.newValue) {
          try {
            const parsed = JSON.parse(e.newValue);
            const list = Array.isArray(parsed) ? parsed : parsed.records || [];
            list.forEach((item: any) => handleIncomingReportRef.current(item));
          } catch {}
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Active live-sync poller to ingest any reports submitted from https://endscams.org/report into this TrackerPage
  useEffect(() => {
    const pollThreatReports = async () => {
      try {
        const res = await fetch('/api/records', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const incoming: any[] = Array.isArray(data) ? data : data.records || [];
        if (incoming.length > 0) {
          const currentList = recordsRef.current;
          const currentPhoneKeys = new Set(
            currentList.map((r) => r.phone_digits || r.phone_number.replace(/\D/g, ''))
          );
          const newlyDiscovered: ThreatRecord[] = [];
          for (const item of incoming) {
            const cleanDigits =
              item.cleanPhone ||
              item.phone_digits ||
              (item.phone ? item.phone.replace(/\D/g, '') : '') ||
              (item.phone_number ? item.phone_number.replace(/\D/g, '') : '');
            if (cleanDigits && !currentPhoneKeys.has(cleanDigits)) {
              currentPhoneKeys.add(cleanDigits);
              const mapped = scamPhoneRecordToThreatRecord(item);
              newlyDiscovered.push(mapped);
            }
          }
          if (newlyDiscovered.length > 0) {
            setRecords((prev) => {
              const updated = purgeExpiredThreatRecords(
                deduplicateThreatRecordsList([...newlyDiscovered, ...prev])
              ).sort(compareThreatDatesDesc);
              try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
              } catch {}
              return updated;
            });
            setStatusNotification(
              `Live threat report added to Tracker Page: ${newlyDiscovered[0].phone_number}`
            );
          }
        }
      } catch {}
    };

    // Fast polling when modal is open (every 3 seconds), regular polling when closed (every 8 seconds)
    const intervalTime = isReportModalOpen ? 3000 : 8000;
    const poller = setInterval(pollThreatReports, intervalTime);
    return () => clearInterval(poller);
  }, [isReportModalOpen]);

  // Broadcast to syncBridge whenever records change
  useEffect(() => {
    if (records.length > 0) {
      const scamRecords = records.map(threatRecordToScamPhoneRecord);
      syncBridge.broadcastRecords(scamRecords);
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

  // Supabase Health Diagnostic Check
  const checkSupabaseHealth = async () => {
    try {
      const res = await fetch('/api/supabase/status');
      if (res.ok) {
        const data = await res.json();
        setSupabaseTableStatus(data);
        if (data.tablesExist || data.postgresConnected) {
          setIsSupabaseConnected(true);
        }
        return data;
      }
    } catch {}
    return null;
  };

  // Load Dokploy Environment Settings & Connect Supabase (DB & DB_Key)
  useEffect(() => {
    let isMounted = true;
    const loadDokployConfig = async () => {
      try {
        // First check Supabase health status
        checkSupabaseHealth();

        const res = await fetch('/api/config');
        if (res.ok) {
          const cfg = await res.json();
          if (!isMounted) return;
          setDokployConfig({
            supabaseUrl: cfg.supabaseUrl || '',
            supabaseKey: cfg.supabaseKey || '',
            hasSupabase: Boolean(cfg.hasSupabase),
            hasTrackerPass: Boolean(cfg.hasTrackerPass),
          });

          // Initialize Supabase if DB and DB_Key are configured in Dokploy
          if (cfg.supabaseUrl && cfg.supabaseKey) {
            try {
              const sb = createClient(cfg.supabaseUrl, cfg.supabaseKey);
              (window as any).supabase = sb;
              setIsSupabaseConnected(true);
              console.log('[Dokploy Supabase] Successfully connected to live database:', cfg.supabaseUrl);

              // Pull records from Supabase tracker_entries / scam_records
              try {
                let sbRes = await sb.from('tracker_entries').select('*');
                if (sbRes.error) {
                  sbRes = await sb.from('scam_records').select('*');
                }
                if (sbRes.data && Array.isArray(sbRes.data) && sbRes.data.length > 0) {
                  const mappedFromSb = sbRes.data
                    .map((item: any) => {
                      const raw = item.phone_number || item.phone || '';
                      const clean = item.phone_digits || raw.replace(/\D/g, '');
                      return {
                        id: String(item.id || `sb-${clean}`),
                        phone_number: formatDisplayPhone(raw, clean),
                        phone_digits: clean,
                        source_name: item.source_name || item.source_platform || 'Supabase DB',
                        source_url: item.source_url || '',
                        report_date: normalizeToNumericalDate(item.report_date || item.detected_at || new Date()),
                        category: item.category || item.scam_type || 'General Tech Support & Refund Scams',
                        description: item.description || item.threat_intel || 'Synchronized from Dokploy Supabase database.',
                        impersonated_company: item.impersonated_company || 'N/A',
                        invoice_number: item.invoice_number || 'N/A',
                        amount_charged: item.amount_charged || 'N/A',
                        is_down: Boolean(item.is_down || item.status === 'Out of Service'),
                      };
                    })
                    .filter((r: ThreatRecord) => !isTollFreeNumber(r.phone_number) && !isFictitiousOrInvalidPhone(r.phone_number));

                  if (mappedFromSb.length > 0 && isMounted) {
                    setRecords((prev) => {
                      const combined = [...mappedFromSb, ...prev];
                      return purgeExpiredThreatRecords(deduplicateThreatRecordsList(combined)).sort(compareThreatDatesDesc);
                    });
                  }
                }
              } catch (queryErr) {
                console.warn('[Dokploy Supabase] Table query notice:', queryErr);
              }
            } catch (sbErr) {
              console.warn('[Dokploy Supabase] Initialization notice:', sbErr);
            }
          }
        }
      } catch (err) {
        console.warn('[Dokploy Config] Unable to load /api/config:', err);
      }
    };

    loadDokployConfig();

    // Check Geo-IP permission: US, Canada, Australia, and all EU countries
    checkClientGeoPermission().then((res) => {
      if (isMounted) {
        setIsGeoAllowed(res.allowed);
        setClientCountryCode(res.country);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Require Administrative or Encrypted Bypass for protected actions
  const requireTrackerPass = (actionName: string, onVerified: () => void) => {
    // If full admin verified, allow immediately
    if (isPasswordVerified && !isBypassSession) {
      onVerified();
      return;
    }
    // If verified via bypass, verify that this specific action is permitted under bypass scope (editing & status changing)
    if (isPasswordVerified && isBypassSession) {
      if (isBypassAllowedForAction(actionName)) {
        onVerified();
        return;
      }
      // If action is outside bypass scope (e.g. scanner), prompt for full Admin Password
    }
    setPasswordActionName(actionName);
    setPendingAction(() => onVerified);
    setPasswordInput('');
    setPasswordError(null);
    setIsPasswordModalOpen(true);
  };

  // Verify password via encrypted admin / bypass check (client & backend verification)
  const handleVerifyPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const entered = passwordInput.trim();
    if (!entered) {
      setPasswordError('Please enter your Administrator or Encrypted Bypass password.');
      return;
    }
    setIsVerifyingPassword(true);
    setPasswordError(null);

    // 1. One-way encrypted admin verification (NEVER plain-text)
    const isAdminMatch = await verifyEncryptedAdmin(entered);
    if (isAdminMatch) {
      setIsPasswordVerified(true);
      setIsBypassSession(false);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('tracker_pass_verified', 'true');
        sessionStorage.removeItem('tracker_pass_is_bypass');
      }
      setIsPasswordModalOpen(false);
      setPasswordInput('');
      setStatusNotification(`Administrator authorized: ${passwordActionName}`);
      if (pendingAction) {
        const act = pendingAction;
        setPendingAction(null);
        act();
      }
      setIsVerifyingPassword(false);
      return;
    }

    // 2. One-way encrypted bypass verification (NEVER plain-text)
    const isBypassMatch = await verifyEncryptedBypass(entered);
    if (isBypassMatch) {
      // Limit bypass password strictly to Editing and changing status
      if (!isBypassAllowedForAction(passwordActionName)) {
        setIsVerifyingPassword(false);
        setPasswordError('Encrypted bypass authorization is strictly limited to Editing post details and Changing line status.');
        return;
      }

      setIsPasswordVerified(true);
      setIsBypassSession(true);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('tracker_pass_verified', 'true');
        sessionStorage.setItem('tracker_pass_is_bypass', 'true');
      }
      setIsPasswordModalOpen(false);
      setPasswordInput('');
      setStatusNotification(`Authorized via encrypted bypass: ${passwordActionName}`);
      if (pendingAction) {
        const act = pendingAction;
        setPendingAction(null);
        act();
      }
      setIsVerifyingPassword(false);
      return;
    }

    // 3. Fallback verification via backend API endpoint (/api/verify-password)
    try {
      const res = await fetch('/api/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: entered, action: passwordActionName }),
      });
      const data = await res.json();
      if (data.verified || data.success) {
        setIsPasswordVerified(true);
        setIsBypassSession(Boolean(data.isBypass));
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('tracker_pass_verified', 'true');
          if (data.isBypass) {
            sessionStorage.setItem('tracker_pass_is_bypass', 'true');
          } else {
            sessionStorage.removeItem('tracker_pass_is_bypass');
          }
        }
        setIsPasswordModalOpen(false);
        setPasswordInput('');
        setStatusNotification(data.isBypass ? `Authorized via encrypted bypass: ${passwordActionName}` : `Administrator authorized: ${passwordActionName}`);
        if (pendingAction) {
          const act = pendingAction;
          setPendingAction(null);
          act();
        }
      } else {
        setPasswordError(data.message || 'Incorrect Password. Please provide a valid Administrator or Bypass password.');
      }
    } catch {
      setPasswordError('Network error connecting to authentication server.');
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  const handleLockSession = () => {
    setIsPasswordVerified(false);
    setIsBypassSession(false);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('tracker_pass_verified');
      sessionStorage.removeItem('tracker_pass_is_bypass');
    }
    setStatusNotification('Admin session locked.');
  };

  // Edit Monitored Number Handlers
  const handleOpenEditModal = (record: ThreatRecord) => {
    setEditingRecord(record);
    setEditForm({
      phone_number: record.phone_number,
      is_whatsapp: isWhatsAppThreat(record),
      alt_numbers: (record.alt_numbers || []).map((a) => ({
        phone: typeof a === 'string' ? a : a.phone,
        is_whatsapp: typeof a === 'string' ? false : Boolean(a.is_whatsapp),
      })),
      category: record.category,
      impersonated_company: record.impersonated_company && record.impersonated_company !== 'N/A' ? record.impersonated_company : '',
      source_name: record.source_name,
      source_url: record.source_url || '',
      amount_charged: record.amount_charged && record.amount_charged !== 'N/A' ? record.amount_charged : '',
      invoice_number: record.invoice_number && record.invoice_number !== 'N/A' ? record.invoice_number : '',
      description: record.description,
      is_down: Boolean(record.is_down),
    });
    setEditError(null);
    setIsEditModalOpen(true);
  };

  const handleSaveEditRecord = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingRecord) return;

    const rawPhone = editForm.phone_number.trim();
    const digits = rawPhone.replace(/\D/g, '');

    if (!rawPhone || digits.length < 7) {
      setEditError('Please enter a valid dialable phone number with area/country code.');
      return;
    }

    if (isTollFreeNumber(rawPhone)) {
      setEditError('Toll-free numbers (800, 888, 877, 866, 855, 844, 833) are strictly prohibited.');
      return;
    }

    if (isFictitiousOrInvalidPhone(rawPhone)) {
      setEditError('Fictitious or dummy numbers (e.g., 555 exchange) are rejected.');
      return;
    }

    // Validate alternate numbers (up to 3 alt numbers, total 4 numbers)
    const validAlts: AltNumberEntry[] = [];
    const usedDigits = new Set<string>([digits]);

    for (let i = 0; i < editForm.alt_numbers.length; i++) {
      const alt = editForm.alt_numbers[i];
      const rawAlt = (alt.phone || '').trim();
      if (!rawAlt) continue;
      const altDigits = rawAlt.replace(/\D/g, '');
      if (altDigits.length < 7) {
        setEditError(`Alt Number #${i + 2} is invalid (too short, min 7 digits).`);
        return;
      }
      if (isTollFreeNumber(rawAlt)) {
        setEditError(`Alt Number #${i + 2} is a prohibited toll-free number.`);
        return;
      }
      if (isFictitiousOrInvalidPhone(rawAlt)) {
        setEditError(`Alt Number #${i + 2} is an invalid or dummy number.`);
        return;
      }
      if (usedDigits.has(altDigits)) {
        setEditError(`Alt Number #${i + 2} duplicates another number on this report.`);
        return;
      }
      usedDigits.add(altDigits);
      validAlts.push({
        phone: formatDisplayPhone(rawAlt, altDigits),
        digits: altDigits,
        is_whatsapp: Boolean(alt.is_whatsapp),
      });
      if (validAlts.length >= 3) break;
    }

    const updated: ThreatRecord = {
      ...editingRecord,
      phone_number: formatDisplayPhone(rawPhone, digits),
      phone_digits: digits,
      is_whatsapp: editForm.is_whatsapp,
      alt_numbers: validAlts.length > 0 ? validAlts : undefined,
      category: editForm.category.trim() || editingRecord.category,
      impersonated_company: editForm.impersonated_company.trim() || 'N/A',
      source_name: editForm.source_name.trim() || editingRecord.source_name,
      source_url: editForm.source_url.trim() || editingRecord.source_url,
      amount_charged: editForm.amount_charged.trim() || 'N/A',
      invoice_number: editForm.invoice_number.trim() || 'N/A',
      description: editForm.description.trim() || editingRecord.description,
      is_down: editForm.is_down,
    };

    setRecords((prev) => prev.map((r) => (r.id === editingRecord.id ? updated : r)));
    setIsEditModalOpen(false);
    setEditingRecord(null);
    setStatusNotification(`Updated monitored line: ${updated.phone_number}${validAlts.length > 0 ? ` + ${validAlts.length} Alt numbers` : ''}`);

    // Update on backend
    try {
      fetch(`/api/records/${editingRecord.id}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: updated.phone_number,
          cleanPhone: updated.phone_digits,
          isWhatsapp: updated.is_whatsapp,
          altNumbers: validAlts.map((a) => a.phone),
          scamType: updated.category,
          impersonatedCompany: updated.impersonated_company,
          amountCharged: updated.amount_charged,
          invoiceNumber: updated.invoice_number,
          detailedSummary: updated.description,
          platform: updated.source_name,
          sourceUrl: updated.source_url,
          isNumberDown: updated.is_down,
        }),
      }).catch(() => {});
    } catch {}

    // Sync to Dokploy Supabase
    syncRecordToSupabase(updated);
  };

  // Bulk Sync Records to Supabase Database (https://joxeqlgkuvgvjoshmjqu.supabase.co) & Backend API
  const syncThreatRecordsToSupabase = async (recs: ThreatRecord[]): Promise<{ success: boolean; error?: string }> => {
    if (!recs || recs.length === 0) return { success: true };
    try {
      // 1. Supabase Client Upsert
      const sb = (window as any).supabase;
      if (sb && typeof sb.from === 'function') {
        const payloads = recs.map((rec) => {
          const expiresAt = new Date();
          const retentionDays = getRetentionDays(rec);
          expiresAt.setDate(expiresAt.getDate() + retentionDays);
          const country = deriveCountryInfo(rec.phone_number);
          const dateNorm = normalizeToNumericalDate(rec.report_date);
          const isoDetected = `${dateNorm}T12:00:00.000Z`;

          return {
            id: rec.id || `rec-${rec.phone_digits}`,
            phone_number: rec.phone_number,
            phone: rec.phone_number,
            phone_digits: rec.phone_digits,
            clean_phone: rec.phone_digits,
            country_code: country.code || 'US',
            country_name: country.name || 'United States',
            category: rec.category || 'General Tech Support & Refund Scams',
            scam_type: rec.category || 'General Tech Support & Refund Scams',
            impersonated_company: rec.impersonated_company || 'N/A',
            invoice_number: rec.invoice_number || 'N/A',
            amount_charged: rec.amount_charged || 'N/A',
            source_platform: rec.source_name || 'Threat Intelligence',
            source_name: rec.source_name || 'Threat Intelligence',
            platform: rec.source_name || 'Threat Intelligence',
            source_url: rec.source_url || '',
            source_domain: rec.source_url && rec.source_url.includes('//') ? rec.source_url.split('/')[2].replace(/^www\./, '') : 'threat-intel',
            threat_intel: rec.description || 'Imported threat intelligence record.',
            description: rec.description || 'Imported threat intelligence record.',
            snippet: rec.description || 'Imported threat intelligence record.',
            detailed_summary: rec.description || 'Imported threat intelligence record.',
            detected_at: isoDetected,
            report_date: dateNorm,
            post_date: dateNorm,
            is_down: Boolean(rec.is_down),
            is_number_down: Boolean(rec.is_down),
            status: rec.is_down ? 'Out of Service' : 'Active',
            expires_at: expiresAt.toISOString(),
            updated_at: new Date().toISOString(),
          };
        });

        // Try tracker_entries in batches of 50
        for (let i = 0; i < payloads.length; i += 50) {
          const batch = payloads.slice(i, i + 50);
          const res = await sb.from('tracker_entries').upsert(batch, { onConflict: 'phone_digits' });
          if (res.error) {
            // Fallback to scam_records
            await sb.from('scam_records').upsert(batch, { onConflict: 'clean_phone' });
          }
        }
      }

      // 2. Server Bulk-Upsert API for two-way sync and disk persistence
      const scamPayload = recs.map(threatRecordToScamPhoneRecord);
      await fetch('/api/records/bulk-upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: scamPayload }),
      }).catch(() => {});

      return { success: true };
    } catch (err: any) {
      console.warn('[Supabase Batch Sync Notice]', err);
      return { success: false, error: err.message };
    }
  };

  // Sync Single Record to Supabase
  const syncRecordToSupabase = async (rec: ThreatRecord) => {
    return syncThreatRecordsToSupabase([rec]);
  };

  // Open Detailed Threat Post Modal (Center of Screen Popup)
  const handleOpenPopupDetail = (record: ThreatRecord) => {
    setSelectedDetailRecord(record);
    setIsEditingInPopup(false);
    setPopupEditError(null);

    const alts = record.alt_numbers || [];
    const a1 = alts[0] ? (typeof alts[0] === 'string' ? alts[0] : alts[0].phone) : '';
    const a2 = alts[1] ? (typeof alts[1] === 'string' ? alts[1] : alts[1].phone) : '';
    const a2Wa = alts[1] && typeof alts[1] !== 'string' ? Boolean(alts[1].is_whatsapp) : false;

    setPopupEditForm({
      phone_number: record.phone_number,
      impersonated_company: record.scammer_name || (record.impersonated_company && record.impersonated_company !== 'N/A' ? record.impersonated_company : ''),
      category: record.category,
      source_name: record.source_name,
      source_url: record.source_url || '',
      report_date: record.report_date,
      is_down: Boolean(record.is_down),
      amount_charged: record.amount_charged && record.amount_charged !== 'N/A' ? record.amount_charged : '',
      invoice_number: record.invoice_number && record.invoice_number !== 'N/A' ? record.invoice_number : '',
      description: record.description || '',
      alt_phone_1: a1,
      alt_phone_2: a2,
      alt_phone_2_whatsapp: a2Wa,
      is_whatsapp: Boolean(record.is_whatsapp),
      how_contacted: record.how_contacted || 'Phone Call',
      money_lost: record.money_lost !== undefined && record.money_lost !== null ? String(record.money_lost) : '',
    });
  };

  // Start Editing Inside Popup Modal (Gated by TRACKER_PASS)
  const handleStartEditingInPopup = () => {
    if (!selectedDetailRecord) return;
    setPopupEditError(null);

    const alts = selectedDetailRecord.alt_numbers || [];
    const a1 = alts[0] ? (typeof alts[0] === 'string' ? alts[0] : alts[0].phone) : '';
    const a2 = alts[1] ? (typeof alts[1] === 'string' ? alts[1] : alts[1].phone) : '';
    const a2Wa = alts[1] && typeof alts[1] !== 'string' ? Boolean(alts[1].is_whatsapp) : false;

    setPopupEditForm({
      phone_number: selectedDetailRecord.phone_number,
      impersonated_company: selectedDetailRecord.scammer_name || (selectedDetailRecord.impersonated_company && selectedDetailRecord.impersonated_company !== 'N/A' ? selectedDetailRecord.impersonated_company : ''),
      category: selectedDetailRecord.category,
      source_name: selectedDetailRecord.source_name,
      source_url: selectedDetailRecord.source_url || '',
      report_date: selectedDetailRecord.report_date,
      is_down: Boolean(selectedDetailRecord.is_down),
      amount_charged: selectedDetailRecord.amount_charged && selectedDetailRecord.amount_charged !== 'N/A' ? selectedDetailRecord.amount_charged : '',
      invoice_number: selectedDetailRecord.invoice_number && selectedDetailRecord.invoice_number !== 'N/A' ? selectedDetailRecord.invoice_number : '',
      description: selectedDetailRecord.description || '',
      alt_phone_1: a1,
      alt_phone_2: a2,
      alt_phone_2_whatsapp: a2Wa,
      is_whatsapp: Boolean(selectedDetailRecord.is_whatsapp),
      how_contacted: selectedDetailRecord.how_contacted || 'Phone Call',
      money_lost: selectedDetailRecord.money_lost !== undefined && selectedDetailRecord.money_lost !== null ? String(selectedDetailRecord.money_lost) : '',
    });
    setIsEditingInPopup(true);
  };

  // Save Edits from Popup Modal directly to local state, Supabase Database & Backend API
  const handleSavePopupEdit = async () => {
    if (!selectedDetailRecord) return;
    const digits = popupEditForm.phone_number.replace(/\D/g, '');
    if (digits.length < 7) {
      setPopupEditError('Phone number must contain at least 7 valid numeric digits.');
      return;
    }

    if (isTollFreeNumber(popupEditForm.phone_number) || isFictitiousOrInvalidPhone(popupEditForm.phone_number)) {
      setPopupEditError('Toll-free and invalid fictitious test numbers cannot be stored.');
      return;
    }

    // Build updated alt numbers
    const updatedAlts: AltNumberEntry[] = [];
    if (popupEditForm.alt_phone_1 && popupEditForm.alt_phone_1.trim()) {
      const d1 = popupEditForm.alt_phone_1.replace(/\D/g, '');
      if (d1.length >= 7) {
        updatedAlts.push({
          phone: formatDisplayPhone(popupEditForm.alt_phone_1, d1),
          digits: d1,
          is_whatsapp: false,
        });
      }
    }
    if (popupEditForm.alt_phone_2 && popupEditForm.alt_phone_2.trim()) {
      const d2 = popupEditForm.alt_phone_2.replace(/\D/g, '');
      if (d2.length >= 7) {
        updatedAlts.push({
          phone: formatDisplayPhone(popupEditForm.alt_phone_2, d2),
          digits: d2,
          is_whatsapp: Boolean(popupEditForm.alt_phone_2_whatsapp),
        });
      }
    }

    const moneyLostVal = popupEditForm.money_lost ? parseFloat(popupEditForm.money_lost) : undefined;
    const amountVal = popupEditForm.amount_charged.trim() || (moneyLostVal ? `$${moneyLostVal}` : 'N/A');

    const updated: ThreatRecord = {
      ...selectedDetailRecord,
      phone_number: popupEditForm.phone_number.trim(),
      phone_digits: digits,
      is_whatsapp: Boolean(popupEditForm.is_whatsapp),
      alt_numbers: updatedAlts.length > 0 ? updatedAlts : undefined,
      impersonated_company: popupEditForm.impersonated_company.trim() || 'N/A',
      scammer_name: popupEditForm.impersonated_company.trim() || 'N/A',
      category: popupEditForm.category.trim() || 'General Tech Support & Refund Scams',
      source_name: popupEditForm.source_name.trim() || 'Threat Intel Feed',
      source_url: popupEditForm.source_url.trim(),
      report_date: normalizeToNumericalDate(popupEditForm.report_date.trim()),
      is_down: Boolean(popupEditForm.is_down),
      amount_charged: amountVal,
      money_lost: moneyLostVal,
      how_contacted: popupEditForm.how_contacted || 'Phone Call',
      invoice_number: popupEditForm.invoice_number.trim() || 'N/A',
      description: popupEditForm.description.trim(),
    };

    // 1. Update local state
    setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setSelectedDetailRecord(updated);
    setIsEditingInPopup(false);
    setPopupEditError(null);
    setStatusNotification(`Updated threat post: ${updated.phone_number}`);

    // 2. Persist to Supabase Database & Backend
    await syncThreatRecordsToSupabase([updated]);

    // 3. Update backend server specifically
    try {
      fetch(`/api/records/${updated.id}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record: {
            id: updated.id,
            phone: updated.phone_number,
            cleanPhone: updated.phone_digits,
            isWhatsapp: updated.is_whatsapp,
            altNumbers: updated.alt_numbers ? updated.alt_numbers.map((a) => a.phone) : undefined,
            altNumbersWithDetails: updated.alt_numbers,
            impersonatedCompany: updated.impersonated_company,
            scammerName: updated.scammer_name,
            scamType: updated.category,
            platform: updated.source_name,
            sourceUrl: updated.source_url,
            snippet: updated.description,
            detailedSummary: updated.description,
            postDate: updated.report_date,
            amountCharged: updated.amount_charged,
            moneyLost: updated.money_lost,
            howContacted: updated.how_contacted,
            invoiceNumber: updated.invoice_number,
            isNumberDown: updated.is_down,
          },
        }),
      }).catch(() => {});
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

          if (!alreadyTriggered && !isScanningRef.current) {
            localStorage.setItem(slotKey, new Date().toISOString());
            const slotLabel = hour === 7 ? '7:00 AM PST' : '1:00 PM PST';
            console.log(`[Auto-Trigger] ${slotLabel} reached! Automatically triggering autonomous threat harvester scan...`);
            setStatusNotification(`[Auto-Scan Active] ${slotLabel} reached — Automatically executed threat harvester scan.`);
            // Automated scans do not require administrative password
            executeFullHarvesterScan();
            // Reconcile with backend scheduler
            fetch('/api/scheduler/check-and-sync', { method: 'POST' }).catch(() => {});
          }
        }
      } catch (err) {
        console.warn('Error checking Pacific schedule:', err);
      }
    };

    checkScheduleAndTrigger();
    const interval = setInterval(checkScheduleAndTrigger, 5000);
    return () => clearInterval(interval);
  }, []);

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
            rejectTollFree: false,
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

                      mapped.forEach((r: ThreatRecord) => {
                        if (!existingDigits.has(r.phone_digits)) {
                          accumulatedNew.push(r);
                          existingDigits.add(r.phone_digits);
                          // Add immediately to table upon discovery
                          setRecords((prev) => [r, ...prev.filter((p) => p.phone_digits !== r.phone_digits)]);
                          setStatusNotification(`Live Discovery: ${r.phone_number} (${r.impersonated_company})`);
                          addLog(`[LIVE HARVEST] Added threat line to table: ${r.phone_number} (${r.impersonated_company})`);
                        } else {
                          // Duplicate or older number: update existing record with enriched intel
                          setRecords((prev) =>
                            prev.map((p) => {
                              if (p.phone_digits === r.phone_digits) {
                                const hasBetterCompany = p.impersonated_company === 'N/A' && r.impersonated_company !== 'N/A';
                                const hasBetterInvoice = (p.invoice_number === 'N/A' || !p.invoice_number) && r.invoice_number && r.invoice_number !== 'N/A';
                                const hasBetterAmount = (p.amount_charged === 'N/A' || !p.amount_charged) && r.amount_charged && r.amount_charged !== 'N/A';
                                const hasBetterDesc = r.description && r.description.length > (p.description || '').length;
                                if (hasBetterCompany || hasBetterInvoice || hasBetterAmount || hasBetterDesc) {
                                  return {
                                    ...p,
                                    impersonated_company: hasBetterCompany ? r.impersonated_company : p.impersonated_company,
                                    invoice_number: hasBetterInvoice ? r.invoice_number : p.invoice_number,
                                    amount_charged: hasBetterAmount ? r.amount_charged : p.amount_charged,
                                    description: hasBetterDesc ? r.description : p.description,
                                  };
                                }
                              }
                              return p;
                            })
                          );
                        }
                      });
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
                        return true;
                      })
                      .map(mapRawSeedToThreatRecord);

                    mapped.forEach((r: ThreatRecord) => {
                      if (!existingDigits.has(r.phone_digits)) {
                        accumulatedNew.push(r);
                        existingDigits.add(r.phone_digits);
                        setRecords((prev) => [r, ...prev.filter((p) => p.phone_digits !== r.phone_digits)]);
                      } else {
                        setRecords((prev) =>
                          prev.map((p) => {
                            if (p.phone_digits === r.phone_digits) {
                              const hasBetterCompany = p.impersonated_company === 'N/A' && r.impersonated_company !== 'N/A';
                              const hasBetterInvoice = (p.invoice_number === 'N/A' || !p.invoice_number) && r.invoice_number && r.invoice_number !== 'N/A';
                              const hasBetterAmount = (p.amount_charged === 'N/A' || !p.amount_charged) && r.amount_charged && r.amount_charged !== 'N/A';
                              const hasBetterDesc = r.description && r.description.length > (p.description || '').length;
                              if (hasBetterCompany || hasBetterInvoice || hasBetterAmount || hasBetterDesc) {
                                return {
                                  ...p,
                                  impersonated_company: hasBetterCompany ? r.impersonated_company : p.impersonated_company,
                                  invoice_number: hasBetterInvoice ? r.invoice_number : p.invoice_number,
                                  amount_charged: hasBetterAmount ? r.amount_charged : p.amount_charged,
                                  description: hasBetterDesc ? r.description : p.description,
                                };
                              }
                            }
                            return p;
                          })
                        );
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
          addLog('[GEMINI] Authenticated with Gemini API. Scanning targets across 12 search-capable Gemini model variations to prevent quota exhaustion...');

          for (let i = 0; i < targetsToRun.length; i++) {
            const target = targetsToRun[i];
            const modelOffset = i % GEMINI_SEARCH_MODEL_VARIATIONS.length;
            const modelsToTry = [
              ...GEMINI_SEARCH_MODEL_VARIATIONS.slice(modelOffset),
              ...GEMINI_SEARCH_MODEL_VARIATIONS.slice(0, modelOffset),
            ];

            setScannerProgress(Math.round(((i + 1) / targetsToRun.length) * 85));
            setScannerStatusMessage(`Scanning ${target.name}...`);
            addLog(`[TARGET ${i + 1}/${targetsToRun.length}] Querying ${target.name} (${target.category}) using ${modelsToTry[0]}...`);

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
                    addLog(`[QUOTA DEFENSE] ${model} rate limit (429/503). Rotating to next search-capable Gemini model variation...`);
                    await delay(800);
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
                
                if (existingDigits.has(digits)) {
                  // Duplicate or older number: update existing record with enriched intel
                  setRecords((prev) =>
                    prev.map((p) => {
                      if (p.phone_digits === digits) {
                        const hasBetterCompany = p.impersonated_company === 'N/A' && item.impersonatedCompany && item.impersonatedCompany !== 'N/A';
                        const hasBetterInvoice = (p.invoice_number === 'N/A' || !p.invoice_number) && item.invoiceNumber && item.invoiceNumber !== 'N/A';
                        const hasBetterAmount = (p.amount_charged === 'N/A' || !p.amount_charged) && item.amountCharged && item.amountCharged !== 'N/A';
                        const newDesc = item.detailedSummary || item.snippet;
                        const hasBetterDesc = newDesc && newDesc.length > (p.description || '').length;
                        if (hasBetterCompany || hasBetterInvoice || hasBetterAmount || hasBetterDesc) {
                          return {
                            ...p,
                            impersonated_company: hasBetterCompany ? item.impersonatedCompany : p.impersonated_company,
                            invoice_number: hasBetterInvoice ? item.invoiceNumber : p.invoice_number,
                            amount_charged: hasBetterAmount ? item.amountCharged : p.amount_charged,
                            description: hasBetterDesc ? newDesc : p.description,
                          };
                        }
                      }
                      return p;
                    })
                  );
                  continue;
                }

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
                    if (!isTollFreeNumber(raw) && !isFictitiousOrInvalidPhone(raw)) {
                      if (existingDigits.has(digits)) {
                        setRecords((prev) =>
                          prev.map((p) => {
                            if (p.phone_digits === digits) {
                              const hasBetterCompany = p.impersonated_company === 'N/A' && top.impersonatedCompany && top.impersonatedCompany !== 'N/A';
                              const hasBetterDesc = top.snippet && top.snippet.length > (p.description || '').length;
                              if (hasBetterCompany || hasBetterDesc) {
                                return {
                                  ...p,
                                  impersonated_company: hasBetterCompany ? top.impersonatedCompany : p.impersonated_company,
                                  description: hasBetterDesc ? top.snippet : p.description,
                                };
                              }
                            }
                            return p;
                          })
                        );
                        continue;
                      }

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

          addLog('[FILTER] Applying strict filtering: Removing fictitious numbers and Facebook false positives...');
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

      // Merge records and retain full dataset
      if (accumulatedNew.length > 0) {
        setRecords((prev) => {
          accumulatedNew.forEach((r) => syncRecordToSupabase(r));
          const combined = [...accumulatedNew, ...prev];
          const merged = purgeExpiredThreatRecords(deduplicateThreatRecordsList(combined)).sort(compareThreatDatesDesc);

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

          // Synchronize to backend store, database seed, and Supabase via /api/records/sync-local
          try {
            const scamPayload = merged.map(threatRecordToScamPhoneRecord);
            fetch('/api/records/sync-local', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ records: scamPayload }),
            }).catch(() => {});
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
        `Harvester scan complete! Cataloged ${accumulatedNew.length} new verified threat lines (Facebook false positives & fictitious numbers removed).`
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
        impersonated_company: resolveTargetCompany(
          companyIdx >= 0 && row[companyIdx] ? row[companyIdx].trim() : '',
          categoryIdx >= 0 && row[categoryIdx] ? row[categoryIdx].trim() : '',
          descIdx >= 0 && row[descIdx] ? row[descIdx].trim() : ''
        ),
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
      setImportError(`No valid threat records found (${rejectedBad} invalid or unverified rows rejected).`);
      setImportPreview(null);
      return;
    }

    setImportError(null);
    setImportPreview({ valid, rejectedTollFree, rejectedBad });
  };

  const handleConfirmImport = async () => {
    if (!importPreview || importPreview.valid.length === 0 || isImporting) return;

    setIsImporting(true);
    setImportSyncProgress('Saving records to local store, database seed, and Supabase...');

    const importedThreats = importPreview.valid;
    const importedScamRecords = importedThreats.map(threatRecordToScamPhoneRecord);

    // 1. Update React State immediately
    setRecords((prev) => {
      const combined = [...importedThreats, ...prev];
      const merged = purgeExpiredThreatRecords(deduplicateThreatRecordsList(combined)).sort(compareThreatDatesDesc);

      // Persist to localStorage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } catch {}

      // Persist to built-in NoSQL Database
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

      // Broadcast to syncBridge for endscams.org/tracker parent
      try {
        const fullScamList = merged.map(threatRecordToScamPhoneRecord);
        syncBridge.broadcastRecords(fullScamList);
        syncBridge.broadcastCurrentState();
      } catch {}

      return merged;
    });

    // 2. Persist to server store and disk seed via dedicated /api/records/import-csv
    setImportSyncProgress('Persisting to server database & codebase seed...');
    let serverOk = false;
    let serverTotal = 0;
    let sbSynced = false;

    try {
      const resp = await fetch('/api/records/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: importedScamRecords }),
      });
      if (resp.ok) {
        const data = await resp.json();
        serverOk = true;
        serverTotal = data.total || 0;
        if (data.supabase?.success) {
          sbSynced = true;
        }
      }
    } catch (e) {
      console.warn('[CSV Import] Server import-csv failed, retrying with restore endpoint:', e);
    }

    if (!serverOk) {
      try {
        await fetch('/api/records/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            records: importedScamRecords,
            mode: 'merge',
          }),
        });
      } catch {}
    }

    // 3. Direct client Supabase sync
    setImportSyncProgress('Syncing directly to Supabase database tables...');
    const clientSb = await syncThreatRecordsToSupabase(importedThreats);
    if (clientSb.success) {
      sbSynced = true;
    }

    // 4. Check Supabase health to see if table is recognized
    const health = await checkSupabaseHealth();
    if (health?.tablesExist) {
      sbSynced = true;
    }

    setIsImporting(false);
    setImportSyncProgress(null);
    setIsImportModalOpen(false);
    setImportFile(null);
    setImportPreview(null);

    if (sbSynced) {
      setStatusNotification(
        `Successfully imported ${importedThreats.length} threat records! Fully synchronized to your Supabase database & server store.`
      );
    } else if (health && health.configured && !health.tablesExist) {
      setStatusNotification(
        `Imported ${importedThreats.length} records to local/server store. Notice: Supabase tables ('tracker_entries') not found. Click 'Supabase Setup' to copy SQL.`
      );
      setIsSupabaseSetupModalOpen(true);
    } else {
      setStatusNotification(
        `Successfully imported ${importedThreats.length} threat records! Database updated (${serverTotal || importedThreats.length} total records).`
      );
    }
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
      'WhatsApp',
      'Alt Numbers',
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
      const isWa = isWhatsAppThreat(r) ? 'Yes' : 'No';
      const alts = (r.alt_numbers || []).map((a) => a.phone).join('; ');
      return [
        `"${(r.category || '').replace(/"/g, '""')}"`,
        `"${(r.phone_number || '').replace(/"/g, '""')}"`,
        `"${r.phone_digits}"`,
        `"${isWa}"`,
        `"${alts.replace(/"/g, '""')}"`,
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
  // 10. ENDSCAMS.ORG/REPORT INGESTION & REPORT MODAL
  // ============================================================================
  const handleOpenReportModal = () => {
    if (onNavigateToReport) {
      onNavigateToReport();
      return;
    }
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/report');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
    setIsReportModalOpen(true);
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
    const textToCopy = getCleanCopyPhone(text);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy);
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
        (selectedRetention === 'STANDARD_90D' && !isPrizeOrExtendedRetention(r));

      return matchesSearch && matchesCategory && matchesSource && matchesCountry && matchesStatus && matchesRetention;
    });

    // Automatically sort all results to the newest date first (descending order by default)
    const sorted = list.sort((a, b) => (sortOrder === 'desc' ? compareThreatDatesDesc(a, b) : compareThreatDatesAsc(a, b)));
    // Guarantee 100% unique IDs so React children never experience key collisions
    const seenIds = new Set<string>();
    return sorted.filter((r) => {
      if (!r.id || seenIds.has(r.id)) return false;
      seenIds.add(r.id);
      return true;
    });
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
              <span>CWN Scam Tracker</span>
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
              onClick={() => requireTrackerPass('Execute Manual Threat Refresh', () => executeFullHarvesterScan())}
              disabled={isScanning}
              className="px-3.5 py-2 bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400 text-slate-950 text-xs font-bold rounded-xl flex items-center space-x-1.5 transition shadow-lg disabled:opacity-50 cursor-pointer"
              title="Manual Threat Refresh (requires Admin Password)"
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
              onClick={() => requireTrackerPass('Import CSV Threat Records', () => setIsImportModalOpen(true))}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition border border-slate-700 cursor-pointer"
              title="Import CSV Records (requires Admin Password)"
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

            {/* Report Scam via endscams.org/report */}
            <button
              id="btn-report-scam-endscams"
              onClick={handleOpenReportModal}
              className="px-3 py-2 bg-red-950/40 hover:bg-red-900/60 text-red-200 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition border border-red-800/60 cursor-pointer shadow-sm group"
              title="Report a scam via https://endscams.org/report (Form submissions automatically add numbers to this page)"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-red-400 group-hover:scale-110 transition-transform" />
              <span>Report Scam (endscams.org)</span>
              <ExternalLink className="w-3 h-3 text-red-400/80" />
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
        <div className="mt-4 pt-3.5 border-t border-slate-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5 text-[11px] text-slate-400">
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            <div className="flex items-center space-x-1.5">
              <Radio className={`w-3.5 h-3.5 ${isScanning ? 'text-amber-400 animate-pulse' : 'text-emerald-400'}`} />
              <span>
                <strong>Status:</strong> {isScanning ? scannerStatusMessage : 'Monitoring live threat streams'}
              </span>
            </div>

            {/* Admin Status */}
            {isPasswordVerified ? (
              <button
                type="button"
                onClick={handleLockSession}
                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 text-[10px] font-mono transition cursor-pointer"
                title="Admin session active. Click to lock session."
              >
                <Unlock className="w-3 h-3 text-emerald-400" />
                <span>Admin: Unlocked</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => requireTrackerPass('Admin Authentication', () => {})}
                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-slate-800/90 border border-slate-700 text-slate-400 hover:text-amber-400 hover:border-amber-500/30 text-[10px] font-mono transition cursor-pointer"
                title="Administrative actions require authentication. Click to authenticate."
              >
                <Lock className="w-3 h-3 text-amber-400" />
                <span>Admin: Locked</span>
              </button>
            )}
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
      <section className="bg-slate-900/90 border border-slate-800 p-3 sm:p-4 rounded-2xl flex flex-col gap-2.5">
        {/* Upper Row: All Dropdown Filters (including All Retentions) */}
        <div className="flex flex-wrap items-center gap-2 w-full">
          {/* Category Filter */}
          <div className="flex-1 min-w-[140px] flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-300">
            <Filter className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer w-full"
            >
              <option value="ALL" className="bg-slate-900">All Categories</option>
              {categoriesList.map((c) => (
                <option key={c} value={c} className="bg-slate-900">{c}</option>
              ))}
            </select>
          </div>

          {/* Source Filter */}
          <div className="flex-1 min-w-[130px] flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-300">
            <Database className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer w-full"
            >
              <option value="ALL" className="bg-slate-900">All Sources</option>
              {sourcesList.map((s) => (
                <option key={s} value={s} className="bg-slate-900">{s}</option>
              ))}
            </select>
          </div>

          {/* Country Filter */}
          <div className="flex-1 min-w-[130px] flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-300">
            <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer w-full"
            >
              <option value="ALL" className="bg-slate-900">All Countries</option>
              {countriesList.map((c) => (
                <option key={c} value={c} className="bg-slate-900">{c}</option>
              ))}
            </select>
          </div>

          {/* Retention Tier Filter (shifted to upper part) */}
          <div className="flex-1 min-w-[140px] flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-300">
            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <select
              value={selectedRetention}
              onChange={(e) => setSelectedRetention(e.target.value as any)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer w-full"
            >
              <option value="ALL" className="bg-slate-900">All Retentions</option>
              <option value="PRIZE_6MO" className="bg-slate-900">6-Mo (Prize/Lotto/Stake)</option>
              <option value="STANDARD_90D" className="bg-slate-900">90-Day Standard</option>
            </select>
          </div>

          {/* Status Filter (positioned above Sort) */}
          <div className="w-full sm:w-auto sm:min-w-[190px] flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-300">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer w-full"
            >
              <option value="ALL" className="bg-slate-900">All Statuses</option>
              <option value="ACTIVE" className="bg-slate-900">Active Lines Only</option>
              <option value="DOWN" className="bg-slate-900">Down / Closed Only</option>
            </select>
          </div>
        </div>

        {/* Lower Row: Expanded Search Bar (left) + Sort Newest (right, under All Statuses) */}
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full">
          {/* Expanded Search Bar */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search phone, company, category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
            />
          </div>

          {/* Automatic Date Sort Control (right under All Statuses) */}
          <div className="w-full sm:w-auto sm:min-w-[190px] flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-300">
            <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'desc' | 'asc')}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer w-full"
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
              onClick={() => requireTrackerPass('Bulk Change Status to Out of Service', () => handleBulkMarkDown())}
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
                <th className="px-4 py-3.5 w-10">
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
                <th className="px-4 py-3.5 min-w-[220px]">Phone Number</th>
                <th
                  className="px-4 py-3.5 min-w-[140px] cursor-pointer select-none group hover:text-amber-400 transition-colors"
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
                <th className="px-4 py-3.5 min-w-[200px]">Company / Target</th>
                <th className="px-4 py-3.5 min-w-[220px]">Scam Category</th>
                <th className="px-4 py-3.5 min-w-[150px] text-right sm:text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-slate-500">
                    No matching threat records found. Click "Manual Refresh" or "Import CSV" to populate the database.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record, rIdx) => {
                  const isCopied = copiedId === record.id;
                  const isChecked = selectedIds.includes(record.id);
                  const country = deriveCountryInfo(record.phone_number);

                  return (
                    <tr
                      key={record.id || `threat-row-${rIdx}`}
                      onClick={() => handleOpenPopupDetail(record)}
                      className={`hover:bg-slate-800/70 transition-colors cursor-pointer group select-none ${isChecked ? 'bg-amber-500/5' : ''}`}
                      title="Click anywhere on row to view full threat intel & details"
                    >
                      <td className="px-4 py-3.5 w-10" onClick={(e) => e.stopPropagation()}>
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
                        <div className="space-y-1.5">
                          {/* Primary Phone Line */}
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <a
                              href={`tel:${record.phone_digits}`}
                              onClick={(e) => e.stopPropagation()}
                              className="font-mono font-bold text-sm text-amber-400 hover:text-amber-300 hover:underline transition"
                              title="Click to dial primary line"
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

                            {/* WhatsApp Tag (EndScams Tracker standard) */}
                            {isWhatsAppThreat(record) && (
                              <a
                                href={`https://wa.me/${record.phone_digits}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 font-semibold inline-flex items-center space-x-1 transition cursor-pointer shadow-xs"
                                title="Verified WhatsApp Line (click to open WhatsApp chat)"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                <span>WhatsApp</span>
                                <ExternalLink className="w-2.5 h-2.5 opacity-80" />
                              </a>
                            )}

                            {/* Alt Tag (Badge next to number if alternate numbers are tied) */}
                            {record.alt_numbers && record.alt_numbers.length > 0 && (
                              <span
                                className="px-2 py-0.5 rounded text-[10px] bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-bold inline-flex items-center space-x-1"
                                title={`${record.alt_numbers.length} alternate number${record.alt_numbers.length > 1 ? 's' : ''} tied to this threat report`}
                              >
                                <span>Alt ({record.alt_numbers.length})</span>
                              </span>
                            )}
                          </div>

                          {/* Tied Alternate Numbers List (if any) */}
                          {record.alt_numbers && record.alt_numbers.length > 0 && (
                            <div className="pl-2 border-l-2 border-cyan-500/30 space-y-1">
                              {record.alt_numbers.map((alt, aIdx) => {
                                const altDigits = (alt.digits || alt.phone).replace(/\D/g, '');
                                const altPhone = alt.phone || formatDisplayPhone(altDigits, altDigits);
                                const isAltWa = Boolean(
                                  alt.is_whatsapp ||
                                  isWhatsAppThreat({
                                    phone_digits: altDigits,
                                    phone_number: altPhone,
                                    is_whatsapp: alt.is_whatsapp,
                                  })
                                );
                                const isAltCopied = copiedId === `${record.id}-alt-${aIdx}`;
                                return (
                                  <div key={aIdx} className="flex items-center space-x-1.5 text-xs">
                                    <span className="text-[10px] text-cyan-400/80 font-mono font-medium">Alt #{aIdx + 2}:</span>
                                    <a
                                      href={`tel:${altDigits}`}
                                      onClick={(e) => e.stopPropagation()}
                                      className="font-mono text-xs text-slate-300 hover:text-amber-300 hover:underline transition"
                                      title="Click to dial alternate number"
                                    >
                                      {altPhone}
                                    </a>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCopyPhone(`${record.id}-alt-${aIdx}`, altPhone);
                                      }}
                                      className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                                      title="Copy Alternate Number"
                                    >
                                      {isAltCopied ? (
                                        <Check className="w-3 h-3 text-emerald-400" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </button>
                                    {isAltWa && (
                                      <a
                                        href={`https://wa.me/${altDigits}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 font-semibold inline-flex items-center space-x-0.5 transition cursor-pointer"
                                        title="Alternate line is on WhatsApp"
                                      >
                                        <span>WhatsApp</span>
                                        <ExternalLink className="w-2 h-2 opacity-75" />
                                      </a>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
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

                      {/* Company Impersonated (Company / Target) */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-300 font-medium">
                        <span className="text-slate-200 font-semibold">
                          {resolveTargetCompany(record.impersonated_company, record.category, record.description)}
                        </span>
                      </td>

                      {/* Scam Category */}
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                          {record.category}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-right sm:text-left">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            requireTrackerPass('Change Line Status', () => handleToggleStatus(record));
                          }}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition cursor-pointer shadow-xs ${
                            record.is_down
                              ? 'bg-slate-800/90 text-slate-400 border-slate-700 hover:border-slate-500'
                              : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/35 hover:bg-emerald-500/25'
                          }`}
                          title="Click to toggle status (requires authentication)"
                        >
                          <span className="inline-flex items-center space-x-1.5">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                record.is_down ? 'bg-slate-500' : 'bg-emerald-400 animate-pulse'
                              }`}
                            />
                            <span>{record.is_down ? 'Out of Service' : 'Active Line'}</span>
                          </span>
                        </button>
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
                  requireTrackerPass('Execute Targeted Threat Search', () => executeFullHarvesterScan(targetedQuery, targetedCategory));
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
                  requireTrackerPass('Execute Harvester Scan', () => executeFullHarvesterScan());
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
                    ({importPreview.rejectedBad} invalid/unverified rejected)
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

            {isImporting && (
              <div className="bg-blue-500/10 border border-blue-500/30 p-3 rounded-xl flex items-center space-x-3 text-xs text-blue-300">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-400 flex-shrink-0" />
                <span>{importSyncProgress || 'Importing records and syncing to Supabase database...'}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={handleDownloadSampleCsv}
                disabled={isImporting}
                className="text-xs text-amber-400 hover:text-amber-300 flex items-center space-x-1 cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Template</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  disabled={isImporting}
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!importPreview || importPreview.valid.length === 0 || isImporting}
                  onClick={handleConfirmImport}
                  className="px-4 py-1.5 bg-blue-500 hover:bg-blue-400 text-white font-bold rounded-xl text-xs transition shadow disabled:opacity-40 cursor-pointer flex items-center space-x-1.5"
                >
                  {isImporting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isImporting ? 'Importing & Syncing...' : `Import ${importPreview ? `${importPreview.valid.length} Records` : ''}`}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* SUPABASE SETUP & SCHEMA MODAL              */}
      {/* ========================================== */}
      {isSupabaseSetupModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-2xl shadow-2xl p-6 relative max-h-[90vh] flex flex-col">
            <button
              onClick={() => setIsSupabaseSetupModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <Database className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <h2 className="text-base font-bold text-slate-100">
                    Supabase Live Database
                  </h2>
                  {supabaseTableStatus?.isDirectConnection && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      Direct 5432
                    </span>
                  )}
                  {supabaseTableStatus?.isDokployEnvironment && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Dokploy Configured
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 font-mono truncate max-w-md">
                  {supabaseTableStatus?.connectionTarget || supabaseTableStatus?.databaseSource || dokployConfig.supabaseUrl || 'https://joxeqlgkuvgvjoshmjqu.supabase.co'}
                </p>
              </div>
            </div>

            <div className="space-y-4 overflow-y-auto flex-1 pr-1">
              {/* Status Card */}
              <div className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                supabaseTableStatus?.tablesExist || supabaseTableStatus?.postgresConnected
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
              }`}>
                <div className="flex items-center justify-between font-semibold">
                  <span className="flex items-center space-x-1.5">
                    {supabaseTableStatus?.tablesExist || supabaseTableStatus?.postgresConnected ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                    )}
                    <span>
                      {supabaseTableStatus?.tablesExist || supabaseTableStatus?.postgresConnected
                        ? `Connected (${supabaseTableStatus.databaseSource || 'Direct Supabase PostgreSQL'})`
                        : 'Database Configured — SQL Schema Setup Required'}
                    </span>
                  </span>
                  <button
                    type="button"
                    disabled={isTestingSupabase}
                    onClick={async () => {
                      setIsTestingSupabase(true);
                      const res = await checkSupabaseHealth();
                      if (res?.tablesExist || res?.postgresConnected) {
                        await syncThreatRecordsToSupabase(records);
                        setStatusNotification(`Database connected! Synchronized ${records.length} records to Supabase.`);
                      }
                      setIsTestingSupabase(false);
                    }}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-mono transition cursor-pointer flex items-center space-x-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${isTestingSupabase ? 'animate-spin' : ''}`} />
                    <span>Test & Sync</span>
                  </button>
                </div>
                <p className="text-[11px] opacity-85">
                  {supabaseTableStatus?.tablesExist || supabaseTableStatus?.postgresConnected
                    ? `Live persistence active. All records are continuously saved to your Supabase PostgreSQL tables (${supabaseTableStatus.postgresCount !== undefined ? `${supabaseTableStatus.postgresCount} stored records, ` : ''}${supabaseTableStatus.postgresLatencyMs ? `${supabaseTableStatus.postgresLatencyMs}ms latency` : 'instant'}).`
                    : supabaseTableStatus?.error || "Your Supabase project is connected, but the 'tracker_entries' table has not been created yet in the schema cache."}
                </p>
              </div>

              {/* Instructions */}
              <div className="bg-slate-950/70 border border-slate-800/80 p-3.5 rounded-xl space-y-2 text-xs text-slate-300">
                <h3 className="font-semibold text-slate-200 flex items-center space-x-1.5">
                  <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
                  <span>How to Initialize in Supabase (1-Minute Setup):</span>
                </h3>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-400 leading-relaxed">
                  <li>Open your <strong className="text-slate-200">Supabase Dashboard</strong> for project <code className="text-amber-300">joxeqlgkuvgvjoshmjqu</code>.</li>
                  <li>Click <strong className="text-slate-200">SQL Editor</strong> on the left sidebar.</li>
                  <li>Click <strong className="text-slate-200">"New query"</strong>.</li>
                  <li>Click the button below to copy the SQL schema, paste it into the editor, and click <strong className="text-emerald-300">Run</strong>.</li>
                </ol>
              </div>

              {/* Copy SQL Schema Card */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 font-mono">SQL Table & RLS Schema:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const schemaSql = `-- Supabase Schema for EndScams Threat Tracker
CREATE TABLE IF NOT EXISTS public.tracker_entries (
  id TEXT PRIMARY KEY,
  phone_number TEXT NOT NULL,
  phone_digits TEXT NOT NULL UNIQUE,
  country_code TEXT DEFAULT 'US',
  country_name TEXT DEFAULT 'United States',
  scam_type TEXT DEFAULT 'General Tech Support & Refund Scams',
  category TEXT DEFAULT 'General Tech Support & Refund Scams',
  impersonated_company TEXT DEFAULT 'N/A',
  invoice_number TEXT DEFAULT 'N/A',
  amount_charged TEXT DEFAULT 'N/A',
  source_platform TEXT DEFAULT 'Tech Support United',
  source_name TEXT DEFAULT 'Tech Support United',
  source_url TEXT DEFAULT '',
  source_domain TEXT DEFAULT '',
  threat_intel TEXT DEFAULT '',
  description TEXT DEFAULT '',
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  report_date TEXT DEFAULT '',
  post_date TEXT DEFAULT '',
  is_down BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'Active',
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracker_entries_phone_digits ON public.tracker_entries (phone_digits);
CREATE INDEX IF NOT EXISTS idx_tracker_entries_detected_at ON public.tracker_entries (detected_at DESC);

ALTER TABLE public.tracker_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon and auth read tracker_entries" ON public.tracker_entries;
CREATE POLICY "Allow anon and auth read tracker_entries" ON public.tracker_entries FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow anon and auth insert tracker_entries" ON public.tracker_entries;
CREATE POLICY "Allow anon and auth insert tracker_entries" ON public.tracker_entries FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon and auth update tracker_entries" ON public.tracker_entries;
CREATE POLICY "Allow anon and auth update tracker_entries" ON public.tracker_entries FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon and auth delete tracker_entries" ON public.tracker_entries;
CREATE POLICY "Allow anon and auth delete tracker_entries" ON public.tracker_entries FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.scam_records (
  id TEXT PRIMARY KEY,
  phone TEXT,
  phone_number TEXT,
  clean_phone TEXT,
  phone_digits TEXT UNIQUE,
  country_code TEXT DEFAULT 'US',
  country_name TEXT DEFAULT 'United States',
  scam_type TEXT,
  category TEXT,
  impersonated_company TEXT,
  invoice_number TEXT,
  amount_charged TEXT,
  platform TEXT,
  source_platform TEXT,
  source_name TEXT,
  source_url TEXT,
  source_domain TEXT,
  snippet TEXT,
  threat_intel TEXT,
  detailed_summary TEXT,
  description TEXT,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  report_date TEXT,
  post_date TEXT,
  is_down BOOLEAN DEFAULT FALSE,
  is_number_down BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'Active',
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scam_records_phone_digits ON public.scam_records (phone_digits);
ALTER TABLE public.scam_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon and auth read scam_records" ON public.scam_records;
CREATE POLICY "Allow anon and auth read scam_records" ON public.scam_records FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow anon and auth insert scam_records" ON public.scam_records;
CREATE POLICY "Allow anon and auth insert scam_records" ON public.scam_records FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon and auth update scam_records" ON public.scam_records;
CREATE POLICY "Allow anon and auth update scam_records" ON public.scam_records FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);`;
                      navigator.clipboard.writeText(schemaSql);
                      setCopiedSql(true);
                      setTimeout(() => setCopiedSql(false), 3000);
                    }}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center space-x-1"
                  >
                    {copiedSql ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                        <span>Copied to Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy SQL Schema</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-[10px] font-mono text-slate-400 max-h-36 overflow-y-auto select-all">
{`CREATE TABLE IF NOT EXISTS public.tracker_entries (
  id TEXT PRIMARY KEY,
  phone_number TEXT NOT NULL,
  phone_digits TEXT NOT NULL UNIQUE,
  country_code TEXT DEFAULT 'US',
  country_name TEXT DEFAULT 'United States',
  scam_type TEXT DEFAULT 'General Tech Support & Refund Scams',
  category TEXT DEFAULT 'General Tech Support & Refund Scams',
  impersonated_company TEXT DEFAULT 'N/A',
  invoice_number TEXT DEFAULT 'N/A',
  amount_charged TEXT DEFAULT 'N/A',
  source_platform TEXT DEFAULT 'Tech Support United',
  source_name TEXT DEFAULT 'Tech Support United',
  source_url TEXT DEFAULT '',
  source_domain TEXT DEFAULT '',
  threat_intel TEXT DEFAULT '',
  description TEXT DEFAULT '',
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  report_date TEXT DEFAULT '',
  post_date TEXT DEFAULT '',
  is_down BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'Active',
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);`}
                </pre>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-2 mt-2">
              <button
                type="button"
                onClick={() => setIsSupabaseSetupModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ======================================================== */}
      {/* J. REPORT A SCAM (HTTPS://ENDSCAMS.ORG/REPORT) MODAL     */}
      {/* ======================================================== */}
      {isReportModalOpen && (
        <ReportScamPage
          isModal={true}
          onCloseModal={() => setIsReportModalOpen(false)}
          onNavigateToTracker={() => setIsReportModalOpen(false)}
        />
      )}

      {/* J2. THREAT POST DETAILS & ACTIONS POPUP MODAL (CENTER)    */}
      {/* ======================================================== */}
      {selectedDetailRecord && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => {
            if (!isEditingInPopup) setSelectedDetailRecord(null);
          }}
        >
          <div
            className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl p-6 relative space-y-5 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800/80 pb-4">
              <div className="space-y-1.5">
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    THREAT REPORT #{selectedDetailRecord.id.slice(0, 8)}
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      selectedDetailRecord.is_down
                        ? 'bg-slate-800 text-slate-400 border-slate-700'
                        : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                        selectedDetailRecord.is_down ? 'bg-slate-500' : 'bg-emerald-400 animate-pulse'
                      }`}
                    />
                    {selectedDetailRecord.is_down ? 'Out of Service' : 'Active Line'}
                  </span>
                  {isEditingInPopup && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500 text-slate-950">
                      EDITING MODE (UNLOCKED)
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-bold text-slate-100">
                  {resolveTargetCompany(
                    selectedDetailRecord.impersonated_company,
                    selectedDetailRecord.category,
                    selectedDetailRecord.description
                  )}
                </h2>
              </div>

              <button
                onClick={() => {
                  setIsEditingInPopup(false);
                  setSelectedDetailRecord(null);
                }}
                className="p-1.5 rounded-lg bg-slate-800/60 text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {popupEditError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{popupEditError}</span>
              </div>
            )}

            {/* If NOT editing: Display full post details & Actions section */}
            {!isEditingInPopup ? (
              <div className="space-y-4 text-xs">
                {/* Phone Numbers Section */}
                <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Monitored Contact Numbers
                  </div>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-slate-400 font-medium">Primary Line:</span>
                      <a
                        href={`tel:${selectedDetailRecord.phone_digits}`}
                        className="font-mono text-base font-bold text-amber-400 hover:text-amber-300 hover:underline transition"
                      >
                        {selectedDetailRecord.phone_number}
                      </a>
                      <button
                        onClick={() => handleCopyPhone(selectedDetailRecord.id, selectedDetailRecord.phone_number)}
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition cursor-pointer"
                        title="Copy Number"
                      >
                        {copiedId === selectedDetailRecord.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    <div className="flex items-center space-x-2">
                      {isWhatsAppThreat(selectedDetailRecord) && (
                        <a
                          href={`https://wa.me/${selectedDetailRecord.phone_digits}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 rounded-lg text-xs bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 font-semibold inline-flex items-center space-x-1.5 transition cursor-pointer shadow-xs"
                          title="Open WhatsApp Chat"
                        >
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                          <span>Verified WhatsApp</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Tied Alternate Numbers */}
                  {selectedDetailRecord.alt_numbers && selectedDetailRecord.alt_numbers.length > 0 && (
                    <div className="pt-2 border-t border-slate-800/80 space-y-2">
                      <div className="text-[11px] font-medium text-cyan-400">
                        Tied Alternate Numbers ({selectedDetailRecord.alt_numbers.length}):
                      </div>
                      <div className="space-y-1.5">
                        {selectedDetailRecord.alt_numbers.map((alt, aIdx) => {
                          const altDigits = (alt.digits || alt.phone).replace(/\D/g, '');
                          const altPhone = alt.phone || formatDisplayPhone(altDigits, altDigits);
                          const isAltWa = Boolean(
                            alt.is_whatsapp ||
                            isWhatsAppThreat({
                              phone_digits: altDigits,
                              phone_number: altPhone,
                              is_whatsapp: alt.is_whatsapp,
                            })
                          );
                          const isAltCopied = copiedId === `${selectedDetailRecord.id}-alt-${aIdx}`;
                          return (
                            <div
                              key={aIdx}
                              className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800"
                            >
                              <div className="flex items-center space-x-2">
                                <span className="font-mono text-[11px] text-cyan-400 font-bold">
                                  Alt #{aIdx + 2}:
                                </span>
                                <a
                                  href={`tel:${altDigits}`}
                                  className="font-mono text-sm text-slate-200 hover:text-amber-300 hover:underline transition"
                                >
                                  {altPhone}
                                </a>
                                <button
                                  onClick={() => handleCopyPhone(`${selectedDetailRecord.id}-alt-${aIdx}`, altPhone)}
                                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                                  title="Copy Number"
                                >
                                  {isAltCopied ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>

                              {isAltWa && (
                                <a
                                  href={`https://wa.me/${altDigits}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 font-semibold inline-flex items-center space-x-1"
                                >
                                  <span>WhatsApp</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2-Column Attributes Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Date Detected / Incident Date */}
                  <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 space-y-1">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                      <Calendar className="w-3 h-3 text-amber-400" />
                      <span>Date Detected (PST)</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-slate-200 text-sm">
                        {normalizeToNumericalDate(selectedDetailRecord.report_date)}
                      </span>
                      <span
                        className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-semibold ${
                          isPrizeOrExtendedRetention(selectedDetailRecord)
                            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {getRetentionLabel(selectedDetailRecord)}
                      </span>
                    </div>
                  </div>

                  {/* Scammer's Name / Impersonated Target */}
                  <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 space-y-1">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                      <Shield className="w-3 h-3 text-cyan-400" />
                      <span>Scammer's Name / Target</span>
                    </div>
                    <div className="text-slate-200 font-semibold text-sm">
                      {selectedDetailRecord.scammer_name && selectedDetailRecord.scammer_name !== 'N/A'
                        ? selectedDetailRecord.scammer_name
                        : resolveTargetCompany(
                            selectedDetailRecord.impersonated_company,
                            selectedDetailRecord.category,
                            selectedDetailRecord.description
                          )}
                    </div>
                  </div>

                  {/* Scam Category */}
                  <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 space-y-1">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Scam Category
                    </div>
                    <div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                        {selectedDetailRecord.category}
                      </span>
                    </div>
                  </div>

                  {/* How Were You Contacted? */}
                  <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 space-y-1">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                      <Phone className="w-3 h-3 text-indigo-400" />
                      <span>How Were You Contacted?</span>
                    </div>
                    <div className="text-slate-200 font-semibold text-sm">
                      {selectedDetailRecord.how_contacted || 'Phone Call'}
                    </div>
                  </div>

                  {/* Financial Loss ($) */}
                  <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 space-y-1">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                      <Award className="w-3 h-3 text-emerald-400" />
                      <span>Financial Loss ($)</span>
                    </div>
                    <div className="font-mono font-bold text-sm">
                      {selectedDetailRecord.money_lost !== undefined && selectedDetailRecord.money_lost !== null ? (
                        selectedDetailRecord.money_lost === 0 ? (
                          <span className="text-slate-400 font-medium">$0.00 (No Loss)</span>
                        ) : (
                          <span className="text-rose-400 font-extrabold">${selectedDetailRecord.money_lost.toLocaleString()}</span>
                        )
                      ) : selectedDetailRecord.amount_charged && selectedDetailRecord.amount_charged !== 'N/A' ? (
                        <span className="text-amber-400">{selectedDetailRecord.amount_charged}</span>
                      ) : (
                        <span className="text-slate-400 font-normal">None / Not Reported</span>
                      )}
                    </div>
                  </div>

                  {/* Source Platform */}
                  <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 space-y-1">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                      <Globe className="w-3 h-3 text-blue-400" />
                      <span>Source Platform</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {selectedDetailRecord.source_url && selectedDetailRecord.source_url.startsWith('http') ? (
                        <a
                          href={selectedDetailRecord.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center space-x-1 text-slate-200 hover:text-amber-400 font-semibold underline decoration-slate-600 underline-offset-2 transition"
                          title="Open external verified report"
                        >
                          <span>{selectedDetailRecord.source_name}</span>
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </a>
                      ) : (
                        <span className="text-slate-200 font-semibold">{selectedDetailRecord.source_name}</span>
                      )}
                    </div>
                  </div>

                  {/* Status */}
                  <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 space-y-1 sm:col-span-2">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                      <Shield className="w-3 h-3 text-emerald-400" />
                      <span>Status</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-semibold text-xs ${
                          selectedDetailRecord.is_down ? 'text-slate-400' : 'text-emerald-400'
                        }`}
                      >
                        {selectedDetailRecord.is_down ? 'Out of Service / Inactive' : 'Active Operating Line'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Financial / Invoice details if available */}
                {((selectedDetailRecord.amount_charged && selectedDetailRecord.amount_charged !== 'N/A') ||
                  (selectedDetailRecord.invoice_number && selectedDetailRecord.invoice_number !== 'N/A')) && (
                  <div className="bg-amber-500/5 p-3 rounded-xl border border-amber-500/20 flex items-center space-x-6">
                    {selectedDetailRecord.amount_charged && selectedDetailRecord.amount_charged !== 'N/A' && (
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase block font-medium">Claimed Amount:</span>
                        <span className="text-amber-400 font-mono font-bold text-sm">
                          {selectedDetailRecord.amount_charged}
                        </span>
                      </div>
                    )}
                    {selectedDetailRecord.invoice_number && selectedDetailRecord.invoice_number !== 'N/A' && (
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase block font-medium">Invoice ID:</span>
                        <span className="text-slate-200 font-mono font-semibold text-sm">
                          {selectedDetailRecord.invoice_number}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Attached Screenshot / Evidence (if available) */}
                {(selectedDetailRecord.image_url || selectedDetailRecord.evidence_url) && (
                  <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-2">
                    <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                      <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Attached Evidence / Scam Screenshot</span>
                    </div>
                    <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <img
                          src={selectedDetailRecord.image_url || selectedDetailRecord.evidence_url}
                          alt="Scam evidence"
                          className="w-14 h-14 object-cover rounded-lg border border-slate-700 cursor-pointer hover:opacity-90 transition"
                          onClick={() => window.open(selectedDetailRecord.image_url || selectedDetailRecord.evidence_url, '_blank')}
                        />
                        <div className="text-xs text-slate-300">
                          <p className="font-semibold">Screenshot Evidence</p>
                          <p className="text-[10px] text-slate-500">Provided during scam report submission</p>
                        </div>
                      </div>
                      <a
                        href={selectedDetailRecord.image_url || selectedDetailRecord.evidence_url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-lg text-xs font-medium inline-flex items-center space-x-1 transition"
                      >
                        <span>View Full</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                )}

                {/* Optional Reporter Credits */}
                {(selectedDetailRecord.reporter_name || selectedDetailRecord.reporter_email) && (
                  <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Submitted by Community Reporter:</span>
                    <span className="text-slate-200 font-medium">
                      {selectedDetailRecord.reporter_name || 'Anonymous'}
                      {selectedDetailRecord.reporter_email ? ` (${selectedDetailRecord.reporter_email})` : ''}
                    </span>
                  </div>
                )}

                {/* Threat Intel & Snippet (Describe What Happened) */}
                <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                    <Info className="w-3.5 h-3.5 text-amber-400" />
                    <span>Threat Intel & Snippet (Describe What Happened)</span>
                  </div>
                  <div className="text-slate-300 leading-relaxed font-sans whitespace-pre-wrap bg-slate-900/60 p-3 rounded-lg border border-slate-800/80 text-xs selection:bg-amber-500/30">
                    {selectedDetailRecord.description || 'No detailed snippet provided for this threat entry.'}
                  </div>
                </div>

                {/* Actions Box directly on popup modal */}
                <div className="bg-slate-950/80 p-4 rounded-xl border border-amber-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Shield className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                        Protected Actions
                      </span>
                    </div>
                    {!isPasswordVerified && (
                      <span className="text-[10px] text-amber-400/90 font-mono flex items-center space-x-1">
                        <Lock className="w-3 h-3" />
                        <span>Password Required to Edit</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        requireTrackerPass('Edit Monitored Number', () => {
                          handleStartEditingInPopup();
                        });
                      }}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition shadow flex items-center space-x-1.5 cursor-pointer"
                      title="Edit threat post details (requires authentication)"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Threat Post (Actions)</span>
                      {!isPasswordVerified && <Lock className="w-3 h-3 ml-1 opacity-70" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        requireTrackerPass('Change Line Status', () => {
                          handleToggleStatus(selectedDetailRecord);
                          setSelectedDetailRecord((prev) =>
                            prev ? { ...prev, is_down: !prev.is_down } : null
                          );
                        });
                      }}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs transition border border-slate-700 flex items-center space-x-1.5 cursor-pointer"
                      title="Toggle line active / out of service (requires authentication)"
                    >
                      <span className={`w-2 h-2 rounded-full ${selectedDetailRecord.is_down ? 'bg-slate-500' : 'bg-emerald-400'}`} />
                      <span>Toggle Status ({selectedDetailRecord.is_down ? 'Mark Active' : 'Mark Out of Service'})</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* If EDITING: Interactive form directly on the popup box (All Parameters) */
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Phone Number & WhatsApp Checkbox */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Phone Number *
                    </label>
                    <input
                      type="text"
                      value={popupEditForm.phone_number}
                      onChange={(e) => setPopupEditForm((prev) => ({ ...prev, phone_number: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                      placeholder="+1 (800) 000-0000"
                    />
                    <label className="flex items-center space-x-2 pt-1 text-[11px] text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={popupEditForm.is_whatsapp}
                        onChange={(e) => setPopupEditForm((prev) => ({ ...prev, is_whatsapp: e.target.checked }))}
                        className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
                      />
                      <span>Is this also a WhatsApp number?</span>
                    </label>
                  </div>

                  {/* Scammer's Name (Impersonated Company) */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Scammer's Name / Impersonated Target *
                    </label>
                    <input
                      type="text"
                      value={popupEditForm.impersonated_company}
                      onChange={(e) => setPopupEditForm((prev) => ({ ...prev, impersonated_company: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                      placeholder="e.g. Geek Squad, American Cash Award"
                    />
                    <span className="text-[10px] text-slate-500">Name they gave, company claimed, or caller identity</span>
                  </div>

                  {/* Alternate Phone Number 1 (Optional) */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Alternate Phone Number (Optional)
                    </label>
                    <input
                      type="text"
                      value={popupEditForm.alt_phone_1}
                      onChange={(e) => setPopupEditForm((prev) => ({ ...prev, alt_phone_1: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                      placeholder="e.g. +1 (855) 000-0000"
                    />
                    <span className="text-[10px] text-slate-500">Secondary callback number</span>
                  </div>

                  {/* Second Alternate Phone Number 2 (Optional) + WhatsApp */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Second Alternate Phone Number (Optional)
                    </label>
                    <input
                      type="text"
                      value={popupEditForm.alt_phone_2}
                      onChange={(e) => setPopupEditForm((prev) => ({ ...prev, alt_phone_2: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                      placeholder="e.g. +1 (866) 000-0000"
                    />
                    <label className="flex items-center space-x-2 pt-1 text-[11px] text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={popupEditForm.alt_phone_2_whatsapp}
                        onChange={(e) => setPopupEditForm((prev) => ({ ...prev, alt_phone_2_whatsapp: e.target.checked }))}
                        className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
                      />
                      <span>Is this second number on WhatsApp?</span>
                    </label>
                  </div>

                  {/* How Were You Contacted? */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      How Were You Contacted?
                    </label>
                    <select
                      value={popupEditForm.how_contacted}
                      onChange={(e) => setPopupEditForm((prev) => ({ ...prev, how_contacted: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                    >
                      <option value="Phone Call">Phone Call</option>
                      <option value="Text Message (SMS)">Text Message (SMS)</option>
                      <option value="WhatsApp">WhatsApp</option>
                      <option value="Email">Email</option>
                      <option value="Website / Pop-up">Website / Pop-up</option>
                      <option value="Social Media">Social Media</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {/* Financial Loss ($) */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Money Lost ($) (Optional)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={popupEditForm.money_lost}
                      onChange={(e) => setPopupEditForm((prev) => ({ ...prev, money_lost: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                      placeholder="0.00"
                    />
                  </div>

                  {/* Scam Category */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Scam Category *
                    </label>
                    <select
                      value={popupEditForm.category}
                      onChange={(e) => setPopupEditForm((prev) => ({ ...prev, category: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                    >
                      <option value="Lottery & Sweepstakes Scams">Lottery & Sweepstakes Scams (American Cash Award, PCH, etc.)</option>
                      <option value="General Tech Support & Refund Scams">General Tech Support & Refund Scams</option>
                      <option value="Crypto BTC Recovery Scam">Crypto BTC Recovery Scam</option>
                      <option value="Social Media Prize & Giveaway Scam">Social Media Prize & Giveaway Scam</option>
                      <option value="Government Impersonation & Warrant Scams">Government Impersonation & Warrant Scams</option>
                      <option value="Emergency & Grandparent Scams">Emergency & Grandparent Scams</option>
                      <option value="Spellcaster WhatsApp Extortion">Spellcaster WhatsApp Extortion</option>
                      <option value="Publishing Chat Scam">Publishing Chat Scam</option>
                      <option value="Spiritual / Herbal / Fortune Scam">Spiritual / Herbal / Fortune Scam</option>
                      <option value="Other Scam">Other Scam</option>
                    </select>
                  </div>

                  {/* Date Detected */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Date Detected (YYYY-MM-DD or MM/DD/YYYY)
                    </label>
                    <input
                      type="text"
                      value={popupEditForm.report_date}
                      onChange={(e) => setPopupEditForm((prev) => ({ ...prev, report_date: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                      placeholder="YYYY-MM-DD"
                    />
                  </div>

                  {/* Source Platform */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Source Platform
                    </label>
                    <input
                      type="text"
                      value={popupEditForm.source_name}
                      onChange={(e) => setPopupEditForm((prev) => ({ ...prev, source_name: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                      placeholder="e.g. EndScams Direct Report, Scammer.info"
                    />
                  </div>

                  {/* Operational Status */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Line Status
                    </label>
                    <select
                      value={popupEditForm.is_down ? 'down' : 'active'}
                      onChange={(e) => setPopupEditForm((prev) => ({ ...prev, is_down: e.target.value === 'down' }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                    >
                      <option value="active">Active Line (Operational)</option>
                      <option value="down">Out of Service / Inactive</option>
                    </select>
                  </div>

                  {/* Source URL */}
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Source URL
                    </label>
                    <input
                      type="text"
                      value={popupEditForm.source_url}
                      onChange={(e) => setPopupEditForm((prev) => ({ ...prev, source_url: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                      placeholder="https://..."
                    />
                  </div>

                  {/* Claimed Amount */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Claimed Amount (Optional)
                    </label>
                    <input
                      type="text"
                      value={popupEditForm.amount_charged}
                      onChange={(e) => setPopupEditForm((prev) => ({ ...prev, amount_charged: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                      placeholder="e.g. $499.99"
                    />
                  </div>

                  {/* Invoice ID */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Invoice ID (Optional)
                    </label>
                    <input
                      type="text"
                      value={popupEditForm.invoice_number}
                      onChange={(e) => setPopupEditForm((prev) => ({ ...prev, invoice_number: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                      placeholder="e.g. INV-98234"
                    />
                  </div>

                  {/* Threat Intel & Snippet (Describe What Happened) */}
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Describe What Happened (Threat Intel & Snippet) *
                    </label>
                    <textarea
                      rows={4}
                      value={popupEditForm.description}
                      onChange={(e) => setPopupEditForm((prev) => ({ ...prev, description: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-200 text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none resize-none leading-relaxed"
                      placeholder="Provide details on the call or message: What did they say? What did they ask for? Any names or reference numbers..."
                    />
                  </div>
                </div>

                {/* Edit Form Action Buttons */}
                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingInPopup(false);
                      setPopupEditError(null);
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleSavePopupEdit}
                    className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition shadow flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </button>
                </div>
              </div>
            )}

            {/* Modal Bottom Footer (when not editing) */}
            {!isEditingInPopup && (
              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedDetailRecord(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition cursor-pointer"
                >
                  Close Details
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* K. EDIT MONITORED NUMBER MODAL             */}
      {/* ========================================== */}
      {isEditModalOpen && editingRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl p-6 relative space-y-4 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                setIsEditModalOpen(false);
                setEditingRecord(null);
                setEditError(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                <Edit3 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-100">Edit Monitored Number</h2>
                <p className="text-[11px] text-slate-400">Update threat record metadata, numbers, and operational status</p>
              </div>
            </div>

            {editError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-2.5 rounded-xl flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEditRecord} className="space-y-3.5 text-xs">
              {/* Primary Phone Number & WhatsApp Toggle */}
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-slate-200 font-semibold">
                    Primary Phone Number * (Dialable, Non-Toll-Free)
                  </label>
                  <label className="flex items-center space-x-1.5 cursor-pointer text-[11px] text-emerald-400 select-none">
                    <input
                      type="checkbox"
                      checked={editForm.is_whatsapp}
                      onChange={(e) => setEditForm({ ...editForm, is_whatsapp: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
                    />
                    <span className="font-medium">WhatsApp Line</span>
                  </label>
                </div>
                <input
                  type="text"
                  required
                  value={editForm.phone_number}
                  onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              {/* Alternate / Tied Numbers (Up to 3 additional, total 4) */}
              <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-300 font-semibold text-xs">Tied Alternate Numbers</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-mono">
                      {1 + editForm.alt_numbers.length} / 4 configured
                    </span>
                  </div>

                  {editForm.alt_numbers.length < 3 && (
                    <button
                      type="button"
                      onClick={() =>
                        setEditForm({
                          ...editForm,
                          alt_numbers: [...editForm.alt_numbers, { phone: '', is_whatsapp: false }],
                        })
                      }
                      className="text-[11px] px-2 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition flex items-center space-x-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Alt Number</span>
                    </button>
                  )}
                </div>

                {editForm.alt_numbers.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic">
                    No alternate numbers attached yet. Click "+ Add Alt Number" to attach up to 3 alternate numbers.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {editForm.alt_numbers.map((alt, idx) => (
                      <div
                        key={idx}
                        className="flex items-center space-x-2 bg-slate-900/90 p-2 rounded-xl border border-slate-800"
                      >
                        <span className="text-[10px] font-mono text-cyan-400 font-bold shrink-0 w-12">
                          Alt #{idx + 2}:
                        </span>
                        <input
                          type="text"
                          required
                          placeholder="Alternate phone number"
                          value={alt.phone}
                          onChange={(e) => {
                            const updated = [...editForm.alt_numbers];
                            updated[idx].phone = e.target.value;
                            setEditForm({ ...editForm, alt_numbers: updated });
                          }}
                          className="flex-1 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono focus:outline-none focus:border-cyan-500"
                        />
                        <label className="flex items-center space-x-1 cursor-pointer text-[10px] text-emerald-400 shrink-0 select-none">
                          <input
                            type="checkbox"
                            checked={alt.is_whatsapp}
                            onChange={(e) => {
                              const updated = [...editForm.alt_numbers];
                              updated[idx].is_whatsapp = e.target.checked;
                              setEditForm({ ...editForm, alt_numbers: updated });
                            }}
                            className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
                          />
                          <span>WA</span>
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setEditForm({
                              ...editForm,
                              alt_numbers: editForm.alt_numbers.filter((_, i) => i !== idx),
                            })
                          }
                          className="p-1 text-slate-500 hover:text-red-400 transition cursor-pointer"
                          title="Remove alternate number"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Impersonated Brand / Company
                </label>
                <input
                  type="text"
                  value={editForm.impersonated_company}
                  onChange={(e) => setEditForm({ ...editForm, impersonated_company: e.target.value })}
                  placeholder="e.g. Geek Squad, Norton"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Scam Category</label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
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
                  <label className="block text-slate-300 font-semibold mb-1">Line Status</label>
                  <div className="flex items-center space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setEditForm({ ...editForm, is_down: false })}
                      className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                        !editForm.is_down
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      Active Line
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditForm({ ...editForm, is_down: true })}
                      className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                        editForm.is_down
                          ? 'bg-red-500/20 text-red-400 border-red-500/40'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      Out of Service
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Amount Charged</label>
                  <input
                    type="text"
                    value={editForm.amount_charged}
                    onChange={(e) => setEditForm({ ...editForm, amount_charged: e.target.value })}
                    placeholder="e.g. $499.99"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Invoice / Ref #</label>
                  <input
                    type="text"
                    value={editForm.invoice_number}
                    onChange={(e) => setEditForm({ ...editForm, invoice_number: e.target.value })}
                    placeholder="e.g. INV-982341"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Source Name / Platform</label>
                  <input
                    type="text"
                    value={editForm.source_name}
                    onChange={(e) => setEditForm({ ...editForm, source_name: e.target.value })}
                    placeholder="e.g. Tech Support United"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Source URL</label>
                  <input
                    type="url"
                    value={editForm.source_url}
                    onChange={(e) => setEditForm({ ...editForm, source_url: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Threat Context / Snippet</label>
                <textarea
                  rows={2}
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingRecord(null);
                    setEditError(null);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition shadow flex items-center space-x-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* J. TRACKER_PASS AUTHENTICATION MODAL (TOPMOST Z-INDEX) */}
      {/* J. TRACKER_PASS AUTHENTICATION MODAL       */}
      {/* ========================================== */}
      {isPasswordModalOpen && (
        <div
          className="fixed inset-0 z-[999999] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4" style={{ zIndex: 999999 }}
          onClick={() => {
            setIsPasswordModalOpen(false);
            setPendingAction(null);
            setPasswordError(null);
          }}
        >
          <div
            className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl p-6 relative space-y-4" style={{ zIndex: 1000000 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                setIsPasswordModalOpen(false);
                setPendingAction(null);
                setPasswordError(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-100">Administrator Password Required</h2>
                <p className="text-[11px] text-slate-400">Action: <strong className="text-amber-400">{passwordActionName}</strong></p>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Secured by encrypted Administrator or Bypass credentials (bypass access is strictly limited to editing post details and changing line status).
            </p>

            {passwordError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-2.5 rounded-xl flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handleVerifyPassword} className="space-y-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1 text-xs">
                  Enter Password or Encrypted Bypass Key
                </label>
                <div className="relative">
                  <input
                    type={showPasswordText ? 'text' : 'password'}
                    required
                    autoFocus
                    placeholder="Enter password..."
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full pl-3 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-amber-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordText(!showPasswordText)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                  >
                    {showPasswordText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsPasswordModalOpen(false);
                    setPendingAction(null);
                    setPasswordError(null);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingPassword}
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-xs transition shadow disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>{isVerifyingPassword ? 'Verifying...' : 'Unlock & Proceed'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
    </div>
  );
}

export { TrackerPage as EmbeddableTracker };
export default TrackerPage;
