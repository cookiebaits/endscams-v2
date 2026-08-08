import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { ScamPhoneRecord } from './types.js';
import { INITIAL_SAMPLE_RECORDS } from './data/presets.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
const PORT = 8000;

app.use(express.json({ limit: '10mb' }));

// In-Memory Scam Records Store with 31-Day Retention
let scamRecordsStore: ScamPhoneRecord[] = [...INITIAL_SAMPLE_RECORDS];
let lastScanTime: string | null = new Date().toISOString();
let isScanningInProgress = false;
let lastScanSummary = 'Initial 31-day database loaded with sample scam phone records.';

// 31-Day Retention constant (31 days in milliseconds)
const THIRTY_ONE_DAYS_MS = 31 * 24 * 60 * 60 * 1000;

// Function to purge records older than 31 days
function purgeExpiredRecords() {
  const now = Date.now();
  const initialCount = scamRecordsStore.length;
  scamRecordsStore = scamRecordsStore.filter((record) => {
    const recordTime = new Date(record.detectedAt).getTime();
    return !isNaN(recordTime) && now - recordTime <= THIRTY_ONE_DAYS_MS;
  });
  const purgedCount = initialCount - scamRecordsStore.length;
  if (purgedCount > 0) {
    console.log(`[Retention Purge] Automatically deleted ${purgedCount} record(s) older than 31 days.`);
  }
}

// Helper to initialize GenAI client
function getGenAIClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Helper to parse JSON flexibly from Gemini responses without throwing or warning
function safeExtractJsonItems(responseText: string): any[] {
  if (!responseText) return [];
  try {
    // 1. Try code block match
    const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const textToParse = codeBlockMatch ? codeBlockMatch[1].trim() : responseText.trim();

    // Direct JSON parse attempt
    const parsed = JSON.parse(textToParse);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.items)) return parsed.items;
    if (parsed && Array.isArray(parsed.records)) return parsed.records;
    if (parsed && Array.isArray(parsed.results)) return parsed.results;
  } catch (e) {
    // 2. Regex fallback for JSON array inside response
    try {
      const arrayMatch = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (arrayMatch) {
        const parsedArray = JSON.parse(arrayMatch[0]);
        if (Array.isArray(parsedArray)) return parsedArray;
      }
    } catch (e2) {
      // 3. Object match fallback
      try {
        const objMatch = responseText.match(/\{[\s\S]*"items"\s*:\s*\[[\s\S]*\][\s\S]*\}/);
        if (objMatch) {
          const parsedObj = JSON.parse(objMatch[0]);
          if (parsedObj && Array.isArray(parsedObj.items)) return parsedObj.items;
        }
      } catch (e3) {
        // Silently return empty array on unparseable text
      }
    }
  }
  return [];
}

// Helper to delay execution (prevents API rate-limiting)
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Country code detection helper
function deriveCountryInfo(phone: string): { code: string; name: string } {
  if (!phone || typeof phone !== 'string') return { code: 'GLOBAL', name: 'International' };
  const clean = phone.replace(/[^0-9+]/g, '');
  if (clean.startsWith('+234') || clean.startsWith('234')) return { code: 'NG', name: 'Nigeria' };
  if (clean.startsWith('+1') || clean.startsWith('1')) return { code: 'US', name: 'United States' };
  if (clean.startsWith('+44') || clean.startsWith('44')) return { code: 'GB', name: 'United Kingdom' };
  if (clean.startsWith('+254') || clean.startsWith('254')) return { code: 'KE', name: 'Kenya' };
  if (clean.startsWith('+91') || clean.startsWith('91')) return { code: 'IN', name: 'India' };
  if (clean.startsWith('+233') || clean.startsWith('233')) return { code: 'GH', name: 'Ghana' };
  if (clean.startsWith('+27') || clean.startsWith('27')) return { code: 'ZA', name: 'South Africa' };
  if (clean.startsWith('+61') || clean.startsWith('61')) return { code: 'AU', name: 'Australia' };
  if (clean.startsWith('+62') || clean.startsWith('62')) return { code: 'ID', name: 'Indonesia' };
  if (clean.startsWith('+63') || clean.startsWith('63')) return { code: 'PH', name: 'Philippines' };
  return { code: 'GLOBAL', name: 'International' };
}

/**
 * Master Harvester Scan Function
 * @param windowDays - 31 for manual historical deep search, 1 for scheduled 24-hour auto-refreshes
 */
async function executeFullHarvesterScan(windowDays: number = 31): Promise<{ newCount: number; summary: string }> {
  if (isScanningInProgress) {
    return { newCount: 0, summary: 'Scan already in progress.' };
  }

  isScanningInProgress = true;
  const timeLabel = windowDays === 1 ? 'LAST 24 HOURS' : 'LAST 31 DAYS';
  console.log(`[Harvester] Starting harvester scan for ${timeLabel} across Google & BBB Scam Tracker...`);

  let accumulatedNewRecords: ScamPhoneRecord[] = [];

  try {
    const ai = getGenAIClient();

    // 1. Target queries for Google Search with extensive dorks
    const googleQueries = [
      {
        query: 'site:facebook.com "spellcaster" "Whatsapp"',
        category: 'Spellcaster Scam',
        platform: 'Facebook',
      },
      {
        query: 'site:facebook.com "love spell" OR "voodoo" "Whatsapp"',
        category: 'Spellcaster Scam',
        platform: 'Facebook',
      },
      {
        query: 'site:instagram.com "spellcaster" OR "lottery spell" "Whatsapp"',
        category: 'Spellcaster Scam',
        platform: 'Instagram',
      },
      {
        query: 'site:facebook.com "btc recovery" OR "crypto recovery" "Whatsapp"',
        category: 'Crypto / BTC Recovery Scam',
        platform: 'Facebook',
      },
      {
        query: 'inurl:guestbook "spell" OR "lottery" "whatsapp"',
        category: 'Guestbook Spam',
        platform: 'Guestbook',
      },
      {
        query: 'site:reddit.com "Geek Squad" "scam" "phone number"',
        category: 'Tech Support Scam',
        platform: 'Reddit',
      },
      {
        query: 'site:reddit.com "McAfee" OR "Norton" OR "PayPal" "scam" "phone number"',
        category: 'Tech Support Scam',
        platform: 'Reddit',
      },
      {
        query: '"Geek Squad" refund scam phone number 800 OR 888 OR 844 OR 855 OR 877',
        category: 'Tech Support Scam',
        platform: 'Web Search',
      },
      {
        query: '"PayPal" invoice scam support phone number 800 OR 888 OR 844 OR 855 OR 877',
        category: 'PayPal Invoice Scam',
        platform: 'Web Search',
      },
      {
        query: 'site:x.com "spellcaster" OR "ex lover" "Whatsapp"',
        category: 'Spellcaster Scam',
        platform: 'X / Twitter',
      },
      {
        query: 'site:techscammersunited.com "paypal"',
        category: 'PayPal Invoice Scam',
        platform: 'TechScammersUnited',
      },
      {
        query: 'site:techscammersunited.com "apple"',
        category: 'Apple Support Impersonation',
        platform: 'TechScammersUnited',
      },
      {
        query: 'site:techscammersunited.com "geek squad"',
        category: 'Tech Support / Geek Squad Impersonation',
        platform: 'TechScammersUnited',
      },
      {
        query: 'site:techscammersunited.com "mcafee"',
        category: 'McAfee / Antivirus Impersonation',
        platform: 'TechScammersUnited',
      },
      {
        query: 'site:techscammersunited.com "pch" OR "publishers clearing house"',
        category: 'Sweepstakes / Lottery Scam',
        platform: 'TechScammersUnited',
      },
    ];

    // Expanded page offsets for deep multi-page search crawling (Pages 1-8: start=0, 10, 20, 30, 40, 50, 60, 70)
    const pageOffsets = [0, 10, 20, 30, 40, 50, 60, 70];

    // Build existing phone set for strict deduplication
    const existingPhones = new Set<string>();
    scamRecordsStore.forEach((r) => {
      if (r.cleanPhone) existingPhones.add(r.cleanPhone);
      const digits = r.phone.replace(/\D/g, '');
      if (digits) existingPhones.add(digits);
    });

    // 1. Target queries for Google Search across multiple pages
    for (const item of googleQueries) {
      for (const offset of pageOffsets) {
        const pageNum = offset / 10 + 1;
        const googlePageUrl = `https://www.google.com/search?q=${encodeURIComponent(item.query)}&start=${offset}`;

        try {
          const prompt = `
Perform an exhaustive Google Search scan for search query: ${item.query} (Page ${pageNum}, offset start=${offset}) for the ${timeLabel}.

Objective:
Deeply scan and extract ALL scam phone numbers (WhatsApp numbers, call centers, toll-free 1-800/1-888/1-844/1-855/1-877/1-866, mobile, or international numbers) appearing anywhere in the search results—including Web Page Titles, Headlines, Search Result Summaries, Meta Descriptions, and Body Snippets.

Instructions:
1. Examine WEB PAGE TITLES, RESULT HEADLINES, and FULL WEB SUMMARIES/SNIPPETS for every search result. Scammers frequently place WhatsApp phone numbers or fake support hotlines directly inside the page title or summary header!
2. Extract EVERY distinct scam phone number mentioned in titles, summaries, or content. Do NOT stop at 1—harvest all phone numbers you find (aim for 5-15 numbers per page if available).
3. For each phone number found, output:
   - "phone": Cleanly formatted phone string (e.g. "+1 (800) 555-0199" or "+234 812 345 6789")
   - "cleanPhone": Numeric digits only including country code (e.g. "18005550199")
   - "scamType": "${item.category}"
   - "sourceUrl": Exact web page URL or "${googlePageUrl}"
   - "platform": "${item.platform}"
   - "snippet": Page Title / Summary context showing where the phone number appeared (e.g. "[Title] Love Spell Caster +234803... - [Summary] Contact on WhatsApp...")
   - "confidence": "High"

Return JSON format:
\`\`\`json
{
  "items": [
    {
      "phone": "+1 800 555 0199",
      "cleanPhone": "18005550199",
      "scamType": "${item.category}",
      "sourceUrl": "${googlePageUrl}",
      "platform": "${item.platform}",
      "snippet": "[Title: Geek Squad Refund Hotline] Contact support at +1 800 555 0199 for invoice cancellation",
      "confidence": "High"
    }
  ]
}
\`\`\`
`.trim();

          const response = await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: prompt,
            config: {
              tools: [{ googleSearch: {} }],
              temperature: 0.1,
            },
          });

          const items = safeExtractJsonItems(response.text || '');

          for (const rec of items) {
            if (!rec) continue;
            const rawPhone = rec.phone || rec.phoneNumber || '';
            const cleanPhone = (rec.cleanPhone || rawPhone.replace(/\D/g, '')).trim();

            // STRICT DEDUPLICATION: check if clean digits or phone already exist
            if (!cleanPhone || existingPhones.has(cleanPhone)) {
              continue; // Skip duplicate!
            }

            existingPhones.add(cleanPhone);

            const country = deriveCountryInfo(rawPhone);
            const sourceUrl = rec.sourceUrl || googlePageUrl;
            let domain = 'web';
            try {
              domain = new URL(sourceUrl).hostname.replace('www.', '');
            } catch (err) {
              domain = 'web';
            }

            accumulatedNewRecords.push({
              id: `rec-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              phone: rawPhone || `+1 (${cleanPhone.slice(0, 3)}) ${cleanPhone.slice(3, 6)}-${cleanPhone.slice(6)}`,
              cleanPhone,
              countryCode: country.code,
              countryName: country.name,
              scamType: rec.scamType || item.category,
              sourceUrl,
              sourceDomain: domain,
              platform: rec.platform || item.platform,
              snippet: rec.snippet || `Discovered on Page ${pageNum} in ${timeLabel.toLowerCase()} search for ${item.query}`,
              searchQuery: `${item.query} (Page ${pageNum})`,
              detectedAt: new Date().toISOString(),
              confidence: 'High' as const,
            });
          }

          // Small delay to keep rate-limiting smooth
          await delay(150);
        } catch (err) {
          // Quiet exception handling
        }
      }
    }

    // 2. Multi-page Scan & Scrape BBB Scam Tracker across multiple search queries & page offsets (from=0, from=10, from=20, from=30, from=40, etc.)
    const bbbTargets = [
      {
        topic: 'Publishers Clearing House / Sweepstakes / Million Scams',
        qParam: 'all%3Dmillion',
        category: 'Sweepstakes / Lottery Scam',
      },
      {
        topic: 'Geek Squad Tech Support Scams',
        qParam: 'all%3Dgeek%2520squad',
        category: 'Tech Support / Geek Squad Impersonation',
      },
      {
        topic: 'General Tech Support Scams',
        qParam: 'all%3Dtech',
        category: 'Tech Support Scam',
      },
      {
        topic: 'PayPal & Financial Invoice Scams',
        qParam: 'all%3Dpaypal',
        category: 'PayPal Invoice Scam',
      },
      {
        topic: 'McAfee & Antivirus Subscription Scams',
        qParam: 'all%3Dmcafee',
        category: 'McAfee / Antivirus Impersonation',
      },
    ];

    for (const target of bbbTargets) {
      for (const bbbOffset of pageOffsets) {
        const bbbPageNum = bbbOffset / 10 + 1;
        const bbbUrl = `https://www.bbb.org/scamtracker/lookupscam?q=${target.qParam}%26from%3D${bbbOffset}`;

        try {
          const bbbPrompt = `
Perform a deep crawl and report-by-report inspection of BBB Scam Tracker Page ${bbbPageNum} (offset from=${bbbOffset}):
Listing URL: ${bbbUrl}
Search Topic: BBB Scam Tracker reports for ${target.topic} (${target.category})

Instructions:
1. Access and inspect EACH individual scam report entry and result card listed on BBB Scam Tracker page ${bbbPageNum} for ${target.topic} (${timeLabel}).
2. Open/click into each individual BBB scam report detail page/entry to read the full report text, victim description, callback phone numbers, spoofed hotline numbers, or scammer contacts.
3. Extract EVERY phone number found across all individual BBB reports listed on this page (do NOT stop at 1 or 2—extract numbers from every report entry!).
4. For each phone number, extract:
   - "phone": Formatted phone string (e.g. "+1 (888) 901-2345")
   - "cleanPhone": Digits only (e.g. "18889012345")
   - "scamType": "${target.category}"
   - "sourceUrl": Specific individual BBB report URL if available, otherwise "${bbbUrl}"
   - "platform": "BBB Scam Tracker"
   - "snippet": Full quote or title from the individual BBB report showing where the phone number appeared on page ${bbbPageNum}
   - "confidence": "High"

Return JSON format:
\`\`\`json
{
  "items": [
    {
      "phone": "+1 (888) 901-2345",
      "cleanPhone": "18889012345",
      "scamType": "${target.category}",
      "sourceUrl": "${bbbUrl}",
      "platform": "BBB Scam Tracker",
      "snippet": "Individual BBB Report #10293: Scammer called claiming $500 fee, hotline +1 888 901 2345",
      "confidence": "High"
    }
  ]
}
\`\`\`
`.trim();

          const bbbResponse = await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: bbbPrompt,
            config: {
              tools: [{ googleSearch: {} }],
              temperature: 0.1,
            },
          });

          const bbbItems = safeExtractJsonItems(bbbResponse.text || '');

          for (const rec of bbbItems) {
            if (!rec) continue;
            const rawPhone = rec.phone || rec.phoneNumber || '';
            const cleanPhone = (rec.cleanPhone || rawPhone.replace(/\D/g, '')).trim();

            // STRICT DEDUPLICATION: check if phone already exists
            if (!cleanPhone || existingPhones.has(cleanPhone)) {
              continue; // Skip duplicate
            }

            existingPhones.add(cleanPhone);
            const country = deriveCountryInfo(rawPhone);

            accumulatedNewRecords.push({
              id: `rec-bbb-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              phone: rawPhone || '+1 (888) 901-2345',
              cleanPhone,
              countryCode: country.code,
              countryName: country.name,
              scamType: rec.scamType || target.category,
              sourceUrl: bbbUrl,
              sourceDomain: 'bbb.org',
              platform: 'BBB Scam Tracker',
              snippet: rec.snippet || `Reported on BBB Scam Tracker Page ${bbbPageNum} (${target.topic}).`,
              searchQuery: `BBB Scam Tracker ${target.topic} (Page ${bbbPageNum})`,
              detectedAt: new Date().toISOString(),
              confidence: 'High' as const,
            });
          }

          await delay(150);
        } catch (err) {
          // Quiet exception handling
        }
      }
    }

    // 3. Multi-page Direct Crawl & Scrape for TechScammersUnited (https://techscammersunited.com)
    const tsuTargets = [
      {
        topic: 'PayPal Scam Numbers',
        searchTerm: 'paypal',
        category: 'PayPal Invoice Scam',
        url: 'https://techscammersunited.com/search?q=paypal',
      },
      {
        topic: 'Apple / iCloud Impersonation Numbers',
        searchTerm: 'apple',
        category: 'Apple Support Impersonation',
        url: 'https://techscammersunited.com/search?q=apple',
      },
      {
        topic: 'Geek Squad Tech Support Scams',
        searchTerm: 'geek squad',
        category: 'Tech Support / Geek Squad Impersonation',
        url: 'https://techscammersunited.com/search?q=geek%20squad',
      },
      {
        topic: 'McAfee Antivirus Scam Numbers',
        searchTerm: 'mcafee',
        category: 'McAfee / Antivirus Impersonation',
        url: 'https://techscammersunited.com/search?q=mcafee',
      },
      {
        topic: 'Publishers Clearing House (PCH) Sweepstakes Scams',
        searchTerm: 'pch OR "publishers clearing house"',
        category: 'Sweepstakes / Lottery Scam',
        url: 'https://techscammersunited.com/search?q=pch',
      },
    ];

    for (const tsuTarget of tsuTargets) {
      for (const offset of pageOffsets.slice(0, 4)) { // check pages 1-4 for each TSU target topic
        const pageNum = offset / 10 + 1;
        const targetUrl = `${tsuTarget.url}&page=${pageNum}`;

        try {
          const tsuPrompt = `
Perform a deep crawl of TechScammersUnited (https://techscammersunited.com) forum threads and search results for topic: ${tsuTarget.topic} (${timeLabel}).
Target Search Page: ${targetUrl}

Instructions:
1. Access and search TechScammersUnited threads and community posts for ${tsuTarget.searchTerm} reported in the ${timeLabel}.
2. Scrape all active scammer phone numbers (toll-free 1-800/1-888/1-844/1-855/1-877/1-866, call centers, or mobile numbers) mentioned in thread titles, original posts, or member replies.
3. Extract ALL phone numbers found across threads on this page.
4. For each phone number, output:
   - "phone": Cleanly formatted phone string (e.g. "+1 (888) 551-9012")
   - "cleanPhone": Digits only (e.g. "18885519012")
   - "scamType": "${tsuTarget.category}"
   - "sourceUrl": Specific thread URL if available, otherwise "${targetUrl}"
   - "platform": "TechScammersUnited"
   - "snippet": Forum post quote or thread title showing where the phone number appeared.
   - "confidence": "High"

Return JSON format:
\`\`\`json
{
  "items": [
    {
      "phone": "+1 (888) 551-9012",
      "cleanPhone": "18885519012",
      "scamType": "${tsuTarget.category}",
      "sourceUrl": "${targetUrl}",
      "platform": "TechScammersUnited",
      "snippet": "TechScammersUnited Thread: Active ${tsuTarget.topic} call center hotline +1 888 551 9012",
      "confidence": "High"
    }
  ]
}
\`\`\`
`.trim();

          const tsuResponse = await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: tsuPrompt,
            config: {
              tools: [{ googleSearch: {} }],
              temperature: 0.1,
            },
          });

          const tsuItems = safeExtractJsonItems(tsuResponse.text || '');

          for (const rec of tsuItems) {
            if (!rec) continue;
            const rawPhone = rec.phone || rec.phoneNumber || '';
            const cleanPhone = (rec.cleanPhone || rawPhone.replace(/\D/g, '')).trim();

            if (!cleanPhone || existingPhones.has(cleanPhone)) {
              continue; // Skip duplicate
            }

            existingPhones.add(cleanPhone);
            const country = deriveCountryInfo(rawPhone);

            accumulatedNewRecords.push({
              id: `rec-tsu-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              phone: rawPhone || '+1 (888) 551-9012',
              cleanPhone,
              countryCode: country.code,
              countryName: country.name,
              scamType: rec.scamType || tsuTarget.category,
              sourceUrl: rec.sourceUrl || targetUrl,
              sourceDomain: 'techscammersunited.com',
              platform: 'TechScammersUnited',
              snippet: rec.snippet || `Reported on TechScammersUnited for ${tsuTarget.topic}.`,
              searchQuery: `site:techscammersunited.com "${tsuTarget.searchTerm}" (Page ${pageNum})`,
              detectedAt: new Date().toISOString(),
              confidence: 'High' as const,
            });
          }

          await delay(150);
        } catch (err) {
          // Quiet exception handling
        }
      }
    }

    // Merge and deduplicate with existing records
    purgeExpiredRecords();

    let addedCount = 0;
    const masterPhoneSet = new Set(scamRecordsStore.map((r) => r.cleanPhone));

    for (const newRec of accumulatedNewRecords) {
      if (!masterPhoneSet.has(newRec.cleanPhone)) {
        masterPhoneSet.add(newRec.cleanPhone);
        scamRecordsStore.unshift(newRec);
        addedCount++;
      }
    }

    lastScanTime = new Date().toISOString();
    lastScanSummary = `Scan complete (${timeLabel}). Harvested ${accumulatedNewRecords.length} records (${addedCount} new unique phone numbers added after strict deduplication).`;
    console.log(`[Harvester] ${lastScanSummary}`);

    return { newCount: addedCount, summary: lastScanSummary };
  } catch (err: any) {
    console.error('Harvester execution error:', err);
    lastScanSummary = `Scan error: ${err.message || 'Unknown error'}`;
    return { newCount: 0, summary: lastScanSummary };
  } finally {
    isScanningInProgress = false;
  }
}

// Helper to format a date specifically in Pacific Time (PST/PDT)
function formatPacificTime(dateInput: Date | string = new Date()): string {
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(date.getTime())) return String(dateInput);
    return date.toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }) + ' PST';
  } catch (e) {
    return String(dateInput);
  }
}

// Function to extract Pacific Time date and time components
function getPacificDateParts(date: Date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  let year = '', month = '', day = '', hour = 0, minute = 0;
  for (const part of parts) {
    if (part.type === 'year') year = part.value;
    if (part.type === 'month') month = part.value;
    if (part.type === 'day') day = part.value;
    if (part.type === 'hour') hour = parseInt(part.value, 10);
    if (part.type === 'minute') minute = parseInt(part.value, 10);
  }
  return { year, month, day, hour, minute, dateStr: `${year}-${month}-${day}` };
}

// Check schedule every minute: Trigger at 7:00 AM PST (07:00) and 1:00 PM PST (13:00) strictly for 24-HOUR window
let lastScheduledSlot: string | null = null;

function checkAndTriggerSchedule() {
  const { hour, minute, dateStr } = getPacificDateParts(new Date());

  // Check if Pacific time is around 07:00 PST or 13:00 PST
  if ((hour === 7 || hour === 13) && minute < 5) {
    const currentSlot = `${dateStr}_${hour}`;
    if (lastScheduledSlot !== currentSlot) {
      lastScheduledSlot = currentSlot;
      console.log(`[Schedule Trigger] Executing 24-HOUR scheduled daily scan for slot ${currentSlot} (${hour === 7 ? '7:00 AM PST' : '1:00 PM PST'})...`);
      executeFullHarvesterScan(1); // 1 day = 24 hours window for scheduled runs
    }
  }

  // Also purge any records older than 31 days
  purgeExpiredRecords();
}

// Run schedule check every 60 seconds
setInterval(checkAndTriggerSchedule, 60 * 1000);

// Run initial 31-day deep manual search on startup
setTimeout(() => {
  console.log('[Startup] Initiating immediate 31-day deep manual search...');
  executeFullHarvesterScan(31);
}, 2000);

// API Endpoints

// GET /api/records - Fetch all current records & schedule status
app.get('/api/records', (req, res) => {
  purgeExpiredRecords();

  const { hour: pstHour } = getPacificDateParts(new Date());

  // Determine next scheduled refresh time in PST (7:00 AM PST or 1:00 PM PST)
  let nextRefreshText = 'Today at 1:00 PM PST';
  if (pstHour < 7) {
    nextRefreshText = 'Today at 7:00 AM PST';
  } else if (pstHour >= 7 && pstHour < 13) {
    nextRefreshText = 'Today at 1:00 PM PST';
  } else {
    nextRefreshText = 'Tomorrow at 7:00 AM PST';
  }

  return res.json({
    success: true,
    records: scamRecordsStore,
    totalCount: scamRecordsStore.length,
    lastScanTime: lastScanTime ? formatPacificTime(lastScanTime) : null,
    lastScanSummary,
    isScanningInProgress,
    nextScheduledRefresh: nextRefreshText,
    retentionPolicy: '31 Days Auto-Purge',
  });
});

// POST /api/scan-now - Manual trigger scan (Defaults to 31-day search window or accepts windowDays in body)
app.post('/api/scan-now', async (req, res) => {
  if (isScanningInProgress) {
    return res.json({
      success: false,
      message: 'A harvester scan is currently in progress. Please wait...',
      isScanningInProgress: true,
    });
  }

  const windowDays = req.body?.windowDays === 1 ? 1 : 31; // 31 days for manual scan

  // Execute scan asynchronously
  executeFullHarvesterScan(windowDays);

  return res.json({
    success: true,
    message: `Scam harvester scan initiated for ${windowDays === 1 ? 'last 24 hours' : 'last 31 days'} across Google & BBB Scam Tracker!`,
    isScanningInProgress: true,
  });
});

// DELETE /api/records/:id - Delete single record
app.delete('/api/records/:id', (req, res) => {
  const { id } = req.params;
  scamRecordsStore = scamRecordsStore.filter((r) => r.id !== id);
  return res.json({ success: true, remaining: scamRecordsStore.length });
});

// POST /api/records/delete-bulk - Delete multiple records
app.post('/api/records/delete-bulk', (req, res) => {
  const { ids } = req.body;
  if (Array.isArray(ids)) {
    const idsSet = new Set(ids);
    scamRecordsStore = scamRecordsStore.filter((r) => !idsSet.has(r.id));
  }
  return res.json({ success: true, remaining: scamRecordsStore.length });
});

// POST /api/records/manual - Add manual entry
app.post('/api/records/manual', (req, res) => {
  const { phone, scamType, sourceUrl, platform, snippet } = req.body;
  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required.' });
  }

  const rawPhone = phone.trim();
  const cleanPhone = rawPhone.replace(/\D/g, '');

  // Check duplicate
  const exists = scamRecordsStore.some((r) => r.cleanPhone === cleanPhone);
  if (exists) {
    return res.status(400).json({ error: 'This phone number already exists in the database (No duplicates allowed).' });
  }

  const country = deriveCountryInfo(rawPhone);
  let domain = 'web';
  try {
    if (sourceUrl) domain = new URL(sourceUrl).hostname.replace('www.', '');
  } catch (e) {
    domain = 'web';
  }

  const newRecord: ScamPhoneRecord = {
    id: `rec-manual-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    phone: rawPhone,
    cleanPhone: cleanPhone || '15550000000',
    countryCode: country.code,
    countryName: country.name,
    scamType: scamType || 'Manual Verification',
    sourceUrl: sourceUrl || 'https://bbb.org',
    sourceDomain: domain,
    platform: platform || 'Manual Entry',
    snippet: snippet || 'Manually added record.',
    searchQuery: 'Manual Entry',
    detectedAt: new Date().toISOString(),
    confidence: 'High',
  };

  scamRecordsStore.unshift(newRecord);
  purgeExpiredRecords();

  return res.json({ success: true, record: newRecord });
});

async function startServer() {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
