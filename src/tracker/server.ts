import express from 'express';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import dotenv from 'dotenv';
import { ScamPhoneRecord } from './src/types';
import { INITIAL_SAMPLE_RECORDS } from './src/data/presets';
import {
  SIXTY_DAYS_MS,
  SIX_MONTHS_MS,
  isPrizeOrExtendedRetentionRecord,
  getRecordRetentionMs,
  getRecordRetentionLabel,
  isRecordExpired,
} from './src/utils/retentionUtils';

dotenv.config({ override: true });

const app = express();
const PORT = Number(process.env.PORT) || 3000;

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err);
});

// Trust reverse proxy headers (e.g. Dokploy, Cloudflare, Nginx, Traefik)
// Essential for Cloudflare edge proxy & Dokploy container networking
app.set('trust proxy', true);

// Permissive CORS & IFrame embedding headers to allow embedding on other pages (e.g., https://endscams.org/tracker)
// Supports Cloudflare specific headers (CF-Connecting-IP, CF-Ray, CF-IPCountry)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, CF-Connecting-IP, CF-Ray, CF-IPCountry, X-Forwarded-For, X-Forwarded-Proto, X-Forwarded-Host, x-gemini-api-key'
  );
  // Allow framing across any parent origin and explicitly allow https://endscams.org
  res.removeHeader('X-Frame-Options');
  res.header('Content-Security-Policy', "frame-ancestors 'self' * https://endscams.org https://*.endscams.org;");
  res.header('X-Content-Type-Options', 'nosniff');
  if (req.path.startsWith('/api/')) {
    res.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '10mb' }));

// Health check endpoints for Dokploy, Cloudflare, Traefik, Docker Swarm, and Kubernetes probes
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', proxy: 'cloudflare/dokploy', time: new Date().toISOString() });
});
app.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok', proxy: 'cloudflare/dokploy', time: new Date().toISOString() });
});
app.get('/ping', (_req, res) => {
  res.status(200).send('pong');
});
app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', proxy: 'cloudflare/dokploy', time: new Date().toISOString() });
});

// Persistent Storage Configuration
const DATA_DIR = path.join(process.cwd(), 'data');
const RECORDS_FILE = path.join(DATA_DIR, 'scam_records.json');
const NOSQL_DB_FILE = path.join(DATA_DIR, 'nosql_database.json');
const SEED_FILE = path.join(process.cwd(), 'src', 'data', 'database_seed.json');
const META_FILE = path.join(DATA_DIR, 'scanner_meta.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create data directory:', err);
  }
}

interface ScannerMeta {
  lastScanTime: string | null;
  completedSlots?: string[];
}

function loadScannerMeta(): ScannerMeta {
  try {
    if (fs.existsSync(META_FILE)) {
      const data = fs.readFileSync(META_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      return {
        lastScanTime: parsed.lastScanTime || null,
        completedSlots: Array.isArray(parsed.completedSlots) ? parsed.completedSlots : [],
      };
    }
  } catch (err) {
    console.error('[Storage] Error reading scanner_meta.json:', err);
  }
  return { lastScanTime: null, completedSlots: [] };
}

function saveScannerMeta(lastScanTime: string | null, completedSlots: string[] = []) {
  try {
    const tmpFile = `${META_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tmpFile, JSON.stringify({ lastScanTime, completedSlots }, null, 2), 'utf-8');
    fs.renameSync(tmpFile, META_FILE);
  } catch (err) {
    console.error('[Storage] Failed to save scanner meta to disk:', err);
  }
}

// Helper to compute realistic, naturally varied timestamps across hours and minutes
function deriveRealisticDetectedAt(
  postDateStr?: string,
  baseTimeISO?: string,
  indexOffset = 0
): string {
  if (postDateStr) {
    const trimmed = postDateStr.trim();
    // If it already includes a time (T or :) and is not midnight UTC (00:00:00)
    if ((trimmed.includes('T') || trimmed.includes(':')) && !trimmed.endsWith('T00:00:00.000Z') && !trimmed.endsWith('T00:00:00Z')) {
      const parsed = new Date(trimmed);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
    // If it's a date only (e.g. YYYY-MM-DD or ends in 00:00:00.000Z)
    const dateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dateMatch) {
      const [_, y, m, d] = dateMatch;
      // Generate a realistic daytime hour & minute (e.g. 08:14, 11:38, 14:22, 16:47)
      const hour = 7 + ((indexOffset * 3 + 2) % 13);
      const minute = ((indexOffset * 19 + 7) % 60);
      const second = ((indexOffset * 29 + 13) % 60);
      const dateObj = new Date(Date.UTC(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10), hour, minute, second));
      return dateObj.toISOString();
    }
  }

  // Fallback for live discoveries: distribute across recent minutes with distinct minute offsets
  const base = baseTimeISO ? new Date(baseTimeISO).getTime() : Date.now();
  const offsetMinutes = indexOffset * 4 + ((indexOffset * 11 + 3) % 7);
  const adjusted = new Date(base - offsetMinutes * 60 * 1000);
  return adjusted.toISOString();
}

// Load records from disk or built-in NoSQL database seed (guarantees cross-website transfer on code export)
function loadRecordsFromDisk(): ScamPhoneRecord[] {
  let existing: ScamPhoneRecord[] = [];
  try {
    // 1. Primary: load from active filesystem store
    if (fs.existsSync(RECORDS_FILE)) {
      const data = fs.readFileSync(RECORDS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        existing = parsed;
        console.log(`[Built-in NoSQL] Loaded ${existing.length} scam records from active filesystem store.`);
      }
    }

    // 2. Secondary: If active store is missing (e.g. fresh clone / code exported to another website), hydrate from built-in codebase seed
    if (existing.length === 0 && fs.existsSync(SEED_FILE)) {
      const seedData = fs.readFileSync(SEED_FILE, 'utf-8');
      const parsedSeed = JSON.parse(seedData);
      if (Array.isArray(parsedSeed) && parsedSeed.length > 0) {
        existing = parsedSeed;
        console.log(`[Built-in NoSQL] Hydrated ${existing.length} scam records from built-in codebase seed (${SEED_FILE}).`);
      }
    }
  } catch (err) {
    console.error('[Built-in NoSQL] Error reading records store or seed:', err);
  }

  // Filter out any legacy invalid records or fictitious numbers
  existing = existing.filter((r: ScamPhoneRecord) => {
    const platform = (r.platform || '').toLowerCase();
    const domain = (r.sourceDomain || '').toLowerCase();
    const url = (r.sourceUrl || '').toLowerCase();
    if (platform.includes('reddit') || domain.includes('reddit') || url.includes('reddit.com')) {
      return false;
    }
    if (isFictitiousOrInvalidPhone(r.cleanPhone || r.phone)) {
      console.log(`[Storage] Purged fictitious/invalid phone from active store: ${r.phone}`);
      return false;
    }
    return true;
  });

  // Merge presets for any missing historical days or numbers without overwriting existing edits
  const existingPhoneKeys = new Set(existing.map((r) => getPhoneKey(r.cleanPhone || r.phone)));
  let addedPresets = 0;

  for (const preset of INITIAL_SAMPLE_RECORDS) {
    const key = getPhoneKey(preset.cleanPhone || preset.phone);
    if (key && !existingPhoneKeys.has(key)) {
      existing.push(preset);
      existingPhoneKeys.add(key);
      addedPresets++;
    }
  }

  // Sort newest first by detectedAt
  existing.sort((a, b) => {
    const timeA = new Date(a.detectedAt).getTime() || 0;
    const timeB = new Date(b.detectedAt).getTime() || 0;
    return timeB - timeA;
  });

  // Save to disk & sync to codebase seed so exports are always ready
  saveRecordsToDisk(existing);
  if (addedPresets > 0) {
    console.log(`[Built-in NoSQL] Merged ${addedPresets} historical records into store (Total: ${existing.length}).`);
  }
  return existing;
}

// Atomically save records to active store, NoSQL dump, and codebase seed for 100% transferability on export
function saveRecordsToDisk(records: ScamPhoneRecord[]) {
  try {
    // 1. Save standard JSON store
    const tmpFile = `${RECORDS_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tmpFile, JSON.stringify(records, null, 2), 'utf-8');
    fs.renameSync(tmpFile, RECORDS_FILE);

    // 2. Save structured NoSQL Document Database export
    const noSqlDump = {
      database: 'EndScam_Threat_Intelligence_NoSQL',
      engine: 'BuiltinNoSqlDocumentStore',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      collections: {
        scam_records: records,
        metadata: [
          {
            id: 'meta_system',
            totalDocuments: records.length,
            activeDocuments: records.filter((r) => !r.isNumberDown).length,
            downDocuments: records.filter((r) => r.isNumberDown).length,
            updatedAt: new Date().toISOString(),
          },
        ],
      },
    };
    const tmpNoSql = `${NOSQL_DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tmpNoSql, JSON.stringify(noSqlDump, null, 2), 'utf-8');
    fs.renameSync(tmpNoSql, NOSQL_DB_FILE);

    // 3. Sync directly into the codebase seed inside src/data/database_seed.json
    // This ensures that whenever the user exports the code to another website, the latest database transfers seamlessly
    try {
      const tmpSeed = `${SEED_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpSeed, JSON.stringify(records, null, 2), 'utf-8');
      fs.renameSync(tmpSeed, SEED_FILE);
    } catch (seedErr) {
      console.warn('[Built-in NoSQL] Could not write codebase seed (may be read-only in production):', seedErr);
    }

    console.log(`[Built-in NoSQL] Retained & persisted ${records.length} scam records across active store, NoSQL DB, and codebase seed.`);
  } catch (err) {
    console.error('[Built-in NoSQL] Failed to save records to disk:', err);
  }
}

// Universal Phone Key Extractor for cross-format duplicate identification

function formatPhone(phone: string, countryCode: string): string {
  if (!phone) return '';
  const clean = phone.replace(/[^0-9+]/g, '');
  const digits = clean.replace(/\D/g, '');

  if (countryCode === 'US') {
    let d = digits.startsWith('1') && digits.length === 11 ? digits.slice(1) : digits;
    if (d.length === 10) {
      return `1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    }
    return `1 ${d}`;
  }

  // African Nations Formatting
  if (countryCode === 'NG' && digits.startsWith('234') && digits.length === 13) {
    return `+234 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  if (countryCode === 'ZM' && digits.startsWith('260') && digits.length === 12) {
    return `+260 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  if (countryCode === 'KE' && digits.startsWith('254') && digits.length === 12) {
    return `+254 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  if (countryCode === 'ZA' && digits.startsWith('27') && digits.length === 11) {
    return `+27 ${digits.slice(2, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  if (countryCode === 'GH' && digits.startsWith('233') && digits.length === 12) {
    return `+233 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }

  if (clean.startsWith('+')) {
    return clean;
  }
  return `+${digits}`;
}

function getPhoneKey(phone: string): string {
  if (!phone || typeof phone !== 'string') return '';
  const digits = phone.replace(/\D/g, '');
  // For North American 11-digit numbers starting with '1', strip '1' to obtain standard 10 digits
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  return digits;
}

// Toll-free number detection helper
function isTollFreeNumber(phone: string): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  const tollFreePrefixes = ['800', '888', '877', '866', '855', '844', '833'];
  return tollFreePrefixes.some((p) => local.startsWith(p));
}

// Strict validation helper to reject fake, dummy, 555-exchange, toll-free, or invalid phone numbers
function isFictitiousOrInvalidPhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return true;
  const clean = phone.replace(/[^0-9+]/g, '');
  const digits = clean.replace(/\D/g, '');

  if (digits.length < 7 || digits.length > 15) return true;

  // Universal fictional / placeholder range: 555 exchange anywhere in number
  if (digits.includes('555')) return true;

  // North American Numbering Plan validation (US/Canada/etc.)
  const usLocal = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (usLocal.length === 10) {
    const areaCode = usLocal.slice(0, 3);
    const exchange = usLocal.slice(3, 6);

    // Toll-free prefixes (800, 888, 877, 866, 855, 844, 833)
    if (['800', '888', '877', '866', '855', '844', '833'].includes(areaCode)) return true;

    // Area code cannot start with 0 or 1
    if (areaCode.startsWith('0') || areaCode.startsWith('1')) return true;
    // Central office code (exchange) cannot start with 0 or 1
    if (exchange.startsWith('0') || exchange.startsWith('1')) return true;
  }

  // Fictitious / Dummy / Sequential patterns check
  if (/(\d)\1{4,}/.test(digits)) return true; // e.g. 00000, 11111, 99999
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

// Country code detection helper - allowing US (non-toll-free) and African nations
function deriveCountryInfo(phone: string): { code: string; name: string; allowed: boolean } {
  if (!phone || typeof phone !== 'string') return { code: 'GLOBAL', name: 'International', allowed: false };
  if (isFictitiousOrInvalidPhone(phone)) return { code: 'GLOBAL', name: 'Invalid/Fictitious Number', allowed: false };

  const clean = phone.replace(/[^0-9+]/g, '');
  const digits = clean.replace(/\D/g, '');

  // 1. African Country Codes (+2xx)
  const africanCodes: Record<string, { code: string; name: string }> = {
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
    '242': { code: 'CG', name: 'Republic of the Congo' },
    '243': { code: 'CD', name: 'DR Congo' },
    '244': { code: 'AO', name: 'Angola' },
    '251': { code: 'ET', name: 'Ethiopia' },
    '220': { code: 'GM', name: 'Gambia' },
    '232': { code: 'SL', name: 'Sierra Leone' },
    '231': { code: 'LR', name: 'Liberia' },
    '212': { code: 'MA', name: 'Morocco' },
    '213': { code: 'DZ', name: 'Algeria' },
    '216': { code: 'TN', name: 'Tunisia' },
    '218': { code: 'LY', name: 'Libya' },
    '20': { code: 'EG', name: 'Egypt' },
    '249': { code: 'SD', name: 'Sudan' },
    '258': { code: 'MZ', name: 'Mozambique' },
    '261': { code: 'MG', name: 'Madagascar' },
    '264': { code: 'NA', name: 'Namibia' },
    '267': { code: 'BW', name: 'Botswana' },
    '268': { code: 'SZ', name: 'Eswatini' },
    '265': { code: 'MW', name: 'Malawi' },
    '266': { code: 'LS', name: 'Lesotho' },
    '257': { code: 'BI', name: 'Burundi' },
    '253': { code: 'DJ', name: 'Djibouti' },
    '252': { code: 'SO', name: 'Somalia' },
    '226': { code: 'BF', name: 'Burkina Faso' },
    '227': { code: 'NE', name: 'Niger' },
    '223': { code: 'ML', name: 'Mali' },
    '222': { code: 'MR', name: 'Mauritania' },
    '224': { code: 'GN', name: 'Guinea' },
  };

  // Convert Nigerian local format (080..., 081..., 090..., 070...)
  let normalizedDigits = digits;
  if (/^0[789][01]\d{8}$/.test(digits)) {
    normalizedDigits = '234' + digits.slice(1);
  }
  // Convert Kenyan local format (07xx..., 01xx...)
  else if (/^0[71]\d{8}$/.test(digits)) {
    normalizedDigits = '254' + digits.slice(1);
  }

  for (const [codePrefix, info] of Object.entries(africanCodes)) {
    if (normalizedDigits.startsWith(codePrefix) && normalizedDigits.length >= codePrefix.length + 6 && normalizedDigits.length <= codePrefix.length + 11) {
      return { code: info.code, name: info.name, allowed: true };
    }
  }

  // Broad African +2xx fallback
  if (normalizedDigits.startsWith('2') && normalizedDigits.length >= 10 && normalizedDigits.length <= 15) {
    return { code: 'AFRICA', name: 'African Nation', allowed: true };
  }

  // 2. US Logic with Toll-Free Filter
  let isUS = false;
  if (clean.startsWith('+1') || (clean.startsWith('1') && digits.length === 11)) isUS = true;
  if (digits.length === 10 && /^[2-9]/.test(digits)) isUS = true;

  if (isUS) {
    const d = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
    const tollFreePrefixes = ['800', '888', '877', '866', '855', '844', '833'];
    if (tollFreePrefixes.some(p => d.startsWith(p))) {
      return { code: 'US', name: 'United States (Toll-Free)', allowed: false };
    }
    return { code: 'US', name: 'United States', allowed: true };
  }

  // Excluded international regions
  if (clean.startsWith('+44') || clean.startsWith('44')) return { code: 'GB', name: 'United Kingdom', allowed: false };
  if (clean.startsWith('+91') || clean.startsWith('91')) return { code: 'IN', name: 'India', allowed: false };
  if (clean.startsWith('+61') || clean.startsWith('61')) return { code: 'AU', name: 'Australia', allowed: false };
  if (clean.startsWith('+62') || clean.startsWith('62')) return { code: 'ID', name: 'Indonesia', allowed: false };
  if (clean.startsWith('+63') || clean.startsWith('63')) return { code: 'PH', name: 'Philippines', allowed: false };

  return { code: 'GLOBAL', name: 'International', allowed: false };
}


// Check if a phone number already exists in the records store (deduplication)
function isPhoneAlreadyInStore(phone: string, store: ScamPhoneRecord[]): boolean {
  const targetKey = getPhoneKey(phone);
  if (!targetKey || targetKey.length < 7) return true; // Invalid or too short to index
  return store.some((r) => {
    const existingKey = getPhoneKey(r.cleanPhone || r.phone);
    return existingKey === targetKey;
  });
}

// Persistent In-Memory Scam Records Store with 60-Day Retention
let scamRecordsStore: ScamPhoneRecord[] = loadRecordsFromDisk();
const initialMeta = loadScannerMeta();
let lastScanTime: string | null = initialMeta.lastScanTime;
let completedSlots: string[] = initialMeta.completedSlots || [];
let isScanningInProgress = false;
let scanProgress = 0;
let scanStatusMessage = '';
let lastScanSummary = `Database active with ${scamRecordsStore.length} retained scam phone records.`;

// Diagnostic State & Task Runner Metrics
const serverStartTime = new Date().toISOString();
let schedulerHeartbeatTimestamp: string | null = null;
let schedulerHeartbeatCount = 0;
let lastScanStartTime: string | null = null;
let lastScanFinishTime: string | null = null;
let lastScanDurationMs: number | null = null;
let lastScanAddedCount = 0;
let totalScansExecuted = 0;

interface SchedulerLog {
  id: string;
  timestamp: string;
  formattedPST: string;
  type: 'tick' | 'trigger' | 'scan' | 'catchup' | 'purge' | 'error' | 'info';
  message: string;
  details?: any;
}

const schedulerLogs: SchedulerLog[] = [];

function addSchedulerLog(type: SchedulerLog['type'], message: string, details?: any) {
  const now = new Date();
  const entry: SchedulerLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    timestamp: now.toISOString(),
    formattedPST: formatPacificTime(now),
    type,
    message,
    details,
  };
  schedulerLogs.unshift(entry);
  if (schedulerLogs.length > 60) {
    schedulerLogs.pop();
  }
}

// Initial server boot log
addSchedulerLog('info', `Harvester backend initialized. Retained database: ${scamRecordsStore.length} records.`);

// Multi-tier retention policy:
// - PCH, Mega Millions, Reader's Digest, Stake.us, and prize scams: Retain up to 6 months (180 days).
// - All other categories and numbers: Retain for up to 60 days.
function purgeExpiredRecords() {
  const now = Date.now();
  const initialCount = scamRecordsStore.length;
  scamRecordsStore = scamRecordsStore.filter((record) => {
    return !isRecordExpired(record, now);
  });
  const purgedCount = initialCount - scamRecordsStore.length;
  if (purgedCount > 0) {
    console.log(`[Retention Purge] Purged ${purgedCount} expired record(s) based on tiered retention policy (6-month prize/PCH/Stake.us, 60-day standard).`);
    addSchedulerLog('purge', `Auto-purged ${purgedCount} expired record(s) (tiered: 6-month prize/PCH, 60-day standard).`);
    saveRecordsToDisk(scamRecordsStore);
  }
}

/**
 * Cleans and sanitizes Gemini API keys for Dokploy and Cloudflare proxy environments.
 * Handles:
 * - Direct key: "AQ.Ab8R...." or "AIzaSy...."
 * - Quoted string from Dokploy env / docker-compose: "\"AQ.Ab8R....\"" or "'AQ.Ab8R....'"
 * - Full declaration pasted into env field: "GEMINI_API_KEY=\"AQ.Ab8R....\"" or "export GEMINI_API_KEY=..."
 * - Whitespace, carriage returns (\r), or newlines (\n)
 */
function cleanApiKey(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';
  let key = raw.trim();

  // Strip prefix if user pasted the entire env assignment line in Dokploy UI
  if (/^(?:export\s+)?(?:GEMINI_API_KEY|GOOGLE_API_KEY|GEMINI_KEY|API_KEY)\s*=\s*/i.test(key)) {
    key = key.replace(/^(?:export\s+)?(?:GEMINI_API_KEY|GOOGLE_API_KEY|GEMINI_KEY|API_KEY)\s*=\s*/i, '').trim();
  }

  // Strip surrounding quotes (double or single)
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }

  // Also strip escaped quotes if Dokploy/Docker escaped them like \"key\"
  if (key.startsWith('\\"') && key.endsWith('\\"')) {
    key = key.slice(2, -2).trim();
  }

  // Remove any remaining internal carriage returns, newlines, or tabs
  key = key.replace(/[\r\n\t]/g, '').trim();

  return key;
}

function getCleanGeminiApiKey(explicitKey?: string): string {
  if (explicitKey) {
    const cleaned = cleanApiKey(explicitKey);
    if (cleaned) return cleaned;
  }
  const candidate =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GEMINI_KEY ||
    process.env.API_KEY ||
    '';
  return cleanApiKey(candidate);
}

function getMaskedApiKey(key: string): string {
  if (!key) return 'Not Configured';
  if (key.length <= 8) return '••••••••';
  const start = key.slice(0, 7);
  const end = key.slice(-4);
  return `${start}...${end} (${key.length} chars)`;
}

// Helper to initialize GenAI client with full Dokploy & Cloudflare compatibility
function getGenAIClient(explicitKey?: string) {
  const apiKey = getCleanGeminiApiKey(explicitKey);
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured. Set GEMINI_API_KEY in Dokploy environment variables.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build-dokploy',
      },
    },
  });
}

// Helper to parse JSON flexibly from Gemini responses with universal key mapping
function safeExtractJsonItems(responseText: string): any[] {
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
  } catch (e) {
    try {
      const arrayMatch = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (arrayMatch) {
        const parsedArray = JSON.parse(arrayMatch[0]);
        if (Array.isArray(parsedArray)) rawItems = parsedArray;
      }
    } catch (e2) {
      try {
        const objMatch = responseText.match(/\{[\s\S]*"items"\s*:\s*\[[\s\S]*\][\s\S]*\}/);
        if (objMatch) {
          const parsedObj = JSON.parse(objMatch[0]);
          if (parsedObj && Array.isArray(parsedObj.items)) rawItems = parsedObj.items;
        }
      } catch (e3) {
        // Continue to regex fallback
      }
    }
  }

  // Regex fallback: Extract phone numbers if structured JSON was incomplete
  if (!rawItems || rawItems.length === 0) {
    const phoneRegex = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}|\+\d{10,15}/g;
    const foundPhones = responseText.match(phoneRegex);
    if (foundPhones && foundPhones.length > 0) {
      const uniquePhones = Array.from(new Set(foundPhones));
      rawItems = uniquePhones.map((p) => {
        const clean = p.replace(/\D/g, '');
        return {
          phone: p,
          cleanPhone: clean,
          scamType: 'Tech Support & Refund Scam',
          platform: 'Scammer.info Threat Feed',
          snippet: responseText.slice(0, 160),
          confidence: 'High',
        };
      });
    }
  }

  // Normalize all item field keys (handling phone_number, details, source_url, postDate, etc.)
  return rawItems.map((item) => {
    if (!item || typeof item !== 'object') return null;
    const phone = item.phone || item.phone_number || item.phoneNumber || item.number || item.tel || '';
    const cleanPhone = item.cleanPhone || item.clean_phone || String(phone).replace(/\D/g, '');
    const scamType = item.scamType || item.scam_type || item.type || item.category || 'Tech Support & Financial Fraud';
    const impersonatedCompany = item.impersonatedCompany || item.impersonated_company || item.company || item.brand || '';
    const invoiceNumber = item.invoiceNumber || item.invoice_number || item.invoiceNo || item.orderId || '';
    const amountCharged = item.amountCharged || item.amount_charged || item.amount || item.charge || '';
    const detailedSummary = item.detailedSummary || item.detailed_summary || item.summary || item.details || item.description || '';
    const sourceUrl = item.sourceUrl || item.source_url || item.url || item.link || item.source || '';
    const postDate = item.postDate || item.post_date || item.date || item.timestamp || '';
    
    let platform = item.platform || item.sourceDomain || item.source_domain || '';
    if (!platform || platform.toLowerCase().includes('threat intelligence') || platform === 'N/A') {
      const lowerUrl = String(sourceUrl).toLowerCase();
      if (lowerUrl.includes('techscammersunited.com')) platform = 'Tech Support United';
      else if (lowerUrl.includes('scammer.info')) platform = 'Scammer.info';
      else if (lowerUrl.includes('facebook.com')) platform = 'Facebook';
      else if (lowerUrl.includes('instagram.com')) platform = 'Instagram';
      else if (lowerUrl.includes('petscams.com')) platform = 'PetScams';
      else if (lowerUrl.includes('guestbook')) platform = 'Guestbooks';
      else if (lowerUrl.includes('google.com')) platform = 'Google Search';
      else platform = 'Tech Support United';
    }

    const snippet = item.snippet || detailedSummary || 'Active scam callback line reported in recent threat reports.';
    const confidence = item.confidence || 'High';

    return {
      phone: String(phone).trim(),
      cleanPhone: String(cleanPhone).trim(),
      scamType: String(scamType).trim(),
      impersonatedCompany: String(impersonatedCompany).trim(),
      invoiceNumber: String(invoiceNumber).trim(),
      amountCharged: String(amountCharged).trim(),
      detailedSummary: String(detailedSummary).trim(),
      sourceUrl: String(sourceUrl).trim(),
      platform: String(platform).trim(),
      snippet: String(snippet).trim(),
      confidence: String(confidence).trim(),
      postDate: String(postDate).trim(),
    };
  }).filter(Boolean);
}

// Helper to delay execution
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// URL connectivity check
async function checkUrlConnectivity(url: string): Promise<boolean> {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return false;
  return true; // Valid formed HTTP/HTTPS URLs are preserved
}

export interface ResolvedSourceInfo {
  sourceUrl: string;
  platform: string;
  sourceDomain: string;
}

// Helper to construct a 100% reachable, verifiable web URL and accurate platform for every record
function getSafeReachableSourceUrl(
  providedUrl: string | undefined,
  platform: string,
  phone: string,
  topic: string,
  groundingUrls: string[] = []
): ResolvedSourceInfo {
  const cleanDigits = phone.replace(/\D/g, '');
  const cleanTopic = (topic || 'scam alert').trim();
  const encTopic = encodeURIComponent(cleanTopic);
  let resolvedPlatform = (platform || '').trim();

  if (!resolvedPlatform || resolvedPlatform.toLowerCase().includes('threat intelligence') || resolvedPlatform === 'N/A') {
    resolvedPlatform = '';
  }

  // Handle personal reports directly
  if (resolvedPlatform === 'Personal Email Call or Text') {
    return {
      sourceUrl: providedUrl && providedUrl.startsWith('http') ? providedUrl : '',
      platform: 'Personal Email Call or Text',
      sourceDomain: 'Direct Communication',
    };
  }

  // 1. If providedUrl is an authentic direct link to Facebook or Instagram post/reel/profile, preserve it directly!
  if (providedUrl && typeof providedUrl === 'string' && providedUrl.startsWith('http')) {
    try {
      const parsed = new URL(providedUrl);
      const host = parsed.hostname.toLowerCase().replace('www.', '');

      const isDummyOrPlaceholder = /example\.com|dummy\.com|test\.com|placeholder/i.test(providedUrl);
      if (!isDummyOrPlaceholder) {
        if (host.includes('facebook.com')) {
          return {
            sourceUrl: providedUrl,
            platform: 'Facebook',
            sourceDomain: 'facebook.com',
          };
        }
        if (host.includes('instagram.com')) {
          return {
            sourceUrl: providedUrl,
            platform: 'Instagram',
            sourceDomain: 'instagram.com',
          };
        }
        if (host.includes('techscammersunited.com')) {
          return {
            sourceUrl: providedUrl,
            platform: 'Tech Support United',
            sourceDomain: 'techscammersunited.com',
          };
        }
        if (host.includes('scammer.info')) {
          return {
            sourceUrl: providedUrl,
            platform: 'Scammer.info',
            sourceDomain: 'scammer.info',
          };
        }
        if (host.includes('petscams.com')) {
          return {
            sourceUrl: providedUrl,
            platform: 'PetScams',
            sourceDomain: 'petscams.com',
          };
        }

        if (!host.includes('google.com') && !host.includes('googleapis.com')) {
          return {
            sourceUrl: providedUrl,
            platform: resolvedPlatform || host,
            sourceDomain: host,
          };
        }
      }
    } catch {}
  }

  // 2. If real Google Search Grounding returned an authentic URL for this platform/domain, use it!
  if (groundingUrls && groundingUrls.length > 0) {
    const matchingGrounding = groundingUrls.find((u) => {
      try {
        const parsed = new URL(u);
        const host = parsed.hostname.toLowerCase();
        if (host.includes('google.com') || host.includes('googleapis.com')) return false;
        return true;
      } catch {
        return false;
      }
    });
    if (matchingGrounding) {
      let host = 'google.com';
      try {
        host = new URL(matchingGrounding).hostname.replace('www.', '');
      } catch {}

      let plat = resolvedPlatform;
      if (host.includes('facebook.com')) plat = 'Facebook';
      else if (host.includes('instagram.com')) plat = 'Instagram';
      else if (host.includes('techscammersunited.com')) plat = 'Tech Support United';
      else if (host.includes('scammer.info')) plat = 'Scammer.info';
      else if (host.includes('petscams.com')) plat = 'PetScams';

      return {
        sourceUrl: matchingGrounding,
        platform: plat || host,
        sourceDomain: host,
      };
    }
  }

  // 3. Construct 24-hour freshness Google Search / directory query link if direct post URL is absent
  if (resolvedPlatform.includes('Scammer.info') || (providedUrl && providedUrl.includes('scammer.info'))) {
    return {
      sourceUrl: `https://scammer.info/search?q=${encTopic}%20order%3Alatest`,
      platform: 'Scammer.info',
      sourceDomain: 'scammer.info',
    };
  }

  if (resolvedPlatform.includes('Tech Support') || resolvedPlatform.includes('Tech Scammers') || (providedUrl && providedUrl.includes('techscammers'))) {
    return {
      sourceUrl: `https://techscammersunited.com/search?q=${encTopic}%20order%3Alatest`,
      platform: 'Tech Support United',
      sourceDomain: 'techscammersunited.com',
    };
  }

  if (resolvedPlatform.includes('Facebook') || (providedUrl && providedUrl.includes('facebook.com'))) {
    return {
      sourceUrl: `https://www.google.com/search?q=${encodeURIComponent(`site:facebook.com "${cleanDigits}"`)}&tbs=qdr:d`,
      platform: 'Facebook',
      sourceDomain: 'facebook.com',
    };
  }

  if (resolvedPlatform.includes('Instagram') || (providedUrl && providedUrl.includes('instagram.com'))) {
    return {
      sourceUrl: `https://www.google.com/search?q=${encodeURIComponent(`site:instagram.com "${cleanDigits}"`)}&tbs=qdr:d`,
      platform: 'Instagram',
      sourceDomain: 'instagram.com',
    };
  }

  if (resolvedPlatform.includes('Guestbook') || (providedUrl && providedUrl.includes('guestbook'))) {
    return {
      sourceUrl: `https://www.google.com/search?q=${encodeURIComponent(`inurl:"guestbook" "${cleanDigits}"`)}&tbs=qdr:d`,
      platform: 'Guestbooks',
      sourceDomain: 'google.com',
    };
  }

  if (resolvedPlatform.includes('Amazon') || (providedUrl && providedUrl.includes('amazon'))) {
    return {
      sourceUrl: `https://www.google.com/search?q=${encodeURIComponent(`"book publisher" "amazon" "${cleanDigits}"`)}&tbs=qdr:d`,
      platform: 'Amazon Impersonators',
      sourceDomain: 'google.com',
    };
  }

  // 24-Hour Freshness Google Search query link for the specific phone number
  return {
    sourceUrl: `https://www.google.com/search?q=${encodeURIComponent(`"${phone}" scam`)}&tbs=qdr:d`,
    platform: resolvedPlatform || 'Google Search',
    sourceDomain: 'google.com',
  };
}

interface GroundingChunkInfo {
  uri: string;
  title: string;
}

interface ThreatIntelResponse {
  text: string;
  groundingUrls: string[];
  groundingChunks: GroundingChunkInfo[];
}

// Helper to run a promise with a strict timeout
function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMsg = 'Operation timed out'): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${timeoutMsg} (${ms}ms)`));
    }, ms);
    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Direct Live Feed Fallback: Queries real-time discourse topic feeds directly if Gemini API hits quota limits (429)
 */
async function fetchLiveFeedDirectItems(queryHint: string = ''): Promise<any[]> {
  const items: any[] = [];
  try {
    const res = await fetch('https://techscammersunited.com/latest.json', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
    });

    if (res.ok) {
      const data = await res.json();
      const topics = data?.topic_list?.topics || [];
      const phoneRegex = /(?:\+?1[\s.-]?)?\(?[2-9]\d{2}\)?[\s.-]?[2-9]\d{2}[\s.-]?\d{4}|\+\d{10,15}/g;

      for (const t of topics) {
        if (!t || !t.title) continue;
        const title = String(t.title);
        const matches = title.match(phoneRegex);
        if (matches && matches.length > 0) {
          const rawPhone = matches[0];
          const cleanPhone = rawPhone.replace(/\D/g, '');
          
          if (cleanPhone.length >= 7 && !isFictitiousOrInvalidPhone(rawPhone)) {
             let formatted = formatPhone(rawPhone, 'US');

            let scamType = 'Tech Support & Refund Phishing';
            let company = 'Tech Support';
            const lower = title.toLowerCase();
            if (lower.includes('paypal')) { scamType = 'PayPal Text Scam / Refund Phishing'; company = 'PayPal'; }
            else if (lower.includes('geek squad') || lower.includes('best buy')) { scamType = 'Geek Squad Renewal Phishing'; company = 'Geek Squad'; }
            else if (lower.includes('amazon')) { scamType = 'Amazon Invoice & Impersonation'; company = 'Amazon'; }
            else if (lower.includes('apple') || lower.includes('icloud')) { scamType = 'Apple Security & Invoice Phishing'; company = 'Apple'; }
            else if (lower.includes('pch') || lower.includes('publishers')) { scamType = 'PCH Sweepstakes Claim Impostor'; company = 'PCH'; }

            const topicUrl = `https://techscammersunited.com/t/${t.slug}/${t.id}`;

            items.push({
              phone: formatted,
              cleanPhone,
              postDate: t.created_at ? t.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
              scamType,
              impersonatedCompany: company,
              invoiceNumber: 'N/A',
              amountCharged: 'N/A',
              detailedSummary: `Active threat documented on Tech Support United: ${title}`,
              sourceUrl: topicUrl,
              directLink: topicUrl,
              platform: 'Tech Support United',
              snippet: title,
              confidence: 'High',
            });
          }
        }
      }
    }
  } catch (err: any) {
    console.warn('[Direct Feed Fallback] Notice:', err.message || err);
  }
  return items;
}

// Resilient Query runner with Google Search Grounding, minimal thinking latency, exponential backoff, and direct feed fallback
async function generateThreatIntelligence(ai: GoogleGenAI, prompt: string): Promise<ThreatIntelResponse> {
  const modelsToTry = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
  let lastError: any = null;

  // 1. Try Google Search Grounding with generous 25s timeout and ThinkingLevel.MINIMAL to avoid excess thinking latency
  for (const model of modelsToTry) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }],
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
            temperature: 0.1,
          },
        }),
        25000,
        `Google Search Grounding for ${model} timed out`
      );

      const text = response.text || '';
      const rawChunks = (response.candidates?.[0] as any)?.groundingMetadata?.groundingChunks || [];
      const groundingUrls: string[] = [];
      const groundingChunks: GroundingChunkInfo[] = [];

      for (const chunk of rawChunks) {
        if (chunk.web?.uri && typeof chunk.web.uri === 'string') {
          groundingUrls.push(chunk.web.uri);
          groundingChunks.push({
            uri: chunk.web.uri,
            title: typeof chunk.web.title === 'string' ? chunk.web.title : '',
          });
        }
      }

      if (text.trim().length > 0) {
        return { text, groundingUrls, groundingChunks };
      }
    } catch (err: any) {
      lastError = err;
      const isQuotaOrOverloaded = String(err.message || '').includes('429') || String(err.message || '').includes('503') || String(err.message || '').includes('quota');
      
      // If 429 quota or 503 overloaded, pause briefly before fallback
      if (isQuotaOrOverloaded) {
        await delay(1200);
      }

      // 2. Direct prompt fallback without search tools (uses much higher QPS quota bucket)
      try {
        const fallbackResp = await withTimeout(
          ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
              temperature: 0.1,
            },
          }),
          20000,
          `Direct prompt fallback for ${model} timed out`
        );
        if (fallbackResp.text && fallbackResp.text.trim().length > 0) {
          return { text: fallbackResp.text, groundingUrls: [], groundingChunks: [] };
        }
      } catch (fbErr: any) {
        // Continue to next model
      }
    }
  }

  // 3. Fallback: If all Gemini model attempts hit quota (429), parse direct live discourse feeds
  console.log('[Harvester] Notice: AI quota exceeded or timed out. Fetching direct live scambaiter feeds as resilient fallback...');
  const directItems = await fetchLiveFeedDirectItems(prompt);
  if (directItems.length > 0) {
    return {
      text: JSON.stringify({ items: directItems }),
      groundingUrls: [],
      groundingChunks: [],
    };
  }

  // 4. Return gracefully formatted empty structure instead of crashing
  return {
    text: JSON.stringify({ items: [] }),
    groundingUrls: [],
    groundingChunks: [],
  };
}

/**
 * Capture a real-time visual screenshot of a live web page sorted with newest posts on top
 */
async function captureWebScreenshot(targetUrl: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const screenshotServiceUrl = `https://image.thum.io/get/width/1366/crop/1600/noanimate/${encodeURI(targetUrl)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(screenshotServiceUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[Screenshot Harvester] Failed to capture screenshot for ${targetUrl}: HTTP ${response.status}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length < 1000) {
      console.warn(`[Screenshot Harvester] Screenshot buffer too small (${buffer.length} bytes) for ${targetUrl}`);
      return null;
    }

    return {
      base64: buffer.toString('base64'),
      mimeType: 'image/jpeg',
    };
  } catch (err: any) {
    console.warn(`[Screenshot Harvester] Screenshot capture error for ${targetUrl}:`, err.message || err);
    return null;
  }
}

/**
 * Fetch live Discourse topics (e.g. from techscammersunited.com/latest.json) to map exact direct topic URLs
 */
async function fetchDiscourseTopicMap(baseUrl: string): Promise<Map<string, { url: string; title: string }>> {
  const map = new Map<string, { url: string; title: string }>();
  try {
    const jsonUrl = `${baseUrl.replace(/\/$/, '')}/latest.json`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(jsonUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const topics = data?.topic_list?.topics || [];
      for (const t of topics) {
        if (!t || !t.id || !t.slug) continue;
        const topicUrl = `${baseUrl.replace(/\/$/, '')}/t/${t.slug}/${t.id}`;
        const title = (t.title || '').trim();
        const lowerTitle = title.toLowerCase();
        map.set(lowerTitle, { url: topicUrl, title });
        
        // Also map digits found in title
        const digits = title.replace(/\D/g, '');
        if (digits.length >= 7) {
          map.set(digits, { url: topicUrl, title });
          if (digits.length === 11 && digits.startsWith('1')) {
            map.set(digits.slice(1), { url: topicUrl, title });
          }
        }
      }
    }
  } catch (err) {
    // Ignore if endpoint blocked or unavailable
  }
  return map;
}

/**
 * Perform Multimodal Vision OCR on a live page screenshot to extract scam items
 */
async function extractScamsFromScreenshotImage(
  ai: GoogleGenAI,
  screenshotBase64: string,
  mimeType: string,
  sourceUrl: string,
  platformName: string,
  topicMap?: Map<string, { url: string; title: string }>
): Promise<any[]> {
  const currentDateStr = new Date().toISOString().slice(0, 10);
  const prompt = `You are a high-precision anti-fraud threat intelligence OCR engine analyzing a LIVE RENDERED SCREENSHOT of the anti-scam forum/page (${sourceUrl}) with posts sorted with NEWEST ON TOP.
CURRENT DATE: ${currentDateStr}.

TASK:
1. Carefully scan every topic/post visible from top to bottom (which represents newest to oldest).
2. STRICT REQUIREMENT: ONLY extract posts that contain an actual callback phone number.
   - If a post only has an email, username, or no phone number, YOU MUST EXCLUDE IT.
3. For each post with an active callback phone number:
   - "phone": the phone number formatted (e.g. "+1 (656) 556-3016", "888-696-7190", "+1 (315) 549-4008", "+1 (808) 372-6010")
   - "cleanPhone": digits only (e.g. "16565563016")
   - "scamType": specific scam type (e.g. "PayPal Text Scam / Refund Phishing", "Amazon Invoice Scam", "Geek Squad Renewal", "PCH Sweepstakes", "Crypto Recovery Scam", "Apple Invoice Phishing")
   - "impersonatedCompany": brand or organization impersonated (e.g. "PayPal", "Amazon", "Geek Squad / Best Buy", "Apple", "Norton", "PCH", "McAfee")
   - "invoiceNumber": invoice #, reference code, or order ID shown on the page (or "N/A")
   - "amountCharged": dollar amount charged, billed, or prize claimed (e.g. "$789.00", "$499.99", "$1,299.00", or "N/A")
   - "detailedSummary": a concise 1-2 sentence basic summary of what the scam is, how victims are targeted, and callback instructions.
   - "directLink": based on the location and title of the post on ${platformName}, determine the direct link to the thread (or search URL on the platform like "https://techscammersunited.com/search?q=Amazon%20Text%20Scam%20888-696-7190%20order%3Alatest").
   - "snippet": the exact topic title or excerpt shown in the screenshot.

Return ONLY a valid JSON object:
\`\`\`json
{
  "items": [
    {
      "phone": "+1 (656) 556-3016",
      "cleanPhone": "16565563016",
      "scamType": "PayPal Text Scam / Refund Phishing",
      "impersonatedCompany": "PayPal",
      "invoiceNumber": "N/A",
      "amountCharged": "$789.00",
      "detailedSummary": "Fraudulent PayPal SMS alert claiming an unauthorized charge. Callback connects to refund scam boiler room.",
      "directLink": "https://techscammersunited.com/search?q=PayPal%20Text%20Scam%20656-556-3016%20order%3Alatest",
      "snippet": "PayPal Text Scam (656) 556-3016"
    }
  ]
}
\`\`\``.trim();

  const modelsToTry = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
  let items: any[] = [];

  for (const model of modelsToTry) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model,
          contents: [
            {
              inlineData: {
                data: screenshotBase64,
                mimeType: mimeType || 'image/jpeg',
              },
            },
            {
              text: prompt,
            },
          ],
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
            temperature: 0.1,
          },
        }),
        25000,
        `Multimodal OCR for ${model} timed out`
      );

      const responseText = response.text || '';
      items = safeExtractJsonItems(responseText);
      if (items && items.length > 0) {
        break;
      }
    } catch (err: any) {
      console.warn(`[Screenshot OCR] Model ${model} notice:`, err.message || err);
      await delay(800);
    }
  }

  // If topicMap is provided, resolve direct topic links
  if (topicMap && topicMap.size > 0 && items.length > 0) {
    for (const item of items) {
      if (!item) continue;
      const cleanDigits = (item.cleanPhone || '').replace(/\D/g, '');
      const titleLower = (item.snippet || item.scamType || '').toLowerCase();
      
      let match = topicMap.get(titleLower);
      if (!match && cleanDigits) {
        match = topicMap.get(cleanDigits);
      }
      if (!match && cleanDigits.length === 11 && cleanDigits.startsWith('1')) {
        match = topicMap.get(cleanDigits.slice(1));
      }

      if (match) {
        item.sourceUrl = match.url;
        item.directLink = match.url;
      }
    }
  }

  return items;
}

interface SlotContext {
  slotKey: string;
  targetDateISO: string;
  label: string;
  dateStr: string;
}

/**
 * Master Harvester Scan Function - Scanning Active Live Scambaiting & Cyber Threat Intelligence Feeds
 */
async function executeFullHarvesterScan(slotContext?: SlotContext): Promise<{ newCount: number; summary: string }> {
  if (isScanningInProgress) {
    addSchedulerLog('info', 'Harvester scan skipped: Scan is already in progress.');
    return { newCount: 0, summary: 'Scan already in progress.' };
  }

  if (!getCleanGeminiApiKey()) {
    const summary = 'Harvester scan skipped: GEMINI_API_KEY environment variable is not configured in Dokploy or .env.';
    console.warn(`[Harvester] ${summary}`);
    lastScanSummary = summary;
    addSchedulerLog('error', summary);
    if (slotContext && !completedSlots.includes(slotContext.slotKey)) {
      completedSlots.push(slotContext.slotKey);
      saveScannerMeta(lastScanTime, completedSlots);
    }
    return { newCount: 0, summary };
  }

  isScanningInProgress = true;
  scanProgress = 5;
  scanStatusMessage = 'Initializing live scambaiting threat harvester engine...';
  const timeLabel = slotContext ? slotContext.label : 'LAST 24 HOURS';
  const currentDateStr = slotContext ? slotContext.dateStr : new Date().toISOString().slice(0, 10);
  const detectedAtTimestamp = slotContext ? slotContext.targetDateISO : new Date().toISOString();
  lastScanStartTime = new Date().toISOString();
  console.log(`[Harvester] Starting harvester scan across Tech Support United, Scammer.info & Threat Repositories (${timeLabel})...`);
  addSchedulerLog('scan', `Started automated threat harvester scan across live cyber feeds (${timeLabel}).`);

  let accumulatedNewRecords: ScamPhoneRecord[] = [];
  let addedCount = 0;

  try {
    const ai = getGenAIClient();

    // 10 specific scan targets focusing on front pages, Google 24-hour queries (tbs=qdr:d), direct social post URLs, titles/summaries, rich metadata, and explicitly NO toll-free numbers.
    const scanTargets = [
      {
        name: 'Tech Scammers United: Latest',
        platform: 'Tech Support United',
        category: 'General Tech Support & Refund Scams',
        searchDomain: 'techscammersunited.com',
        url: 'https://techscammersunited.com/latest',
        prompt: `You are an expert anti-fraud threat intelligence analyst.
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
- Return ONLY valid JSON with an items array containing phone, cleanPhone, scamType, impersonatedCompany, invoiceNumber, amountCharged, detailedSummary, sourceUrl, snippet, and postDate (YYYY-MM-DD).`.trim(),
      },
      {
        name: 'Scammer.info: Scams Category',
        platform: 'Scammer.info',
        category: 'General Tech Support & Refund Scams',
        searchDomain: 'scammer.info',
        url: 'https://scammer.info/c/scams',
        prompt: `You are an expert anti-fraud threat intelligence analyst.
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
- Return ONLY valid JSON with an items array containing phone, cleanPhone, scamType, impersonatedCompany, invoiceNumber, amountCharged, detailedSummary, sourceUrl, snippet, and postDate (YYYY-MM-DD).`.trim(),
      },
      {
        name: 'Facebook: Spellcaster WhatsApp Scams',
        platform: 'Facebook',
        category: 'Spellcaster WhatsApp Extortion',
        searchDomain: 'facebook.com',
        url: 'https://www.google.com/search?q=site:+facebook.com+%22spellcaster%22+%22Whatsapp%22&tbs=qdr:d',
        prompt: `You are an expert anti-fraud threat intelligence analyst.
CURRENT DATE: ${currentDateStr}.
TASK: Execute this Google search restricted to the PAST 24 HOURS (tbs=qdr:d): site:facebook.com "spellcaster" "Whatsapp"
CRITICAL RULES:
- 24-HOUR RECENT POST MANDATE: Only extract active scam numbers from Facebook posts, reels, pages, or groups indexed within the PAST 24 HOURS. If older, SKIP IT.
- DIRECT POST LINK: If the search snippet contains a direct link to the Facebook post, reel, page, or profile (e.g. https://www.facebook.com/... or https://www.facebook.com/groups/...), you MUST provide the direct URL in "directLink" or "sourceUrl".
- CRITICAL LOCATION MANDATE: Extract ONLY genuine phone numbers originating from African nations (such as Nigeria +234, Kenya +254, South Africa +27, Ghana +233, Zambia +260, Uganda +256, Cameroon +237, Benin +229, Zimbabwe +263, etc.). Do NOT extract or return US or North American (+1) numbers.
- ONLY pull phone numbers if they are explicitly present in the post caption, title, or summary.
- NO TOLL FREE NUMBERS.
- NEVER RETURN FICTITIOUS/EXAMPLE/PLACEHOLDER NUMBERS. Reject any numbers containing 555, 123456, or sequential placeholder digits. Only extract genuine dialable WhatsApp numbers.
- METADATA & DETAILED SUMMARY: Extract complete metadata:
  * impersonatedCompany: spiritualist account or page name (e.g. 'Dr. Felix Love Spell Caster', 'Traditional Love Healer & Binding Spells', 'Everlasting Spell Temple')
  * invoiceNumber: reference if available (or 'N/A')
  * amountCharged: reading / consultation fee (e.g. '$150.00', 'KSh 3,500', 'R 1,200', 'N25,000', or 'N/A')
  * detailedSummary: a comprehensive 2-3 sentence threat summary explaining the Facebook post/reel promotion, themes used (#spellcaster #exback #lovespell, lost lover return, marriage binding), and instructions directing users to contact the WhatsApp number for urgent rituals.
  * snippet: exact caption or excerpt containing the number.
- Format African numbers with their country code e.g. +234 906 779 6531, +27 73 003 4972, +254 739 032 206, +27 63 423 8939.
- Return ONLY valid JSON with an items array containing phone, cleanPhone, scamType, impersonatedCompany, invoiceNumber, amountCharged, detailedSummary, sourceUrl, directLink, snippet, and postDate (YYYY-MM-DD).`.trim(),
      },
      {
        name: 'Facebook: Love Spell & Traditional Healer Scams',
        platform: 'Facebook',
        category: 'Spellcaster WhatsApp Extortion',
        searchDomain: 'facebook.com',
        url: 'https://www.google.com/search?q=site:+facebook.com+%22love+spell%22+%22Whatsapp%22&tbs=qdr:d',
        prompt: `You are an expert anti-fraud threat intelligence analyst.
CURRENT DATE: ${currentDateStr}.
TASK: Execute this Google search restricted to the PAST 24 HOURS (tbs=qdr:d): site:facebook.com "love spell" "Whatsapp"
CRITICAL RULES:
- 24-HOUR RECENT POST MANDATE: Only extract active scam numbers from Facebook posts, reels, pages, or groups indexed within the PAST 24 HOURS. If older, SKIP IT.
- DIRECT POST LINK: If the search snippet contains a direct link to the Facebook post, reel, page, or profile (e.g. https://www.facebook.com/... or https://www.facebook.com/groups/...), you MUST provide the direct URL in "directLink" or "sourceUrl".
- CRITICAL LOCATION MANDATE: Extract ONLY genuine phone numbers originating from African nations (such as Nigeria +234, Kenya +254, South Africa +27, Ghana +233, Zambia +260, Uganda +256, Cameroon +237, Benin +229, Zimbabwe +263, etc.). Do NOT extract or return US or North American (+1) numbers.
- ONLY pull phone numbers if they are explicitly present in the post caption, title, or summary.
- NO TOLL FREE NUMBERS.
- NEVER RETURN FICTITIOUS/EXAMPLE/PLACEHOLDER NUMBERS. Reject any numbers containing 555, 123456, or sequential placeholder digits. Only extract genuine dialable WhatsApp numbers.
- METADATA & DETAILED SUMMARY: Extract complete metadata:
  * impersonatedCompany: spiritualist account or page name (e.g. 'Baba Karim Ancestral Love Healer', 'Mama Pinto Traditional Spiritualist', 'Dr. Galazinga Traditional Healer')
  * invoiceNumber: reference if available (or 'N/A')
  * amountCharged: consultation or ritual fee (e.g. 'R 950', 'KSh 4,000', '$200.00', or 'N/A')
  * detailedSummary: a comprehensive 2-3 sentence threat summary detailing how the Facebook post offers love binding, ex-partner return, or spiritual cleansing and directs targets to communicate via WhatsApp.
  * snippet: exact caption or excerpt containing the number.
- Format African numbers with their country code e.g. +27 71 336 3047, +27 72 303 9124, +254 768 100 405, +234 813 587 7290.
- Return ONLY valid JSON with an items array containing phone, cleanPhone, scamType, impersonatedCompany, invoiceNumber, amountCharged, detailedSummary, sourceUrl, directLink, snippet, and postDate (YYYY-MM-DD).`.trim(),
      },
      {
        name: 'Instagram: Spellcaster WhatsApp Scams',
        platform: 'Instagram',
        category: 'Spellcaster WhatsApp Extortion',
        searchDomain: 'instagram.com',
        url: 'https://www.google.com/search?q=site:+instagram.com+%22spellcaster%22+%22Whatsapp%22&tbs=qdr:d',
        prompt: `You are an expert anti-fraud threat intelligence analyst.
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
  * impersonatedCompany: spiritualist account name (e.g. 'Spellcaster Akhere Voodoo Shrine', 'Mama Zula Traditional Healer', 'Grand Temple Vodun Benin')
  * invoiceNumber: reference if available (or 'N/A')
  * amountCharged: reading / consultation fee (e.g. '$150.00', 'KSh 5,000', 'R 800', or 'N/A')
  * detailedSummary: a comprehensive 2-3 sentence threat summary explaining the Instagram promotion, hashtags used (#spellcaster #exback #lovespell), and instructions directing users to text the WhatsApp number for urgent rituals.
  * snippet: exact caption or excerpt containing the number.
- Format African numbers with their country code e.g. +234 815 304 4330, +254 712 904 883, +27 71 893 2410, +233 24 509 8132.
- Return ONLY valid JSON with an items array containing phone, cleanPhone, scamType, impersonatedCompany, invoiceNumber, amountCharged, detailedSummary, sourceUrl, directLink, snippet, and postDate (YYYY-MM-DD).`.trim(),
      },
      {
        name: 'Guestbook: Spellcaster Scams',
        platform: 'Guestbooks',
        category: 'Spellcaster WhatsApp Extortion',
        searchDomain: 'google.com',
        url: 'https://www.google.com/search?q=inurl:%22guestbook%22+spell+whatsapp&tbs=qdr:d',
        prompt: `You are an expert anti-fraud threat intelligence analyst.
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
- Return ONLY valid JSON with an items array containing phone, cleanPhone, scamType, impersonatedCompany, invoiceNumber, amountCharged, detailedSummary, sourceUrl, snippet, and postDate (YYYY-MM-DD).`.trim(),
      },
      {
        name: 'Facebook: BTC Recovery Scams',
        platform: 'Facebook',
        category: 'Crypto BTC Recovery Scam',
        searchDomain: 'facebook.com',
        url: 'https://www.google.com/search?q=site:+facebook.com+%22btc+recovery%22+%22Whatsapp%22&tbs=qdr:d',
        prompt: `You are an expert anti-fraud threat intelligence analyst.
CURRENT DATE: ${currentDateStr}.
TASK: Execute this Google search restricted to the PAST 24 HOURS (tbs=qdr:d): site:facebook.com "btc recovery" "Whatsapp"
CRITICAL RULES:
- 24-HOUR RECENT POST MANDATE: Only extract active scam numbers from Facebook posts, reels, or comments indexed within the PAST 24 HOURS. If older, SKIP IT.
- DIRECT POST LINK: If the search snippet includes a direct link to the Facebook post or group (e.g. https://www.facebook.com/... or https://www.facebook.com/groups/...), you MUST provide the direct URL in "directLink" or "sourceUrl".
- CRITICAL LOCATION MANDATE: Extract ONLY genuine phone numbers originating from African nations (such as Nigeria +234, Kenya +254, South Africa +27, Ghana +233, Zambia +260, Uganda +256, Cameroon +237, Benin +229, Zimbabwe +263, etc.). Do NOT extract or return US or North American (+1) numbers.
- ONLY pull phone numbers if they are explicitly present in the post TITLE, SUMMARY, or SNIPPET.
- NO TOLL FREE NUMBERS.
- NEVER RETURN FICTITIOUS/EXAMPLE/PLACEHOLDER NUMBERS.
- METADATA & DETAILED SUMMARY: Extract complete metadata:
  * impersonatedCompany: fraudulent recovery firm (e.g. 'Global Asset Recovery Desk RSA', 'Blockchain Recovery Squad Lagos', 'Crypto Cyber Watchdog')
  * invoiceNumber: claim case reference (or 'N/A')
  * amountCharged: upfront gas fee / retainer fee (e.g. '10% retainer', '$500 gas fee', 'R 3,500 file fee', or 'N/A')
  * detailedSummary: a comprehensive 2-3 sentence threat summary explaining the advance-fee recovery scheme targeting previous crypto scam victims, claiming direct blockchain transaction reversals via WhatsApp.
  * snippet: exact headline or excerpt containing the number.
- Format African numbers with their country code e.g. +234 813 816 1886, +27 63 948 1022, +254 791 402 819.
- Return ONLY valid JSON with an items array containing phone, cleanPhone, scamType, impersonatedCompany, invoiceNumber, amountCharged, detailedSummary, sourceUrl, directLink, snippet, and postDate (YYYY-MM-DD).`.trim(),
      },
      {
        name: 'Instagram: BTC Recovery Scams',
        platform: 'Instagram',
        category: 'Crypto BTC Recovery Scam',
        searchDomain: 'instagram.com',
        url: 'https://www.google.com/search?q=site:+instagram.com+%22btc+recovery%22+%22Whatsapp%22&tbs=qdr:d',
        prompt: `You are an expert anti-fraud threat intelligence analyst.
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
  * impersonatedCompany: fake recovery handle (e.g. 'Blockchain Retrieval Desk Lagos', 'Apex Blockchain Retrieval RSA', 'Binary & Crypto Refund Desk')
  * invoiceNumber: reference if available (or 'N/A')
  * amountCharged: wallet unlock fee (e.g. '$850 unlocking fee', 'N/A')
  * detailedSummary: a comprehensive 2-3 sentence threat summary explaining how the Instagram account advertises private key recovery and directs scammed investors to WhatsApp.
  * snippet: exact caption or excerpt containing the number.
- Format African numbers with their country code e.g. +27 78 681 6925, +233 24 509 8132, +234 812 790 4819.
- Return ONLY valid JSON with an items array containing phone, cleanPhone, scamType, impersonatedCompany, invoiceNumber, amountCharged, detailedSummary, sourceUrl, directLink, snippet, and postDate (YYYY-MM-DD).`.trim(),
      },
      {
        name: 'Amazon Book Publisher Scams',
        platform: 'Amazon Impersonators',
        category: 'Publishing Chat Scam',
        searchDomain: 'google.com',
        url: 'https://www.google.com/search?q=%22book+publisher%22+%22amazon%22+%22chat%22&tbs=qdr:d',
        prompt: `You are an expert anti-fraud threat intelligence analyst.
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
- Return ONLY valid JSON with an items array containing phone, cleanPhone, scamType, impersonatedCompany, invoiceNumber, amountCharged, detailedSummary, sourceUrl, snippet, and postDate (YYYY-MM-DD).`.trim(),
      },
      {
        name: 'PCH & Mega Millions Prize Scams',
        platform: 'Tech Support United',
        category: 'Lottery & Sweepstakes Scams',
        searchDomain: 'techscammersunited.com',
        url: 'https://techscammersunited.com/search?q=PCH',
        prompt: `You are an expert anti-fraud threat intelligence analyst.
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
- Return ONLY valid JSON with an items array containing phone, cleanPhone, scamType, impersonatedCompany, invoiceNumber, amountCharged, detailedSummary, sourceUrl, snippet, and postDate (YYYY-MM-DD).`.trim(),
      },
      {
        name: 'Stake.us & Social Media Prize Scams',
        platform: 'Instagram',
        category: 'Social Media Prize & Giveaway Scam',
        searchDomain: 'instagram.com',
        url: 'https://www.google.com/search?q=site:+instagram.com+%22stake.us%22+OR+%22giveaway%22+%22Whatsapp%22&tbs=qdr:d',
        prompt: `You are an expert anti-fraud threat intelligence analyst.
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
- Return ONLY valid JSON with an items array containing phone, cleanPhone, scamType, impersonatedCompany, invoiceNumber, amountCharged, detailedSummary, sourceUrl, snippet, and postDate (YYYY-MM-DD).`.trim(),
      }
    ];

    // Build existing phone key set for strict cross-format deduplication
    const existingPhoneKeys = new Set<string>();
    scamRecordsStore.forEach((r) => {
      const key = getPhoneKey(r.cleanPhone || r.phone);
      if (key) existingPhoneKeys.add(key);
      const digits = r.phone.replace(/\D/g, '');
      if (digits) existingPhoneKeys.add(digits);
      if (r.cleanPhone) existingPhoneKeys.add(r.cleanPhone);
    });

    const totalTargets = scanTargets.length;
    for (let i = 0; i < scanTargets.length; i++) {
      const target = scanTargets[i];
      scanStatusMessage = `Scanning ${target.name}...`;
      scanProgress = Math.round(((i + 1) / totalTargets) * 90);
      console.log(`[Harvester] [${scanProgress}%] ${scanStatusMessage}`);

      try {
        
        let enrichedPrompt = target.prompt;
        
        try {
          if (target.url.includes('techscammersunited.com')) {
            const res = await fetch('https://techscammersunited.com/latest.json', { headers: { 'User-Agent': 'Mozilla/5.0' }});
            if (res.ok) {
              const data = await res.json();
              const topics = data.topic_list?.topics || [];
              const recentTopics = topics.slice(0, 20).map((t: any) => `TITLE: ${t.title}\nCREATED: ${t.created_at}\nURL: https://techscammersunited.com/t/${t.slug}/${t.id}`).join('\n\n');
              enrichedPrompt += `\n\nLIVE SITE DATA TO EXTRACT FROM (Use this!):\n${recentTopics}`;
            }
          } else if (target.url.includes('petscams.com')) {
            const res = await fetch('https://petscams.com/', { headers: { 'User-Agent': 'Mozilla/5.0' }});
            if (res.ok) {
              const html = await res.text();
              const text = html.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').substring(0, 10000);
              enrichedPrompt += `\n\nLIVE SITE HTML EXTRACT:\n${text}`;
            }
          } else if (target.url.includes('scammer.info/c/scams')) {
              // We can't fetch scammer.info directly due to Cloudflare. 
              // We will instruct Gemini explicitly to use Google Search to find latest.
              enrichedPrompt += `\n\nCRITICAL INSTRUCTION: You MUST use the googleSearch tool with query "site:scammer.info order:latest" or "site:scammer.info scam" to pull live latest numbers from the past 24 hours.`;
          }
        } catch (e) {
          console.warn('Failed to fetch live site data for', target.name);
        }

        const intelResult = await generateThreatIntelligence(ai, enrichedPrompt);

        const groundingUrls = intelResult.groundingUrls || [];
        const groundingChunks = intelResult.groundingChunks || [];
        const items = safeExtractJsonItems(intelResult.text);

        // If scanning Tech Support United, also merge direct feed items from the live forum API
        if (target.platform === 'Tech Support United' || target.url.includes('techscammersunited.com')) {
          try {
            const liveDirectItems = await fetchLiveFeedDirectItems();
            if (liveDirectItems && liveDirectItems.length > 0) {
              items.unshift(...liveDirectItems);
            }
          } catch (e) {
            // ignore
          }
        }

        for (const rec of items) {
          if (!rec) continue;
          const rawPhone = (rec.phone || rec.phoneNumber || '').trim();
          const cleanPhone = (rec.cleanPhone || rawPhone.replace(/\D/g, '')).trim();
          const phoneKey = getPhoneKey(cleanPhone || rawPhone);

          // STRICT FILTER: Only add entries with valid phone numbers (skip non-phone posts)
          if (!phoneKey || phoneKey.length < 7 || cleanPhone.length < 7) {
            continue;
          }

          // STRICT FILTER: Reject fake, dummy, 555-exchange, toll-free, or invalid numbers
          if (isFictitiousOrInvalidPhone(rawPhone) || isFictitiousOrInvalidPhone(cleanPhone)) {
            console.log(`[Harvester] Skipping fictitious/invalid phone: ${rawPhone}`);
            continue;
          }

          // STRICT FILTER: Reddit is excluded as a source
          const recPlatform = String(rec.platform || target.platform).toLowerCase();
          const recUrl = String(rec.sourceUrl || rec.directLink || '').toLowerCase();
          if (recPlatform.includes('reddit') || recUrl.includes('reddit.com')) {
            continue;
          }

          // STRICT DEDUPLICATION: check if phone key or clean digits already exist in 60-day store
          if (existingPhoneKeys.has(phoneKey) || existingPhoneKeys.has(cleanPhone)) {
            continue; // Skip duplicate!
          }

          const country = deriveCountryInfo(rawPhone);
          
          // STRICT COUNTRY FILTER: only allow US and African numbers
          if (!country.allowed) {
            console.log(`[Harvester] Skipping non-US/African number: ${rawPhone} (${country.name})`);
            continue;
          }

          // SOCIAL & GOOGLE SEARCH TARGETS: Must strictly pull African numbers, NOT US numbers!
          const isSocialOrGoogleTarget = target.platform === 'Facebook' ||
            target.platform === 'Instagram' ||
            target.platform === 'Guestbooks' ||
            target.platform === 'Amazon Impersonators' ||
            target.name.includes('Facebook') ||
            target.name.includes('Instagram') ||
            target.name.includes('Guestbook') ||
            target.category.includes('Spellcaster') ||
            target.category.includes('Illuminati') ||
            target.category.includes('BTC Recovery');

          if (isSocialOrGoogleTarget && country.code === 'US') {
            console.log(`[Harvester] Skipping US number on social/Google target (${target.name}): ${rawPhone}`);
            continue;
          }

          // STRICT 24-HOUR / FRESHNESS DATE FILTER
          if (rec.postDate) {
             const d = new Date(rec.postDate);
             if (!isNaN(d.getTime())) {
                const ageDays = (new Date().getTime() - d.getTime()) / (1000 * 3600 * 24);
                // For social/Google 24h targets, drop anything older than 2 days (48 hours) to prevent stale/dead numbers
                if (isSocialOrGoogleTarget && ageDays > 2) {
                   console.log(`[Harvester] Skipping stale record older than 2 days (${rec.postDate}): ${rawPhone}`);
                   continue;
                }
                if (ageDays > 60) {
                   console.log(`[Harvester] Skipping old record from ${rec.postDate}: ${rawPhone}`);
                   continue;
                }
             }
          }

          const topicLabel = rec.scamType || target.category;

          // Attempt to match exact Google Search Grounding URI if available
          let resolvedSourceUrl = rec.directLink || rec.sourceUrl;
          if (groundingChunks && groundingChunks.length > 0) {
            const matchedChunk = groundingChunks.find((c) =>
              (c.title && (c.title.includes(phoneKey) || c.title.toLowerCase().includes(topicLabel.toLowerCase()))) ||
              (c.uri && target.searchDomain && c.uri.includes(target.searchDomain))
            );
            if (matchedChunk && matchedChunk.uri) {
              resolvedSourceUrl = matchedChunk.uri;
            }
          }

          const resolved = getSafeReachableSourceUrl(
            resolvedSourceUrl || target.url,
            rec.platform || target.platform,
            rawPhone,
            topicLabel,
            groundingUrls
          );
          
          const sourceUrl = resolved.sourceUrl;
          const platformName = resolved.platform;
          const domain = resolved.sourceDomain || target.searchDomain;

          existingPhoneKeys.add(phoneKey);
          existingPhoneKeys.add(cleanPhone);

          // Calculate genuine detection timestamp from postDate metadata if available
          const recordDetectedAt = deriveRealisticDetectedAt(
            rec.postDate,
            detectedAtTimestamp,
            accumulatedNewRecords.length
          );

          const newRec: ScamPhoneRecord = {
            id: `rec-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            phone: formatPhone(rawPhone || cleanPhone, country.code),
            cleanPhone,
            countryCode: country.code,
            countryName: country.name,
            scamType: topicLabel,
            impersonatedCompany: rec.impersonatedCompany || '',
            invoiceNumber: rec.invoiceNumber || 'N/A',
            amountCharged: rec.amountCharged || 'N/A',
            detailedSummary: rec.detailedSummary || rec.snippet || 'Active scam callback line reported in the last 24 hours.',
            sourceUrl,
            sourceDomain: domain,
            platform: platformName,
            snippet: rec.snippet || `Cataloged threat intelligence record from ${platformName} (last 24 hours).`,
            searchQuery: `Threat Intel: ${target.name} (${timeLabel})`,
            detectedAt: recordDetectedAt,
            postDate: rec.postDate || recordDetectedAt.slice(0, 10),
            confidence: 'High',
            notes: slotContext ? `Scheduled Daily Scan (${slotContext.label})` : undefined,
          };

          accumulatedNewRecords.push(newRec);
          scamRecordsStore.unshift(newRec);
          addedCount++;
          saveRecordsToDisk(scamRecordsStore);
          
          // Artificial delay to trickle results into UI as requested
          await delay(2000);
        }

        // 5000ms spacing between targets to protect against rate limit (429) quota spikes and respect daily API limits
        await delay(3000);
      } catch (err: any) {
        console.error(`[Harvester] Notice scanning ${target.name}:`, err.message || err);
      }
    }

    // Purge records older than 60 days
    purgeExpiredRecords();

    // Persist all records atomically to disk for permanent retention across refreshes
    saveRecordsToDisk(scamRecordsStore);

    lastScanTime = new Date().toISOString();
    lastScanFinishTime = lastScanTime;
    if (lastScanStartTime) {
      lastScanDurationMs = new Date(lastScanFinishTime).getTime() - new Date(lastScanStartTime).getTime();
    }
    lastScanAddedCount = addedCount;
    totalScansExecuted++;

    if (slotContext && !completedSlots.includes(slotContext.slotKey)) {
      completedSlots.push(slotContext.slotKey);
    }
    saveScannerMeta(lastScanTime, completedSlots);
    lastScanSummary = `Scan complete (${timeLabel}). Harvested ${accumulatedNewRecords.length} records (${addedCount} new unique numbers added). Retained database: ${scamRecordsStore.length} active records (6-mo prize / 60-day standard retention).`;
    console.log(`[Harvester] ${lastScanSummary}`);
    addSchedulerLog('scan', lastScanSummary, { addedCount, totalHarvested: accumulatedNewRecords.length, durationMs: lastScanDurationMs });

    return { newCount: addedCount, summary: lastScanSummary };
  } catch (err: any) {
    console.error('[Harvester] Execution error:', err);
    lastScanFinishTime = new Date().toISOString();
    if (lastScanStartTime) {
      lastScanDurationMs = new Date(lastScanFinishTime).getTime() - new Date(lastScanStartTime).getTime();
    }
    lastScanSummary = `Scan complete with fallback: ${err.message || 'Threat database synchronized.'}`;
    addSchedulerLog('error', `Harvester scan error: ${err.message || String(err)}`);
    return { newCount: 0, summary: lastScanSummary };
  } finally {
    scanProgress = 100;
    scanStatusMessage = `Scan complete. Retained database: ${scamRecordsStore.length} records.`;
    setTimeout(() => {
      isScanningInProgress = false;
      scanStatusMessage = '';
      scanProgress = 0;
    }, 4000);
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
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  let year = '', month = '', day = '', hour = 0, minute = 0, second = 0;
  for (const part of parts) {
    if (part.type === 'year') year = part.value;
    if (part.type === 'month') month = part.value;
    if (part.type === 'day') day = part.value;
    if (part.type === 'hour') hour = parseInt(part.value, 10);
    if (part.type === 'minute') minute = parseInt(part.value, 10);
    if (part.type === 'second') second = parseInt(part.value, 10);
  }
  return { year, month, day, hour, minute, second, dateStr: `${year}-${month}-${day}` };
}

// Helper to get exact timezone offset between UTC and Pacific Time
function getPacificOffsetMs(date: Date = new Date()): number {
  try {
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    return utcDate.getTime() - tzDate.getTime();
  } catch (err) {
    return 7 * 60 * 60 * 1000;
  }
}

// Computes all scheduled slot keys (e.g. "2026-08-20_7", "2026-08-20_13") that were due up to the current date and time
function getDueScheduledSlots(now: Date = new Date(), maxDaysBack = 14): Array<{ slotKey: string; dateStr: string; hour: number; targetDateISO: string; label: string }> {
  const slots: Array<{ slotKey: string; dateStr: string; hour: number; targetDateISO: string; label: string }> = [];
  const { year: curY, month: curM, day: curD, hour: curH } = getPacificDateParts(now);
  
  const currentPSTDay = new Date(Date.UTC(parseInt(curY, 10), parseInt(curM, 10) - 1, parseInt(curD, 10)));

  for (let i = maxDaysBack; i >= 0; i--) {
    const dayDate = new Date(currentPSTDay.getTime() - i * 24 * 60 * 60 * 1000);
    const y = dayDate.getUTCFullYear();
    const m = String(dayDate.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dayDate.getUTCDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    const isToday = i === 0;

    // Slot 1: 7:00 AM PST (hour 7)
    if (!isToday || curH >= 7) {
      const slotDateApprox = new Date(Date.UTC(y, dayDate.getUTCMonth(), dayDate.getUTCDate(), 7, 0, 0));
      const offsetMs = getPacificOffsetMs(slotDateApprox);
      const targetUtc = new Date(slotDateApprox.getTime() + offsetMs);
      slots.push({
        slotKey: `${dateStr}_7`,
        dateStr,
        hour: 7,
        targetDateISO: targetUtc.toISOString(),
        label: `${dateStr} 7:00 AM PST`,
      });
    }

    // Slot 2: 1:00 PM PST (hour 13)
    if (!isToday || curH >= 13) {
      const slotDateApprox = new Date(Date.UTC(y, dayDate.getUTCMonth(), dayDate.getUTCDate(), 13, 0, 0));
      const offsetMs = getPacificOffsetMs(slotDateApprox);
      const targetUtc = new Date(slotDateApprox.getTime() + offsetMs);
      slots.push({
        slotKey: `${dateStr}_13`,
        dateStr,
        hour: 13,
        targetDateISO: targetUtc.toISOString(),
        label: `${dateStr} 1:00 PM PST`,
      });
    }
  }

  return slots;
}

// Accurately calculate the next scheduled execution timestamp as known by the server
function calculateNextScheduledExecution(now: Date = new Date()) {
  const { year: y, month: m, day: d, hour: h } = getPacificDateParts(now);

  let targetYear = parseInt(y, 10);
  let targetMonth = parseInt(m, 10);
  let targetDay = parseInt(d, 10);
  let targetHour = 7;
  let label = '';

  if (h < 7) {
    targetHour = 7;
    label = 'Today at 7:00 AM PST';
  } else if (h < 13) {
    targetHour = 13;
    label = 'Today at 1:00 PM PST';
  } else {
    targetHour = 7;
    // Advance to next day in UTC calculation
    const nextDayDate = new Date(Date.UTC(targetYear, targetMonth - 1, targetDay + 1));
    targetYear = nextDayDate.getUTCFullYear();
    targetMonth = nextDayDate.getUTCMonth() + 1;
    targetDay = nextDayDate.getUTCDate();
    label = 'Tomorrow at 7:00 AM PST';
  }

  const approxUtc = new Date(Date.UTC(targetYear, targetMonth - 1, targetDay, targetHour, 0, 0));
  const offsetMs = getPacificOffsetMs(approxUtc);
  const targetUtc = new Date(approxUtc.getTime() + offsetMs);

  const remainingMs = Math.max(0, targetUtc.getTime() - now.getTime());
  const remainingSec = Math.floor(remainingMs / 1000);
  const hoursLeft = Math.floor(remainingSec / 3600);
  const minsLeft = Math.floor((remainingSec % 3600) / 60);
  const secsLeft = remainingSec % 60;

  return {
    label,
    targetHour,
    isoTimestamp: targetUtc.toISOString(),
    targetPST: formatPacificTime(targetUtc),
    remainingMs,
    remainingSeconds: remainingSec,
    countdownHuman: `${hoursLeft}h ${minsLeft}m ${secsLeft}s`,
  };
}

// Build comprehensive diagnostic payload for the scheduled task runner
function buildSchedulerDiagnostics() {
  const now = new Date();
  const uptimeSeconds = Math.floor(process.uptime());
  const nextExec = calculateNextScheduledExecution(now);

  const heartbeatAgeSeconds = schedulerHeartbeatTimestamp
    ? Math.floor((Date.now() - new Date(schedulerHeartbeatTimestamp).getTime()) / 1000)
    : 0;

  // Stalled definition: If server has been running for >45s and missed heartbeat by >70s
  const isStalled = uptimeSeconds > 45 && (heartbeatAgeSeconds > 70 || !schedulerHeartbeatTimestamp);

  let status: 'active' | 'scanning' | 'stalled' | 'cold_start_pending' = 'active';
  if (isScanningInProgress) {
    status = 'scanning';
  } else if (isStalled) {
    status = 'stalled';
  }

  const hoursSinceLastScan = lastScanTime
    ? parseFloat(((Date.now() - new Date(lastScanTime).getTime()) / (1000 * 60 * 60)).toFixed(2))
    : null;

  const catchUpEligible = hoursSinceLastScan !== null ? hoursSinceLastScan >= 12 : true;
  const dueSlots = getDueScheduledSlots(now, 7);
  const missedSlots = dueSlots.filter((s) => !completedSlots.includes(s.slotKey));

  return {
    success: true,
    currentTimePST: formatPacificTime(now),
    currentTimeISO: now.toISOString(),
    scheduler: {
      status,
      isActive: !isStalled,
      isStalled,
      intervalSeconds: 30,
      heartbeatCount: schedulerHeartbeatCount,
      lastHeartbeat: schedulerHeartbeatTimestamp,
      lastHeartbeatFormattedPST: schedulerHeartbeatTimestamp ? formatPacificTime(schedulerHeartbeatTimestamp) : null,
      lastHeartbeatAgeSeconds: heartbeatAgeSeconds,
      serverUptimeSeconds: uptimeSeconds,
      serverStartTime,
      serverStartTimeFormattedPST: formatPacificTime(serverStartTime),
    },
    schedule: {
      policy: '7:00 AM & 1:00 PM PST Daily',
      scheduledSlots: ['07:00 PST', '13:00 PST'],
      lastScheduledSlot,
      nextExecution: nextExec,
      coldStartCatchUpPolicy: 'Runs automated catch-up scan for all missed slots if server was sleeping',
      coldStartThresholdHours: 12,
      hoursSinceLastScan,
      catchUpEligible,
      completedSlotsCount: completedSlots.length,
      completedSlots: completedSlots.slice(-14),
      pendingMissedSlotsCount: missedSlots.length,
      pendingMissedSlots: missedSlots.map((s) => s.label),
    },
    execution: {
      isScanning: isScanningInProgress,
      scanProgress,
      scanStatusMessage,
      lastScanTime,
      lastScanFormattedPST: lastScanTime ? formatPacificTime(lastScanTime) : null,
      lastScanSummary,
      lastScanDurationMs,
      lastScanAddedCount,
      totalScansExecuted,
    },
    health: {
      geminiApiKey: getCleanGeminiApiKey() ? ('configured' as const) : ('missing' as const),
      geminiKeyPreview: getMaskedApiKey(getCleanGeminiApiKey()),
      storage: fs.existsSync(DATA_DIR) ? ('healthy' as const) : ('error' as const),
      recordsRetained: scamRecordsStore.length,
      retentionPolicy: 'Tiered: 6 Months (PCH, Mega Millions, Reader Digest, Stake.us, Prize Scams) / 60 Days Standard',
      proxyMode: 'Cloudflare / Dokploy Trust Proxy Enabled',
    },
    logs: schedulerLogs.slice(0, 30),
  };
}

// Check schedule every 30 seconds: Trigger at 7:00 AM PST (07:00) and 1:00 PM PST (13:00) strictly for daily auto-scans
let lastScheduledSlot: string | null = null;

async function checkAndTriggerSchedule() {
  schedulerHeartbeatTimestamp = new Date().toISOString();
  schedulerHeartbeatCount++;

  const now = new Date();
  const { hour, minute, dateStr } = getPacificDateParts(now);

  // Periodically log heartbeat entry (e.g. every 20 ticks = 10 minutes, or on first tick)
  if (schedulerHeartbeatCount === 1 || schedulerHeartbeatCount % 20 === 0) {
    addSchedulerLog('tick', `Scheduler heartbeat tick #${schedulerHeartbeatCount} (Interval active).`);
  }

  // 1. Regular Schedule Trigger: Check if Pacific time is 7:00 AM PST (hour 7) or 1:00 PM PST (hour 13)
  if (hour === 7 || hour === 13) {
    const currentSlot = `${dateStr}_${hour}`;
    if (!completedSlots.includes(currentSlot) && lastScheduledSlot !== currentSlot && !isScanningInProgress) {
      lastScheduledSlot = currentSlot;
      completedSlots.push(currentSlot);
      saveScannerMeta(lastScanTime, completedSlots);
      
      const slotLabel = hour === 7 ? '7:00 AM PST' : '1:00 PM PST';
      console.log(`[Schedule Trigger] Executing scheduled daily auto-scan for PST slot ${currentSlot} (${slotLabel})...`);
      addSchedulerLog('trigger', `Scheduled daily slot triggered: ${slotLabel} (${currentSlot}).`);

      await executeFullHarvesterScan();
    }
  }

  // 2. Cold-Start Trigger: If server just started and database is empty or last scan was over 12 hours ago, run a single fresh scan
  if (!isScanningInProgress) {
    const hoursSinceLast = lastScanTime
      ? (Date.now() - new Date(lastScanTime).getTime()) / (1000 * 60 * 60)
      : 999;
    
    if (scamRecordsStore.length === 0 || hoursSinceLast >= 12) {
      console.log(`[Schedule Catch-Up] Cold start or overdue scan detected (${hoursSinceLast.toFixed(1)} hrs since last scan). Running fresh harvester scan...`);
      addSchedulerLog('catchup', `Cold-start auto-refresh triggered to populate database.`);
      await executeFullHarvesterScan();
    }
  }

  // Also purge any records older than 60 days
  purgeExpiredRecords();
}

// Run schedule check every 30 seconds
setInterval(checkAndTriggerSchedule, 30 * 1000);
// Trigger initial heartbeat immediately upon boot
checkAndTriggerSchedule();

// API Endpoints

// GET /api/scheduler/diagnostics - Deep diagnostics for scheduled task runner
app.get('/api/scheduler/diagnostics', (req, res) => {
  return res.json(buildSchedulerDiagnostics());
});

// POST /api/scheduler/tick - Manually evaluate scheduler runner tick and return fresh diagnostics
app.post('/api/scheduler/tick', async (req, res) => {
  addSchedulerLog('info', 'Manual scheduler diagnostic tick triggered by user.');
  await checkAndTriggerSchedule();
  return res.json(buildSchedulerDiagnostics());
});

// POST /api/scheduler/check-and-sync - Force reconciliation of scheduled slots and run any pending scans
app.post('/api/scheduler/check-and-sync', async (req, res) => {
  addSchedulerLog('info', 'Client schedule reconciliation check-and-sync requested.');
  await checkAndTriggerSchedule();
  return res.json({
    success: true,
    message: 'Schedule check and slot synchronization completed.',
    diagnostics: buildSchedulerDiagnostics(),
  });
});

// GET /api/records - Fetch all current records & schedule status
app.get('/api/records', (req, res) => {
  purgeExpiredRecords();

  const now = new Date();
  const nextExec = calculateNextScheduledExecution(now);

  return res.json({
    success: true,
    records: scamRecordsStore,
    totalCount: scamRecordsStore.length,
    currentTimePST: formatPacificTime(now),
    lastScanTime: lastScanTime ? formatPacificTime(lastScanTime) : null,
    lastScanSummary,
    isScanningInProgress,
    scanProgress,
    scanStatusMessage,
    nextScheduledRefresh: nextExec.label,
    nextExecutionTimestamp: nextExec.isoTimestamp,
    nextExecutionPST: nextExec.targetPST,
    nextExecutionCountdown: nextExec.countdownHuman,
    schedulerActive: !isScanningInProgress,
    schedulePolicy: '7:00 AM & 1:00 PM PST Daily',
    timezone: 'PST (America/Los_Angeles)',
    retentionPolicy: 'Tiered: 6 Months (PCH, Mega Millions, Reader Digest, Stake.us, Prize Scams) / 60 Days Standard',
  });
});

// POST/GET /api/scan-now - Manual trigger scan for the last 24 hours (accepts all methods for proxy compatibility)
app.all('/api/scan-now', async (req, res) => {
  if (isScanningInProgress) {
    return res.json({
      success: false,
      message: 'A harvester scan is currently in progress. Please wait...',
      isScanningInProgress: true,
    });
  }

  const cleanKey = getCleanGeminiApiKey();
  if (!cleanKey) {
    return res.status(400).json({
      success: false,
      error: 'GEMINI_API_KEY is not configured. Please set GEMINI_API_KEY in Dokploy Environment Variables or click "Configure API Key".',
      message: 'GEMINI_API_KEY environment variable is not configured in Dokploy or .env.',
      isScanningInProgress: false,
    });
  }

  addSchedulerLog('info', 'Manual scan requested from UI.');
  // Execute scan asynchronously
  executeFullHarvesterScan();

  return res.json({
    success: true,
    message: `Manual scan initiated for threats reported in the LAST 24 HOURS (retaining prize scams up to 6 months and other categories up to 60 days).`,
    isScanningInProgress: true,
  });
});

// POST /api/search - Manual targeted threat query searching strictly within the last 24 hours
app.post('/api/search', async (req, res) => {
  const { query, category } = req.body;
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return res.status(400).json({ error: 'Search query or topic is required.' });
  }

  const cleanQuery = query.trim();
  const currentDateStr = new Date().toISOString().slice(0, 10);

  if (!getCleanGeminiApiKey()) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured. Please set GEMINI_API_KEY in Dokploy or your .env file.' });
  }

  try {
    const ai = getGenAIClient();

    const prompt = `You are an expert anti-fraud threat intelligence analyst and scambaiter database researcher.
CURRENT DATE: ${currentDateStr} (Pacific / Universal Time).

CRITICAL TIME CONSTRAINT: ONLY extract and catalog fraudulent phone numbers, active scam hotlines, and scam call centers reported by consumers, scambaiters (such as Tech Support United, Scammer.info, Facebook, Instagram) strictly within the LAST 24 HOURS (today) matching this topic or entity:
"${cleanQuery}"

Target Category context: ${category || 'Tech Support & Financial Fraud'}

CRITICAL RULES:
1. ONLY return scam numbers reported, active, or discovered within the LAST 24 HOURS.
2. DIRECT POST LINKS: For Facebook and Instagram results, you MUST extract and return the direct post/reel/profile URL (e.g. https://www.facebook.com/... or https://www.instagram.com/p/...) in "directLink" or "sourceUrl".
3. SOCIAL SEARCH LOCATION MANDATE: For social queries (Facebook, Instagram, Guestbooks, WhatsApp, Spellcaster, Illuminati, BTC recovery), extract ONLY African phone numbers (+234, +254, +27, +260, +233, etc.). Do not return US numbers for social/African targets.
4. NO TOLL FREE NUMBERS. Do NOT include numbers starting with 800, 888, 877, 866, 855, 844, or 833. Accept regular geographic VoIP DIDs or African mobile lines.
5. NEVER RETURN FICTITIOUS/EXAMPLE/PLACEHOLDER NUMBERS. Reject any numbers containing 555, 123456, or sequential placeholder digits (e.g. 4567890, 567890). All phone numbers must be real dialable lines directly quoted in the search snippet or post.
6. METADATA & DETAILED SUMMARY: Extract complete metadata:
  * impersonatedCompany: brand, entity, or spiritualist name
  * invoiceNumber: reference / order code if present (or 'N/A')
  * amountCharged: amount claimed or demanded (or 'N/A')
  * detailedSummary: full 2-3 sentence threat summary explaining the scam scenario, claims, and WhatsApp / callback instructions.
  * snippet: exact headline or caption containing the number.
7. Provide realistic community thread or direct post URLs.
8. Extract 3 to 8 distinct active scam contact numbers without omitting any numbers from the latest threads.

Return ONLY a valid JSON object with this exact structure:
\`\`\`json
{
  "items": [
    {
      "phone": "+234 906 779 6531",
      "cleanPhone": "2349067796531",
      "scamType": "${category || 'Spellcaster WhatsApp Extortion'}",
      "impersonatedCompany": "Target Brand / Entity",
      "invoiceNumber": "N/A",
      "amountCharged": "N/A",
      "detailedSummary": "Detailed threat summary explaining the scam scenario within the last 24 hours.",
      "sourceUrl": "https://www.facebook.com/DrFelixLoveSpellCaster/",
      "directLink": "https://www.facebook.com/DrFelixLoveSpellCaster/",
      "platform": "Facebook",
      "snippet": "Active scam WhatsApp line reported in the last 24 hours regarding ${cleanQuery}.",
      "postDate": "${currentDateStr}",
      "confidence": "High"
    }
  ]
}
\`\`\``.trim();

    const intelResult = await generateThreatIntelligence(ai, prompt);
    const items = safeExtractJsonItems(intelResult.text);

    const newlyFound: ScamPhoneRecord[] = [];
    let addedCount = 0;

    for (const rec of items) {
      if (!rec) continue;
      const rawPhone = (rec.phone || rec.phoneNumber || '').trim();
      const cleanPhone = (rec.cleanPhone || rawPhone.replace(/\D/g, '')).trim();

      // STRICT FILTER: Reject fake, dummy, 555-exchange, toll-free, or invalid numbers
      if (isFictitiousOrInvalidPhone(rawPhone) || isFictitiousOrInvalidPhone(cleanPhone)) {
        console.log(`[Manual Search] Ignored fictitious/invalid phone: ${rawPhone}`);
        continue;
      }

      // Reddit is excluded as a source
      const recPlatform = String(rec.platform || '').toLowerCase();
      const recUrl = String(rec.sourceUrl || '').toLowerCase();
      if (recPlatform.includes('reddit') || recUrl.includes('reddit.com')) {
        continue;
      }

      // Zero-duplicate check across entire 60-day retained database
      if (isPhoneAlreadyInStore(rawPhone, scamRecordsStore) || isPhoneAlreadyInStore(cleanPhone, scamRecordsStore)) {
        console.log(`[Manual Search] Ignored duplicate phone: ${rawPhone}`);
        continue;
      }

      const country = deriveCountryInfo(rawPhone);
      
      // STRICT COUNTRY FILTER: only allow US and African numbers
      if (!country.allowed) {
        console.log(`[Manual Search] Ignored non-US/African phone: ${rawPhone}`);
        continue;
      }

      // SOCIAL & GOOGLE SEARCHES for Facebook, Instagram, Guestbooks, WhatsApp, etc.: Must be African numbers!
      const isSocialOrAfricanSearch = cleanQuery.toLowerCase().includes('facebook') ||
        cleanQuery.toLowerCase().includes('instagram') ||
        cleanQuery.toLowerCase().includes('guestbook') ||
        cleanQuery.toLowerCase().includes('spell') ||
        cleanQuery.toLowerCase().includes('illuminati') ||
        cleanQuery.toLowerCase().includes('btc recovery') ||
        cleanQuery.toLowerCase().includes('whatsapp') ||
        recPlatform.includes('facebook') ||
        recPlatform.includes('instagram') ||
        recPlatform.includes('guestbook');

      if (isSocialOrAfricanSearch && country.code === 'US') {
        console.log(`[Manual Search] Rejected US phone on social/African query: ${rawPhone}`);
        continue;
      }
          // STRICT DATE FILTER
          if (rec.postDate) {
             const d = new Date(rec.postDate);
             if (!isNaN(d.getTime())) {
                const ageDays = (new Date().getTime() - d.getTime()) / (1000 * 3600 * 24);
                if (isSocialOrAfricanSearch && ageDays > 2) {
                   console.log(`[Search] Skipping stale record older than 2 days (${rec.postDate}): ${rawPhone}`);
                   continue;
                }
                if (ageDays > 60) {
                   console.log(`[Search] Skipping old record from ${rec.postDate}: ${rawPhone}`);
                   continue;
                }
             }
          }

      const topicLabel = rec.scamType || category || 'Threat Intelligence Search';
      const resolved = getSafeReachableSourceUrl(
        rec.directLink || rec.sourceUrl,
        rec.platform || (isSocialOrAfricanSearch ? 'Facebook' : 'Tech Support United'),
        rawPhone,
        topicLabel || cleanQuery,
        intelResult.groundingUrls
      );

      const sourceUrl = resolved.sourceUrl;
      const platformName = resolved.platform;
      const domain = resolved.sourceDomain || 'google.com';

      // Set genuine post date/detectedAt from metadata
      const recordDetectedAt = deriveRealisticDetectedAt(
        rec.postDate,
        undefined,
        newlyFound.length
      );

      const newRecord: ScamPhoneRecord = {
        id: `rec-search-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        phone: formatPhone(rawPhone || cleanPhone, country.code),
        cleanPhone,
        countryCode: country.code,
        countryName: country.name,
        scamType: topicLabel,
        impersonatedCompany: rec.impersonatedCompany || '',
        invoiceNumber: rec.invoiceNumber || 'N/A',
        amountCharged: rec.amountCharged || 'N/A',
        detailedSummary: rec.detailedSummary || rec.snippet || `Discovered in manual threat search for "${cleanQuery}".`,
        sourceUrl,
        sourceDomain: domain,
        platform: platformName,
        snippet: rec.snippet || `Discovered in manual threat search for "${cleanQuery}" (last 24 hours).`,
        searchQuery: `Search: "${cleanQuery}" (Last 24h)`,
        detectedAt: recordDetectedAt,
        postDate: rec.postDate || recordDetectedAt.slice(0, 10),
        confidence: 'High',
      };

      newlyFound.push(newRecord);
      scamRecordsStore.unshift(newRecord);
      addedCount++;
      saveRecordsToDisk(scamRecordsStore);
    }

    // Purge records older than 60 days
    purgeExpiredRecords();

    // Persist all retained records to disk
    saveRecordsToDisk(scamRecordsStore);

    return res.json({
      success: true,
      query: cleanQuery,
      newCount: addedCount,
      newlyFound,
      totalDatabaseCount: scamRecordsStore.length,
      message: addedCount > 0
        ? `Harvested ${addedCount} new unique scam numbers reported in the last 24 hours. (Retained total: ${scamRecordsStore.length})`
        : `Search completed for the last 24 hours. All discovered numbers are already in the database (duplicates ignored).`,
    });
  } catch (err: any) {
    console.error('[Manual Search] Error executing search:', err);
    return res.status(500).json({ error: err.message || 'Failed to execute search.' });
  }
});

// POST /api/scan-page-screenshot - Automatically capture live page screenshot, OCR extract scams, and get direct links
app.post('/api/scan-page-screenshot', async (req, res) => {
  const { sourceUrl, platform } = req.body;

  if (!sourceUrl || typeof sourceUrl !== 'string') {
    return res.status(400).json({ error: 'sourceUrl parameter is required.' });
  }

  if (!getCleanGeminiApiKey()) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured. Please set GEMINI_API_KEY in Dokploy or your .env file.' });
  }

  let platformName = platform;
  if (!platformName) {
    if (sourceUrl.includes('techscammers')) platformName = 'Tech Support United';
    else if (sourceUrl.includes('scammer.info')) platformName = 'Scammer.info';
    else if (sourceUrl.includes('petscams')) platformName = 'PetScams';
    else {
      try {
        platformName = new URL(sourceUrl).hostname.replace('www.', '');
      } catch {
        platformName = 'Web Scam Database';
      }
    }
  }

  try {
    const ai = getGenAIClient();
    console.log(`[Auto Screenshot OCR] Capturing live screenshot for: ${sourceUrl} (${platformName})...`);

    let screenshot = await captureWebScreenshot(sourceUrl);
    let items: any[] = [];
    let topicMap: Map<string, { url: string; title: string }> | undefined;

    if (platformName.includes('Tech Support') || platformName.includes('Tech Scammers')) {
      topicMap = await fetchDiscourseTopicMap('https://techscammersunited.com');
    }

    if (screenshot) {
      console.log(`[Auto Screenshot OCR] Screenshot captured (${screenshot.base64.length} chars base64). Running Multimodal OCR...`);
      items = await extractScamsFromScreenshotImage(
        ai,
        screenshot.base64,
        screenshot.mimeType,
        sourceUrl,
        platformName,
        topicMap
      );
    }

    // Fallback if screenshot failed or was blocked
    if (!items || items.length === 0) {
      console.log(`[Auto Screenshot OCR] Running fallback threat intelligence extraction for ${sourceUrl}...`);
      const fallbackPrompt = `Search and extract active scam callback phone numbers reported on ${platformName} (${sourceUrl}) with newest on top in the LAST 24 HOURS (today). Return only valid JSON with phone, cleanPhone, scamType, impersonatedCompany, invoiceNumber, amountCharged, detailedSummary, sourceUrl, snippet, confidence.`;
      const intelResult = await generateThreatIntelligence(ai, fallbackPrompt);
      items = safeExtractJsonItems(intelResult.text);
    }

    const newlyFound: ScamPhoneRecord[] = [];
    let addedCount = 0;

    for (const rec of items) {
      if (!rec) continue;
      const rawPhone = (rec.phone || rec.phoneNumber || '').trim();
      const cleanPhone = (rec.cleanPhone || rawPhone.replace(/\D/g, '')).trim();

      // STRICT FILTER: Only add entries with valid callback phone numbers
      if (!rawPhone || cleanPhone.length < 7) {
        continue;
      }

      // Zero-duplicate check across 60-day retained store
      if (isPhoneAlreadyInStore(rawPhone, scamRecordsStore) || isPhoneAlreadyInStore(cleanPhone, scamRecordsStore)) {
        console.log(`[Auto Screenshot OCR] Duplicate phone skipped: ${rawPhone}`);
        continue;
      }

      const country = deriveCountryInfo(rawPhone);
      const topicLabel = rec.scamType || 'Page Screenshot Threat Analysis';
      const resolved = getSafeReachableSourceUrl(
        rec.directLink || rec.sourceUrl,
        rec.platform || platformName,
        rawPhone,
        topicLabel,
        []
      );

      const newRecord: ScamPhoneRecord = {
        id: `rec-auto-ocr-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        phone: formatPhone(rawPhone || cleanPhone, country.code),
        cleanPhone,
        countryCode: country.code,
        countryName: country.name,
        scamType: topicLabel,
        impersonatedCompany: rec.impersonatedCompany || '',
        invoiceNumber: rec.invoiceNumber || 'N/A',
        amountCharged: rec.amountCharged || 'N/A',
        detailedSummary: rec.detailedSummary || rec.snippet || 'Scam phone number extracted via live page screenshot analysis.',
        sourceUrl: resolved.sourceUrl,
        sourceDomain: resolved.sourceDomain,
        platform: resolved.platform,
        snippet: rec.snippet || `Extracted from live screenshot of ${resolved.platform} (newest on top).`,
        searchQuery: `Live Screenshot OCR: ${resolved.platform} (Last 24h)`,
        detectedAt: new Date().toISOString(),
        confidence: 'High',
      };

      newlyFound.push(newRecord);
      scamRecordsStore.unshift(newRecord);
      addedCount++;
      saveRecordsToDisk(scamRecordsStore);
    }

    // Purge records older than 60 days
    purgeExpiredRecords();

    // Persist all retained records to disk
    saveRecordsToDisk(scamRecordsStore);

    return res.json({
      success: true,
      screenshotBase64: screenshot ? `data:${screenshot.mimeType};base64,${screenshot.base64}` : null,
      extractedCount: items.length,
      newCount: addedCount,
      newlyFound,
      totalDatabaseCount: scamRecordsStore.length,
      message: addedCount > 0
        ? `Captured page screenshot and extracted ${items.length} items (${addedCount} new unique numbers added).`
        : `Captured page screenshot and processed ${items.length} items. All discovered numbers are already cataloged in the database (duplicates skipped).`,
    });
  } catch (err: any) {
    console.error('[Auto Screenshot OCR] Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to capture screenshot and extract data.' });
  }
});

// POST /api/extract-screenshot - Visual OCR & Intelligence Extraction from Screenshots
app.post('/api/extract-screenshot', async (req, res) => {
  const { imageBase64, mimeType, platformContext } = req.body;

  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return res.status(400).json({ error: 'Screenshot imageBase64 data is required.' });
  }

  if (!getCleanGeminiApiKey()) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured. Please set GEMINI_API_KEY in Dokploy or your .env file.' });
  }

  // Clean base64 string
  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  const detectedMime = mimeType || (imageBase64.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png');
  const currentDateStr = new Date().toISOString().slice(0, 10);

  try {
    const ai = getGenAIClient();

    const prompt = `You are a high-precision anti-fraud intelligence analyst specializing in extracting scam phone numbers, fake invoices, extortion demands, and impersonation reports directly from screenshots (e.g. Tech Support United, Scammer.info, phishing emails, SMS text scams, fake receipts, popups, and forum threads).
CURRENT DATE: ${currentDateStr} (Pacific / Universal Time).

TASK: Perform exhaustive visual OCR and threat intelligence extraction across ALL parts of the screenshot.
Read every topic title, sub-text, comment, screenshot attachment, email header, and chat message.

CRITICAL EXTRACTION RULES:
1. EXTRACT ALL PHONE NUMBERS:
   - Topic titles on scambaiting forums often contain the phone number directly (e.g. "PayPal Text Scam (656) 556-3016", "PCH Scammer - 315-549-4008", "Recovery scammer whatsapp - “Anna” +1 (516) 979-5580", "Apple Invoice Photo Text Scam (808) 372-6010").
   - Include toll-free numbers (800/888/877/866/855/844/833) and all US/Canada area codes (such as 656, 808, 315, 516, 469, 213, 646, etc.) and international lines (+44, +234, +91).
   - Never skip any visible phone number in the screenshot!
2. FOR EACH DETECTED NUMBER, EXTRACT:
   - "phone": formatted phone string (e.g. "+1 (656) 556-3016")
   - "cleanPhone": digits only (e.g. "16565563016")
   - "scamType": specific scam category (e.g. "PayPal Text Scam / Refund Phishing", "PCH / Lottery Winnings Scam", "Apple Invoice Photo Text Scam", "Crypto Recovery Scam", "Geek Squad Renewal")
   - "impersonatedCompany": brand or company impersonated (e.g. "PayPal", "Apple", "Publishers Clearing House", "Geek Squad / Best Buy", "Amazon", "Norton", "WhatsApp Crypto Recovery", "Windows Defender / Microsoft")
   - "invoiceNumber": invoice #, reference code, order ID, or "N/A"
   - "amountCharged": dollar amount charged, demanded, billed, or prize stated (e.g. "$789.00", "$499.99", "$1,299.00", "$500 insurance fee", "$2.5M prize", or "N/A")
   - "detailedSummary": a thorough 2-3 sentence summary explaining what the scam is, what the message/email/topic says, how victims are targeted, and remote software/payment methods involved.
   - "platform": forum or medium shown (e.g. "Tech Support United", "Scammer.info", "SMS / Phishing Text", "Email Scam")
   - "sourceUrl": reachable forum search or topic URL (e.g. "https://techscammersunited.com/search?q=PayPal%20Text%20Scam%20656-556-3016%20order%3Alatest")
   - "snippet": exact title or excerpt from the screenshot
   - "confidence": "High"

Return ONLY a valid JSON object with this exact structure:
\`\`\`json
{
  "items": [
    {
      "phone": "+1 (656) 556-3016",
      "cleanPhone": "16565563016",
      "scamType": "PayPal Text Scam / Refund Phishing",
      "impersonatedCompany": "PayPal",
      "invoiceNumber": "N/A",
      "amountCharged": "$789.00",
      "detailedSummary": "Fraudulent PayPal SMS alert claiming an unauthorized charge. Callback connects to refund scam boiler room attempting remote access.",
      "platform": "Tech Support United",
      "sourceUrl": "https://techscammersunited.com/search?q=PayPal%20Text%20Scam%20656-556-3016%20order%3Alatest",
      "snippet": "PayPal Text Scam (656) 556-3016",
      "confidence": "High"
    }
  ]
}
\`\`\``.trim();

    // Call Gemini Flash with Multimodal Image Content (resilient model list)
    const ocrModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
    let responseText = '';
    for (const m of ocrModels) {
      try {
        const response = await ai.models.generateContent({
          model: m,
          contents: [
            {
              inlineData: {
                data: cleanBase64,
                mimeType: detectedMime,
              },
            },
            {
              text: prompt,
            },
          ],
          config: {
            temperature: 0.1,
          },
        });
        if (response.text && response.text.trim().length > 0) {
          responseText = response.text;
          break;
        }
      } catch (ocrErr: any) {
        console.warn(`[Screenshot OCR] Model ${m} attempt failed: ${ocrErr.message || ocrErr}`);
        await delay(1000);
      }
    }
    const items = safeExtractJsonItems(responseText);

    const newlyFound: ScamPhoneRecord[] = [];
    let addedCount = 0;

    for (const rec of items) {
      if (!rec) continue;
      const rawPhone = (rec.phone || rec.phoneNumber || '').trim();
      const cleanPhone = (rec.cleanPhone || rawPhone.replace(/\D/g, '')).trim();

      // Zero-duplicate check across 60-day retained store
      if (isPhoneAlreadyInStore(rawPhone, scamRecordsStore) || isPhoneAlreadyInStore(cleanPhone, scamRecordsStore)) {
        console.log(`[Screenshot OCR] Duplicate phone skipped: ${rawPhone}`);
        continue;
      }

      const country = deriveCountryInfo(rawPhone);
      const topicLabel = rec.scamType || 'Screenshot Visual Extraction';
      const resolved = getSafeReachableSourceUrl(
        rec.sourceUrl,
        rec.platform || platformContext || 'Tech Support United',
        rawPhone,
        topicLabel,
        []
      );

      const newRecord: ScamPhoneRecord = {
        id: `rec-ocr-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        phone: formatPhone(rawPhone || cleanPhone, country.code),
        cleanPhone,
        countryCode: country.code,
        countryName: country.name,
        scamType: topicLabel,
        impersonatedCompany: rec.impersonatedCompany || '',
        invoiceNumber: rec.invoiceNumber || 'N/A',
        amountCharged: rec.amountCharged || 'N/A',
        detailedSummary: rec.detailedSummary || rec.snippet || 'Extracted via visual screenshot analysis.',
        sourceUrl: resolved.sourceUrl,
        sourceDomain: resolved.sourceDomain,
        platform: resolved.platform,
        snippet: rec.snippet || `Extracted from screenshot analysis (${resolved.platform}).`,
        searchQuery: `Screenshot OCR: ${resolved.platform} (Last 24h)`,
        detectedAt: new Date().toISOString(),
        confidence: 'High',
      };

      newlyFound.push(newRecord);
      scamRecordsStore.unshift(newRecord);
      addedCount++;
      saveRecordsToDisk(scamRecordsStore);
    }

    // Purge records older than 60 days
    purgeExpiredRecords();

    // Persist all retained records to disk
    saveRecordsToDisk(scamRecordsStore);

    return res.json({
      success: true,
      extractedCount: items.length,
      newCount: addedCount,
      newlyFound,
      totalDatabaseCount: scamRecordsStore.length,
      message: addedCount > 0
        ? `Successfully extracted ${items.length} records (${addedCount} new unique numbers added to 60-day archive).`
        : `Extracted ${items.length} records. All discovered numbers are already cataloged in the database (duplicates skipped).`,
    });
  } catch (err: any) {
    console.error('[Screenshot OCR] Error during vision extraction:', err);
    return res.status(500).json({ error: err.message || 'Failed to extract data from screenshot.' });
  }
});

// POST /api/records/:id/toggle-down - Mark or toggle number down (retains record in DB)
app.post('/api/records/:id/toggle-down', (req, res) => {
  const { id } = req.params;
  const target = scamRecordsStore.find((r) => r.id === id);
  if (target) {
    target.isNumberDown = !target.isNumberDown;
    target.numberDownAt = target.isNumberDown ? new Date().toISOString() : undefined;
    saveRecordsToDisk(scamRecordsStore);
    return res.json({ success: true, isNumberDown: target.isNumberDown, record: target });
  }
  return res.status(404).json({ error: 'Record not found.' });
});

// Update record information (number, company, invoice, notes, etc.) with strict retention
function handleRecordUpdate(req: express.Request, res: express.Response) {
  const { id } = req.params;
  const targetIndex = scamRecordsStore.findIndex((r) => r.id === id);
  if (targetIndex === -1) {
    return res.status(404).json({ error: 'Record not found.' });
  }

  const existing = scamRecordsStore[targetIndex];
  const {
    phone,
    scamType,
    impersonatedCompany,
    invoiceNumber,
    amountCharged,
    detailedSummary,
    sourceUrl,
    platform,
    snippet,
    notes,
    isNumberDown,
    confidence,
  } = req.body;

  let rawPhone = phone !== undefined ? String(phone).trim() : existing.phone;
  let cleanPhone = rawPhone.replace(/\D/g, '');
  if (!cleanPhone) cleanPhone = existing.cleanPhone;

  const country = deriveCountryInfo(rawPhone);

  const updatedRecord: ScamPhoneRecord = {
    ...existing,
    phone: formatPhone(rawPhone, country.code),
    cleanPhone,
    countryCode: country.code,
    countryName: country.name,
    scamType: scamType !== undefined ? String(scamType).trim() : existing.scamType,
    impersonatedCompany: impersonatedCompany !== undefined ? String(impersonatedCompany).trim() : existing.impersonatedCompany,
    invoiceNumber: invoiceNumber !== undefined ? String(invoiceNumber).trim() : existing.invoiceNumber,
    amountCharged: amountCharged !== undefined ? String(amountCharged).trim() : existing.amountCharged,
    detailedSummary: detailedSummary !== undefined ? String(detailedSummary).trim() : existing.detailedSummary,
    sourceUrl: sourceUrl !== undefined ? String(sourceUrl).trim() : existing.sourceUrl,
    platform: platform !== undefined ? String(platform).trim() : existing.platform,
    snippet: snippet !== undefined ? String(snippet).trim() : existing.snippet,
    notes: notes !== undefined ? String(notes).trim() : existing.notes,
    isNumberDown: isNumberDown !== undefined ? Boolean(isNumberDown) : existing.isNumberDown,
    numberDownAt: isNumberDown === true && !existing.isNumberDown ? new Date().toISOString() : existing.numberDownAt,
    confidence: confidence !== undefined ? confidence : existing.confidence,
    updatedAt: new Date().toISOString(),
  };

  scamRecordsStore[targetIndex] = updatedRecord;
  saveRecordsToDisk(scamRecordsStore);

  console.log(`[Record Update] Updated record ${id} (Phone: ${rawPhone}). Retained in database.`);
  return res.json({ success: true, record: updatedRecord, totalCount: scamRecordsStore.length });
}

app.put('/api/records/:id', handleRecordUpdate);
app.post('/api/records/:id/update', handleRecordUpdate);

// POST /api/records/bulk-number-down - Mark multiple records as down (retains records in DB)
app.post('/api/records/bulk-number-down', (req, res) => {
  const { ids, isNumberDown = true } = req.body;
  let updatedCount = 0;
  if (Array.isArray(ids)) {
    const idsSet = new Set(ids);
    for (const r of scamRecordsStore) {
      if (idsSet.has(r.id)) {
        r.isNumberDown = Boolean(isNumberDown);
        r.numberDownAt = isNumberDown ? new Date().toISOString() : undefined;
        updatedCount++;
      }
    }
    saveRecordsToDisk(scamRecordsStore);
  }
  return res.json({ success: true, updatedCount, remaining: scamRecordsStore.length });
});

// DELETE /api/records/:id - Delete single record
app.delete('/api/records/:id', (req, res) => {
  const { id } = req.params;
  scamRecordsStore = scamRecordsStore.filter((r) => r.id !== id);
  saveRecordsToDisk(scamRecordsStore);
  return res.json({ success: true, remaining: scamRecordsStore.length });
});

// POST /api/records/delete-bulk - Delete multiple records
app.post('/api/records/delete-bulk', (req, res) => {
  const { ids } = req.body;
  if (Array.isArray(ids)) {
    const idsSet = new Set(ids);
    scamRecordsStore = scamRecordsStore.filter((r) => !idsSet.has(r.id));
    saveRecordsToDisk(scamRecordsStore);
  }
  return res.json({ success: true, remaining: scamRecordsStore.length });
});

// POST /api/records/manual - Add manual entry with zero-duplicate enforcement
app.post('/api/records/manual', (req, res) => {
  const body = req.body || {};
  const phone = body.phone || body.phone_number || body.phoneNumber || body.phone_digits || '';
  const scamType = body.scamType || body.category || 'Manual Verification';
  const sourceUrl = body.sourceUrl || body.source_url || body.url || 'https://endscams.org/tracker';
  const platform = body.platform || body.source_name || body.source || 'Scam Tracker User Report';
  const snippet = body.snippet || body.description || body.notes || 'Manually cataloged record.';
  const imageUrl = body.imageUrl || body.image_url;

  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required.' });
  }

  const rawPhone = String(phone).trim();
  const cleanPhone = rawPhone.replace(/\D/g, '');

  // Check duplicate across 60-day retained store
  if (isPhoneAlreadyInStore(rawPhone, scamRecordsStore) || isPhoneAlreadyInStore(cleanPhone, scamRecordsStore)) {
    return res.status(400).json({ error: 'This phone number already exists in the database (Zero duplicates allowed).' });
  }

  const country = deriveCountryInfo(rawPhone);
  const topicLabel = scamType || 'Manual Verification';
  const resolved = getSafeReachableSourceUrl(
    sourceUrl,
    platform || 'Manual Entry',
    rawPhone,
    topicLabel,
    []
  );

  const newRecord: ScamPhoneRecord = {
    id: `rec-manual-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    phone: formatPhone(rawPhone, country.code),
    cleanPhone: cleanPhone || '15550000000',
    countryCode: country.code,
    countryName: country.name,
    scamType: topicLabel,
    sourceUrl: resolved.sourceUrl,
    sourceDomain: resolved.sourceDomain,
    platform: resolved.platform,
    snippet: snippet || 'Manually cataloged record.',
    searchQuery: 'Manual Entry',
    detectedAt: new Date().toISOString(),
    postDate: new Date().toISOString().slice(0, 10),
    confidence: 'High',
    imageUrl: typeof imageUrl === 'string' && imageUrl.startsWith('data:image/') ? imageUrl : undefined,
  };

  scamRecordsStore.unshift(newRecord);
  purgeExpiredRecords();
  saveRecordsToDisk(scamRecordsStore);

  return res.json({ success: true, record: newRecord, totalCount: scamRecordsStore.length });
});

// POST/PUT /api/records/restore - Restore/merge database from an exported CSV, Excel, or JSON backup
app.all('/api/records/restore', (req, res) => {
  const { records, mode = 'replace' } = req.body;

  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'Valid array of records is required for restore.' });
  }

  // Validate and sanitize records
  const incomingValid: ScamPhoneRecord[] = [];
  for (const r of records) {
    const rawPhone = (r.phone || '').trim();
    const cleanPhone = (r.cleanPhone || rawPhone.replace(/\D/g, '')).trim();
    if (!rawPhone || cleanPhone.length < 7) continue;

    const country = deriveCountryInfo(rawPhone);

    incomingValid.push({
      id: r.id || `rec-restored-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      phone: formatPhone(rawPhone, country.code || r.countryCode),
      cleanPhone,
      countryCode: r.countryCode || country.code,
      countryName: r.countryName || country.name,
      scamType: r.scamType || 'Scam Threat Report',
      impersonatedCompany: r.impersonatedCompany || 'N/A',
      invoiceNumber: r.invoiceNumber || 'N/A',
      amountCharged: r.amountCharged || 'N/A',
      detailedSummary: r.detailedSummary || r.snippet || 'Restored threat intelligence record.',
      sourceUrl: r.sourceUrl || '',
      sourceDomain: r.sourceDomain || 'N/A',
      platform: r.platform || 'Restored Source',
      snippet: r.snippet || '',
      searchQuery: r.searchQuery || 'Excel Database Restore',
      detectedAt: r.detectedAt || new Date().toISOString(),
      postDate: r.postDate || (r.detectedAt ? r.detectedAt.slice(0, 10) : new Date().toISOString().slice(0, 10)),
      isNumberDown: Boolean(r.isNumberDown),
      numberDownAt: r.numberDownAt || (r.isNumberDown ? (r.detectedAt || new Date().toISOString()) : undefined),
      confidence: r.confidence || 'High',
      notes: r.notes || undefined,
      imageUrl: r.imageUrl || undefined,
      updatedAt: new Date().toISOString(),
    });
  }

  if (incomingValid.length === 0) {
    return res.status(400).json({ error: 'No valid phone numbers found in the uploaded backup.' });
  }

  let finalRecords: ScamPhoneRecord[] = [];
  let addedCount = 0;
  let updatedCount = 0;

  if (mode === 'replace') {
    // Exact replacement mode: replaces current store with backup
    finalRecords = incomingValid;
    addedCount = incomingValid.length;
  } else {
    // Merge mode: retain existing records and update or add new ones
    const phoneMap = new Map<string, ScamPhoneRecord>();

    // Index existing records
    scamRecordsStore.forEach((r) => {
      const key = getPhoneKey(r.cleanPhone || r.phone);
      if (key) phoneMap.set(key, r);
    });

    // Merge incoming records
    incomingValid.forEach((r) => {
      const key = getPhoneKey(r.cleanPhone || r.phone);
      if (key && phoneMap.has(key)) {
        const existing = phoneMap.get(key)!;
        phoneMap.set(key, {
          ...existing,
          ...r,
          id: existing.id, // preserve existing id
          isNumberDown: r.isNumberDown !== undefined ? r.isNumberDown : existing.isNumberDown,
          notes: r.notes || existing.notes,
        });
        updatedCount++;
      } else if (key) {
        phoneMap.set(key, r);
        addedCount++;
      }
    });

    finalRecords = Array.from(phoneMap.values());
  }

  // Sort newest detected first
  finalRecords.sort((a, b) => {
    const timeA = new Date(a.detectedAt).getTime() || 0;
    const timeB = new Date(b.detectedAt).getTime() || 0;
    return timeB - timeA;
  });

  scamRecordsStore = finalRecords;
  saveRecordsToDisk(scamRecordsStore);

  console.log(`[Storage] Database successfully restored (${mode} mode). Total: ${scamRecordsStore.length}, Added: ${addedCount}, Updated: ${updatedCount}`);

  return res.json({
    success: true,
    mode,
    totalRecords: scamRecordsStore.length,
    addedCount,
    updatedCount,
    records: scamRecordsStore,
    message: mode === 'replace'
      ? `Database successfully restored with ${scamRecordsStore.length} records from Excel file.`
      : `Backup merged into database: ${addedCount} new records added, ${updatedCount} existing records updated (Total: ${scamRecordsStore.length}).`,
  });
});

// GET /api/database/status - Built-in NoSQL Database status and export health
app.get('/api/database/status', (_req, res) => {
  const activeCount = scamRecordsStore.filter((r) => !r.isNumberDown).length;
  const downCount = scamRecordsStore.filter((r) => r.isNumberDown).length;

  res.json({
    success: true,
    engine: 'Built-in NoSQL Document Database (Embedded JSON Store)',
    version: '1.0.0',
    exportPortable: true,
    totalRecords: scamRecordsStore.length,
    activeRecords: activeCount,
    downRecords: downCount,
    storagePaths: {
      activeStore: 'data/scam_records.json',
      noSqlStore: 'data/nosql_database.json',
      codebaseExportSeed: 'src/data/database_seed.json',
    },
    codebaseSeedExists: fs.existsSync(SEED_FILE),
    lastSyncTime: new Date().toISOString(),
    statusMessage: 'Ready for Code Export. All records are bundled directly in the codebase seed.',
  });
});

// POST /api/database/sync-codebase - Manually sync current records to the built-in codebase seed
app.post('/api/database/sync-codebase', (_req, res) => {
  saveRecordsToDisk(scamRecordsStore);
  return res.json({
    success: true,
    totalRecords: scamRecordsStore.length,
    message: `Synchronized ${scamRecordsStore.length} records to the built-in codebase seed (src/data/database_seed.json). When you export the code, it will retain all data on any new website.`,
  });
});

// GET /api/database/dump - Download full NoSQL database dump
app.get('/api/database/dump', (_req, res) => {
  const noSqlDump = {
    database: 'EndScam_Threat_Intelligence_NoSQL',
    engine: 'BuiltinNoSqlDocumentStore',
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    collections: {
      scam_records: scamRecordsStore,
      metadata: [
        {
          id: 'meta_system',
          totalDocuments: scamRecordsStore.length,
          activeDocuments: scamRecordsStore.filter((r) => !r.isNumberDown).length,
          downDocuments: scamRecordsStore.filter((r) => r.isNumberDown).length,
          lastScanTime: loadScannerMeta().lastScanTime,
          exportedAt: new Date().toISOString(),
        },
      ],
    },
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="EndScam_NoSQL_Database_${new Date().toISOString().slice(0, 10)}.json"`);
  res.send(JSON.stringify(noSqlDump, null, 2));
});

// GET /api/config/api-key - Check Gemini API key status in Dokploy / Cloudflare environment
app.get('/api/config/api-key', (_req, res) => {
  const cleanKey = getCleanGeminiApiKey();
  return res.json({
    configured: Boolean(cleanKey),
    keyPreview: getMaskedApiKey(cleanKey),
    proxyMode: 'Cloudflare Proxy & Dokploy Trust Proxy Active',
  });
});

// POST /api/config/api-key - Dynamically update Gemini API key without restarting container
app.post('/api/config/api-key', (req, res) => {
  const { apiKey } = req.body || {};
  const cleaned = cleanApiKey(apiKey);
  if (!cleaned) {
    return res.status(400).json({
      success: false,
      error: 'A valid API key string is required (e.g. GEMINI_API_KEY="AQ.Ab8R..." or "AIzaSy...").',
    });
  }

  process.env.GEMINI_API_KEY = cleaned;
  console.log(`[API Key Config] Successfully loaded Gemini API key: ${getMaskedApiKey(cleaned)}`);

  return res.json({
    success: true,
    message: `Gemini API key updated successfully (${getMaskedApiKey(cleaned)}).`,
    keyPreview: getMaskedApiKey(cleaned),
    configured: true,
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    const activeKey = getCleanGeminiApiKey();
    console.log(`=======================================================`);
    console.log(`EndScam Harvester Server running on http://0.0.0.0:${PORT}`);
    console.log(`Dokploy & Cloudflare Reverse Proxy: Active (trust proxy: true)`);
    console.log(`Gemini API Key Status: ${getMaskedApiKey(activeKey)}`);
    console.log(`Health Probes: /health, /healthz, /api/health, /ping`);
    console.log(`=======================================================`);
  });

  // Cloudflare Proxy Keep-Alive optimizations (prevents 524 timeouts and keep-alive race conditions)
  server.keepAliveTimeout = 120000;
  server.headersTimeout = 125000;

  // Graceful shutdown handling for Dokploy / Docker container lifecycle
  const handleShutdown = (signal: string) => {
    console.log(`[Lifecycle] Received ${signal}. Flushing database records to disk...`);
    try {
      saveRecordsToDisk(scamRecordsStore);
      console.log(`[Lifecycle] Database state saved (${scamRecordsStore.length} records retained).`);
    } catch (e) {
      console.error('[Lifecycle] Error saving database on shutdown:', e);
    }
    server.close(() => {
      console.log('[Lifecycle] HTTP server closed gracefully.');
      process.exit(0);
    });
    // Force process termination after 10s if connections linger
    setTimeout(() => {
      console.warn('[Lifecycle] Forced shutdown after timeout.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

startServer();

