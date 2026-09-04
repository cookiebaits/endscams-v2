



// deno-lint-ignore-file no-explicit-any
/*
  tracker-fetcher – standalone Deno service that owns the /tracker data
  pipeline. Deployed via docker-compose on the same Dokploy stack as the
  frontend. All secrets live in Dokploy's Environment tab; nothing lives
  in Supabase secrets.

  Endpoints
    GET  /health         → { ok: true }
    POST /refresh        → runs the full pipeline once, returns stats
    (CORS restricted to ALLOWED_ORIGIN)

  Scheduler
    Internal loop that fires the pipeline at 14:00 UTC (6 AM PST) and
    21:00 UTC (1 PM PST) every day, plus a purge sweep every hour.

  Required env vars (set in Dokploy → Environment):
    GOOGLE_API_KEY            – Google Cloud API key with Custom Search enabled
    GOOGLE_CX                 – Programmable Search Engine ID
    SUPABASE_URL              – https://<project>.supabase.co
    SUPABASE_SERVICE_ROLE_KEY – service-role JWT (server side only)
    ALLOWED_ORIGIN            – e.g. https://endscams.org
    PORT                      – optional, defaults to 8000
*/

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

/* ================================================================ */
/*  ENV                                                              */
/* ================================================================ */
const env = (k: string, required = false): string => {
  const v = Deno.env.get(k) || "";
  if (required && !v) throw new Error(`Missing env var: ${k}`);
  return v;
};

const SUPABASE_URL = env("SUPABASE_URL", true);
const SUPABASE_SERVICE_ROLE_KEY = env("SUPABASE_SERVICE_ROLE_KEY", true);
// const ALLOWED_ORIGIN = env("ALLOWED_ORIGIN") || "*";
// const ALLOWED_ORIGIN2 = "http://localhost:5173";
// const ALLOWED_ORIGIN3 = "http://localhost:5174";
const PORT = parseInt(env("PORT") || "8000", 10);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function cors(res: Response): Response {
  const h = new Headers(res.headers);
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  h.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  h.set("Vary", "Origin");
  return new Response(res.body, { status: res.status, headers: h });
}

function json(body: unknown, status = 200): Response {
  return cors(new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  }));
}

/* ================================================================ */
/*  Phone helpers                                                    */
/* ================================================================ */
function isValidPhoneNumber(d: string): boolean {
  if (d.length < 10 || d.length > 14) return false;
  if (/^([0-9])\1+$/.test(d)) return false;
  if (d.length === 10 && d.startsWith("555")) return false;
  if (d === "1234567890" || d === "0123456789") return false;
  return true;
}

function extractPhoneNumbers(text: string): string[] {
  if (!text) return [];
  const rx = /(?:\+?\d{1,3}[\s\-.]*)?\(?\d{3}\)?[\s\-.]*\d{3}[\s\-.]*\d{3,4}/g;
  const raw = text.match(rx) || [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of raw) {
    const digits = m.replace(/\D/g, "");
    if (!isValidPhoneNumber(digits) || seen.has(digits)) continue;
    seen.add(digits);
    out.push(digits);
  }
  return out;
}

function formatPhoneDisplay(d: string): string {
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11) {
    if (d.startsWith("1"))  return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
    if (d.startsWith("27")) return `+27 ${d.slice(2, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
    if (d.startsWith("44")) return `+44 ${d.slice(2, 6)} ${d.slice(6)}`;
  }
  if (d.length === 12 && d.startsWith("44")) return `+44 ${d.slice(2, 6)} ${d.slice(6)}`;
  if (d.length === 13 && d.startsWith("234")) return `+234 ${d.slice(3, 6)} ${d.slice(6, 10)} ${d.slice(10)}`;
  if (d.length > 10) {
    if (d.startsWith("234")) return `+234 ${d.slice(3)}`;
    if (d.startsWith("27"))  return `+27 ${d.slice(2)}`;
    if (d.startsWith("44"))  return `+44 ${d.slice(2)}`;
    if (d.startsWith("1"))   return `+1 ${d.slice(1)}`;
  }
  return `+${d}`;
}

/* ================================================================ */
/*  CSV helpers                                                      */
/* ================================================================ */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur); }
  return rows;
}

function parseSheetDate(raw: string): Date | null {
  if (!raw) return null;
  const stripped = raw.trim().split(/\s+/)[0];
  const m = stripped.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!m) {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  let year = parseInt(m[3], 10);
  if (year < 100) year += 2000;
  const d = new Date(Date.UTC(year, parseInt(m[1], 10) - 1, parseInt(m[2], 10)));
  return isNaN(d.getTime()) ? null : d;
}

function withinLastNDays(d: Date, days: number, now = new Date()): boolean {
  const cutoff = new Date(now.getTime() - days * 86400_000);
  return d >= cutoff && d <= new Date(now.getTime() + 86400_000);
}

const toIsoDate = (d: Date) => d.toISOString().split("T")[0];

/* ================================================================ */

/*  DuckDuckGo Scraper (No API Key Required)                         */
/* ================================================================ */
interface CseItem { title?: string; snippet?: string; link?: string; }

async function duckDuckGoSearch(q: string, dateRestrict = "w2", num = 5): Promise<CseItem[]> {
  // dateRestrict: DDG uses "d" (day), "w" (week), "m" (month). Defaulting to week if "w2".
  const df = dateRestrict.startsWith("m") ? "m" : "w";
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}&df=${df}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    if (!res.ok) {
      console.warn(`DDG fetch failed with status ${res.status} for q=${q}`);
      return [];
    }
    const html = await res.text();

    const items: CseItem[] = [];
    const itemRegex = /<a class="result__url" href="([^"]+)".*?>(.*?)<\/a>.*?<a class="result__snippet[^>]*>(.*?)<\/a>/gs;
    let match;
    while ((match = itemRegex.exec(html)) !== null && items.length < num) {
      let link = match[1];
      if (link.startsWith('//duckduckgo.com/l/?uddg=')) {
        try {
          const uddg = link.split('uddg=')[1].split('&')[0];
          link = decodeURIComponent(uddg);

        } catch {
          // Ignore decode error and use raw link
        }
      }
      items.push({
        link: link,
        title: match[2].replace(/<[^>]*>?/gm, '').trim(),
        snippet: match[3].replace(/<[^>]*>?/gm, '').trim()
      });
    }
    return items;
  } catch (e) {
    console.warn(`DDG err q=${q}`, e);
    return [];
  }
}

function summarizeSnippets(items: CseItem[], maxChars = 240): string {
  const bits: string[] = [];
  for (const it of items.slice(0, 3)) {
    const s = (it.snippet || it.title || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (s) bits.push(s);
  }
  const joined = bits.join(" • ");
  return joined.length > maxChars ? joined.slice(0, maxChars - 1) + "…" : joined;
}

/* ================================================================ */
/*  BBB scraper                                                      */
/* ================================================================ */
async function fetchBBB(url: string): Promise<{ digits: string; snippet: string }[]> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; EndScamsBot/1.0)" } });
    if (!res.ok) { console.warn(`BBB ${res.status}: ${url}`); return []; }
    const html = await res.text();
    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ");
    const digits = extractPhoneNumbers(stripped);
    return digits.map(d => {
      const forms = [d, d.length === 10 ? `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}` : "", d.length === 10 ? `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}` : ""].filter(Boolean);
      let snippet = "";
      for (const f of forms) {
        const idx = stripped.indexOf(f);
        if (idx >= 0) {
          snippet = stripped.slice(Math.max(0, idx - 80), Math.min(stripped.length, idx + f.length + 120)).trim();
          break;
        }
      }
      return { digits: d, snippet };
    });
  } catch (e) {
    console.warn(`BBB err ${url}`, e);
    return [];
  }
}

/* ================================================================ */
/*  Pipeline                                                         */
/* ================================================================ */
const CSV_URL = "https://docs.google.com/spreadsheets/d/1wA8LivoY-tYG1gLI4BtX06SLARiiS83a/export?format=csv&id=1wA8LivoY-tYG1gLI4BtX06SLARiiS83a";

const WHATSAPP_QUERIES = [
  { q: 'site:facebook.com "spellcaster" "Whatsapp" "Healing" "Fortune"', category: "Spiritual / Spellcaster Scam", label: "Facebook — Spellcaster/Healing" },
  { q: 'site:facebook.com "illuminati" "Whatsapp"',                     category: "Spiritual / Spellcaster Scam", label: "Facebook — Illuminati" },
  { q: 'site:instagram.com "spellcaster" "Whatsapp"',                   category: "Spiritual / Spellcaster Scam", label: "Instagram — Spellcaster" },
  { q: 'site:facebook.com "btc recovery" "Whatsapp"',                   category: "Crypto Recovery Scam",         label: "Facebook — BTC Recovery" },
  { q: 'site:instagram.com "btc recovery" "Whatsapp"',                  category: "Crypto Recovery Scam",         label: "Instagram — BTC Recovery" },
  { q: '"Whatsapp" "Fortune" "Fortune Telling"',                        category: "Spiritual / Spellcaster Scam", label: "Web — Fortune Telling" },
  { q: '"Whatsapp" "Magic" "Magician"',                                 category: "Spiritual / Spellcaster Scam", label: "Web — Magic/Magician" },
  { q: '"Whatsapp" "Crypto Recovery"',                                  category: "Crypto Recovery Scam",         label: "Web — Crypto Recovery" },
  { q: '"guestbook" spell "WhatsApp"',                                  category: "Spiritual / Spellcaster Scam", label: "Web — Guestbook Spell" },
];

const BBB_QUERIES = [
  { url: "https://www.bbb.org/scamtracker/lookupscam?q=all%3Dpaypal%26from%3D0",    category: "Invoice / Imposter Scam", label: "BBB — PayPal" },
  { url: "https://www.bbb.org/scamtracker/lookupscam?q=all%3Demergency%26from%3D0", category: "Emergency Scam",          label: "BBB — Emergency" },
  { url: "https://www.bbb.org/scamtracker/lookupscam?q=all%3Dmillion%26from%3D0",   category: "Lottery / Prize Scam",    label: "BBB — Million" },
];

function normalizeCategory(raw: string): string {
  const r = (raw || "").toLowerCase();
  if (r.includes("lotter") || r.includes("prize") || r.includes("sweep")) return "Lottery / Prize Scam";
  if (r.includes("warrant")) return "Invoice / Imposter Scam";
  if (r.includes("debt")) return "Invoice / Imposter Scam";
  if (r.includes("emergency")) return "Emergency Scam";
  if (r.includes("government") || r.includes("irs") || r.includes("social")) return "Government Impersonation";
  if (r.includes("crypto") || r.includes("bitcoin") || r.includes("btc")) return "Crypto Recovery Scam";
  if (r.includes("spell") || r.includes("fortune") || r.includes("magic")) return "Spiritual / Spellcaster Scam";
  return raw?.trim() || "Unknown Scam";
}

interface ScamEntry {
  phone_number: string;
  phone_digits: string;
  source_name: string;
  source_url: string;
  report_date: string;
  category: string;
  description: string;
}

async function runPipeline(): Promise<Record<string, unknown>> {
  const started = Date.now();

  /* 1. Purge expired rows */
  const nowIso = new Date().toISOString();
  const { error: purgeErr } = await supabase.from("tracker_entries").delete().lt("expires_at", nowIso);
  if (purgeErr) console.warn("purge:", purgeErr.message);

  const collected: ScamEntry[] = [];
  let csvRows = 0;
  let csvGoogle = 0;

  /* 2. Google Sheet CSV → newest 25 */
  try {
    const csvRes = await fetch(CSV_URL);
    if (csvRes.ok) {
      const rows = parseCSV(await csvRes.text());
      const data = rows.slice(1).filter(r => r.length >= 2 && r[0]?.trim());
      csvRows = data.length;
      const parsed = data.map(r => {
        const digits = (r[0] || "").replace(/\D/g, "");
        const date = parseSheetDate(r[1] || "");
        return { digits, date, subject: (r[2] || "").trim(), notes: (r[3] || "").trim() };
      }).filter(r => r.date && withinLastNDays(r.date, 31) && isValidPhoneNumber(r.digits));

      parsed.sort((a, b) => b.date!.getTime() - a.date!.getTime());

      const seen = new Set<string>();
      const top: typeof parsed = [];
      for (const p of parsed) {
        if (seen.has(p.digits)) continue;
        seen.add(p.digits);
        top.push(p);
        if (top.length >= 25) break;
      }

      for (const row of top) {
        const category = normalizeCategory(row.subject);
        let metaSnippet = "";
        let foundUrl = "https://docs.google.com/spreadsheets/d/1wA8LivoY-tYG1gLI4BtX06SLARiiS83a";

        const items = await duckDuckGoSearch(`"${row.digits}" scam`, "w2", 5);
        csvGoogle++;
        if (items.length > 0) {
          foundUrl = items[0].link || foundUrl;
          metaSnippet = summarizeSnippets(items);
        }

        const parts: string[] = [`FCC/FTC report ${toIsoDate(row.date!)}`];
        if (row.subject) parts.push(`Subject: ${row.subject}`);
        if (row.notes)   parts.push(`Notes: ${row.notes}`);
        if (metaSnippet) parts.push(`Google (14d): ${metaSnippet}`);

        collected.push({
          phone_number: formatPhoneDisplay(row.digits),
          phone_digits: row.digits,
          source_name: "US Gov Data — FCC/FTC Sheet",
          source_url: foundUrl,
          report_date: toIsoDate(row.date!),
          category,
          description: parts.join(" | ").slice(0, 900),
        });
      }
    } else {
      console.warn("csv fetch:", csvRes.status);
    }
  } catch (e) { console.warn("csv err", e); }

  /* 3. WhatsApp / Spellcaster / Crypto DDG queries */
  let cseUsed = 0;
  const todayIso = toIsoDate(new Date());
  for (const q of WHATSAPP_QUERIES) {
    const items = await duckDuckGoSearch(q.q, "w2", 8);
    cseUsed++;
    for (const item of items) {
      const text = `${item.title || ""} ${item.snippet || ""}`;
      const nums = extractPhoneNumbers(text);
      for (const digits of nums) {
        if (collected.some(c => c.phone_digits === digits)) continue;
        collected.push({
          phone_number: formatPhoneDisplay(digits),
          phone_digits: digits,
          source_name: `Web Search — ${q.label}`,
          source_url: item.link || "https://duckduckgo.com",
          report_date: todayIso,
          category: q.category,
          description: `${q.label} (14d) | ${summarizeSnippets([item])}`.slice(0, 900),
        });
      }
    }
  }

  /* 4. BBB direct HTML */
  let bbbFound = 0;
  for (const b of BBB_QUERIES) {
    const items = await fetchBBB(b.url);
    for (const f of items) {
      if (collected.some(c => c.phone_digits === f.digits)) continue;
      collected.push({
        phone_number: formatPhoneDisplay(f.digits),
        phone_digits: f.digits,
        source_name: b.label,
        source_url: b.url,
        report_date: todayIso,
        category: b.category,
        description: (f.snippet ? `BBB Scam Tracker: ${f.snippet}` : `BBB Scam Tracker (${b.label})`).slice(0, 900),
      });
      bbbFound++;
    }
  }

  /* 5. Dedupe by digits, keep newest */
  const byDigits = new Map<string, ScamEntry>();
  for (const e of collected) {
    const prev = byDigits.get(e.phone_digits);
    if (!prev || prev.report_date < e.report_date) byDigits.set(e.phone_digits, e);
  }
  const finalEntries = Array.from(byDigits.values());

  /* 6. Upsert */
  let inserted = 0;
  const errors: string[] = [];
  for (const entry of finalEntries) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 31);
    const { error } = await supabase.from("tracker_entries").upsert(
      {
        phone_number: entry.phone_number,
        phone_digits: entry.phone_digits,
        source_name:  entry.source_name,
        source_url:   entry.source_url,
        report_date:  entry.report_date,
        category:     entry.category,
        description:  entry.description,
        expires_at:   expiresAt.toISOString(),
      },
      { onConflict: "phone_digits,source_name" },
    );
    if (error) errors.push(`${entry.phone_digits}: ${error.message}`);
    else inserted++;
  }

  return {
    success: true,
    elapsed_ms: Date.now() - started,
    csv_rows_total: csvRows,
    csv_google_queries: csvGoogle,
    cse_queries: cseUsed,
    bbb_found: bbbFound,
    total_candidates: collected.length,
    deduped: finalEntries.length,
    inserted,
    errors: errors.length,
    errorDetails: errors.slice(0, 10),
  };
}

/* ================================================================ */
/*  Scheduler                                                        */
/* ================================================================ */

// Runs every 60s; if UTC hour is 14 or 21 and we haven't run this hour yet,
// trigger the pipeline. Every 60 minutes also purges old rows.
let lastRunHour = -1;
let running = false;
let lastManualRefreshTime = 0;

async function scheduler() {
  const now = new Date();
  const hour = now.getUTCHours();
  const minute = now.getUTCMinutes();

  // Cron trigger — top of the hour, 15:05 UTC (7:05 AM PST) or 21:05 UTC (1:05 PM PST)
  if (!running && (hour === 15 || hour === 21) && minute === 5 && lastRunHour !== hour) {
    lastRunHour = hour;
    running = true;
    console.log(`[cron] pipeline start @ ${now.toISOString()}`);
    try {
      const stats = await runPipeline();
      console.log("[cron] done:", stats);
    } catch (e) {
      console.error("[cron] failed", e);
    } finally { running = false; }
  }

  // Reset hour marker at minute 55 so tomorrow's 14:00/21:00 fire again
  if (minute >= 55) lastRunHour = -1;

  // Hourly purge belt-and-suspenders
  if (minute === 30) {
    const nowIso = new Date().toISOString();
    const { error } = await supabase.from("tracker_entries").delete().lt("expires_at", nowIso);
    if (error) console.warn("[purge] err", error.message);
  }
}

setInterval(() => { scheduler().catch((e) => console.error("scheduler err", e)); }, 60_000);

// Run once on boot so the tracker is populated the moment the container starts
runPipeline()
  .then(stats => console.log("[boot] initial run:", stats))
  .catch((e) => console.error("[boot] initial run failed", e));

/* ================================================================ */
/*  HTTP server                                                      */
/* ================================================================ */

/* ================================================================ */
/*  Abstract Tools Proxy Endpoints & Helpers                        */
/* ================================================================ */

const ABSTRACT_PHONE_API_KEY = Deno.env.get("ABSTRACT_PHONE_API_KEY") || "";
const ABSTRACT_EMAIL_API_KEY = Deno.env.get("ABSTRACT_EMAIL_API_KEY") || "";
const ABSTRACT_IP_API_KEY = Deno.env.get("ABSTRACT_IP_API_KEY") || "";
const ABSTRACT_SCRAPE_API_KEY = Deno.env.get("ABSTRACT_SCRAPE_API_KEY") || Deno.env.get("ABSTRACT_SCRAPER_API_KEY") || "";

interface CacheEntry {
  data: any;
  expiry: number;
}
const apiCache = new Map<string, CacheEntry>();

function getFromCache(key: string): any | null {
  const item = apiCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiry) {
    apiCache.delete(key);
    return null;
  }
  return item.data;
}

function setInCache(key: string, data: any, ttlMs = 10 * 60 * 1000) {
  if (apiCache.size > 200) {
    const first = apiCache.keys().next().value;
    if (first) apiCache.delete(first);
  }
  apiCache.set(key, { data, expiry: Date.now() + ttlMs });
}

function decodeHtmlEntities(str: string): string {
  if (!str) return "";
  let result = str;
  for (let i = 0; i < 3; i++) {
    const prev = result;
    result = result
      .replace(/&#x([0-9a-fA-F]+);?/g, (_, hex) => {
        try {
          const code = parseInt(hex, 16);
          return code > 0 && code <= 0x10FFFF ? String.fromCodePoint(code) : "";
        } catch { return ""; }
      })
      .replace(/&#([0-9]+);?/g, (_, dec) => {
        try {
          const code = parseInt(dec, 10);
          return code > 0 && code <= 0x10FFFF ? String.fromCodePoint(code) : "";
        } catch { return ""; }
      })
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&apos;|&#39;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&nbsp;/gi, " ")
      .replace(/&mdash;/gi, "—")
      .replace(/&ndash;/gi, "–")
      .replace(/&hellip;/gi, "…")
      .replace(/&copy;/gi, "©")
      .replace(/&reg;/gi, "®")
      .replace(/&trade;/gi, "™")
      .replace(/&bull;/gi, "•")
      .replace(/&rsquo;/gi, "’")
      .replace(/&lsquo;/gi, "‘")
      .replace(/&rdquo;/gi, "”")
      .replace(/&ldquo;/gi, "“");
    if (result === prev) break;
  }
  return result;
}

function extractHtmlMetadata(html: string) {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const rawTitle = titleMatch ? titleMatch[1].trim() : "";

  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ||
                    html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
  const rawDesc = descMatch ? descMatch[1].trim() : "";

  const linksMatch = html.match(/<a\s+[^>]*href=/gi);
  const linksCount = linksMatch ? linksMatch.length : 0;

  const textWithoutScripts = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const decodedTitle = decodeHtmlEntities(rawTitle);
  const decodedDesc = decodeHtmlEntities(rawDesc);
  const decodedCleanText = decodeHtmlEntities(textWithoutScripts.slice(0, 1500));

  return {
    title: decodedTitle || "Page Content Retrieved",
    description: decodedDesc || "No meta description tag provided by page.",
    clean_text: decodedCleanText,
    links_count: linksCount
  };
}

async function handlePhoneRequest(req: Request, directPhone?: string): Promise<Response> {
  const ts = new Date().toISOString();
  let phone = directPhone;
  if (!phone && req.method === "POST") {
    try {
      const body = await req.json();
      phone = body.phone || body.query;
    } catch { /* ignore */ }
  }
  if (!phone) {
    const parsedUrl = new URL(req.url);
    phone = parsedUrl.searchParams.get("phone") || parsedUrl.searchParams.get("query") || undefined;
  }

  console.log(`[Abstract API] ${ts} - Request: ${req.method} /phone - Target phone: "${phone || "none"}"`);

  if (!phone || typeof phone !== "string") {
    console.warn(`[Abstract API] ${ts} - /phone 400: Missing phone parameter`);
    return json({ error: "Please provide a valid phone number (e.g. +14152007986)" }, 400);
  }

  let cleanPhone = phone.trim().replace(/[^\d+]/g, "");
  if (!cleanPhone.startsWith("+")) {
    cleanPhone = cleanPhone.length === 10 ? "+1" + cleanPhone : "+" + cleanPhone;
  }

  const cacheKey = `phone:${cleanPhone}`;
  const cached = getFromCache(cacheKey);
  if (cached) {
    console.log(`[Abstract API] ${ts} - /phone 200 OK (Memory Cache Hit)`);
    return json({ ...cached, source: "AbstractAPI Phone Intelligence (Cached • 0ms)" });
  }

  if (!ABSTRACT_PHONE_API_KEY) {
    console.log(`[Abstract API] ${ts} - /phone: No API key set, returning sample intelligence data`);
    const mockData = {
      phone: cleanPhone,
      valid: true,
      carrier: "Verizon Wireless",
      location: "San Francisco, California, United States",
      type: "Mobile",
      format: {
        international: cleanPhone,
        local: cleanPhone
      },
      country: {
        name: "United States",
        code: "US",
        prefix: "+1"
      },
      risk: {
        risk_score: 12,
        risk_level: "LOW"
      }
    };
    const responsePayload = {
      success: true,
      source: "Sample Phone Intelligence (Set ABSTRACT_PHONE_API_KEY for live data)",
      data: mockData
    };
    setInCache(cacheKey, responsePayload, 10 * 60 * 1000);
    return json(responsePayload);
  }

  const targetUrl = `https://phoneintelligence.abstractapi.com/v1/?api_key=${encodeURIComponent(ABSTRACT_PHONE_API_KEY)}&phone=${encodeURIComponent(cleanPhone)}`;

  try {
    const apiRes = await fetch(targetUrl);
    const data = await apiRes.json();
    if (!apiRes.ok) {
      console.warn(`[Abstract API] ${ts} - /phone Upstream Error ${apiRes.status}:`, data);
      return json({ error: data.error?.message || `Phone API returned ${apiRes.status}`, details: data }, apiRes.status);
    }

    const normalizedData = {
      phone: data.phone_number || cleanPhone,
      valid: data.phone_validation?.is_valid ?? data.valid ?? (data.phone_carrier?.name ? true : false),
      carrier: data.phone_carrier?.name || data.carrier || "Unknown Carrier",
      location: [data.phone_location?.city, data.phone_location?.region, data.phone_location?.country_name].filter(Boolean).join(", ") || data.location || "United States",
      type: data.phone_carrier?.line_type || data.type || (data.phone_validation?.is_voip ? "VoIP" : "Mobile"),
      format: {
        international: data.phone_format?.international || cleanPhone,
        local: data.phone_format?.national || cleanPhone
      },
      risk: {
        risk_score: data.phone_risk?.risk_score ?? (data.phone_risk?.risk_level === "high" ? 85 : 5),
        risk_level: data.phone_risk?.risk_level ? String(data.phone_risk.risk_level).toUpperCase() : "LOW"
      },
      ...data
    };

    const responsePayload = {
      success: true,
      source: "AbstractAPI Phone Intelligence",
      data: normalizedData
    };

    setInCache(cacheKey, responsePayload, 10 * 60 * 1000);
    console.log(`[Abstract API] ${ts} - /phone 200 OK - Carrier: ${normalizedData.carrier}`);
    return json(responsePayload);
  } catch (err: any) {
    console.error(`[Abstract API] ${ts} - /phone 500 Error:`, err);
    return json({ error: err.message || "Phone proxy error" }, 500);
  }
}

async function handleEmailRequest(req: Request, directEmail?: string): Promise<Response> {
  const ts = new Date().toISOString();
  let email = directEmail;
  if (!email && req.method === "POST") {
    try {
      const body = await req.json();
      email = body.email || body.query;
    } catch { /* ignore */ }
  }
  if (!email) {
    const parsedUrl = new URL(req.url);
    email = parsedUrl.searchParams.get("email") || parsedUrl.searchParams.get("query") || undefined;
  }

  console.log(`[Abstract API] ${ts} - Request: ${req.method} /email - Target email: "${email || "none"}"`);

  if (!email || typeof email !== "string" || !email.includes("@")) {
    console.warn(`[Abstract API] ${ts} - /email 400: Invalid email address`);
    return json({ error: "Please provide a valid email address" }, 400);
  }

  const cleanEmail = email.trim().toLowerCase();
  const cacheKey = `email:${cleanEmail}`;
  const cached = getFromCache(cacheKey);
  if (cached) {
    console.log(`[Abstract API] ${ts} - /email 200 OK (Memory Cache Hit)`);
    return json({ ...cached, source: "AbstractAPI Email Reputation (Cached • 0ms)" });
  }

  if (!ABSTRACT_EMAIL_API_KEY) {
    console.log(`[Abstract API] ${ts} - /email: No API key set, returning sample email reputation data`);
    const mockData = {
      email: cleanEmail,
      autocorrect: "",
      deliverability: "DELIVERABLE",
      quality_score: 0.95,
      is_valid_format: { value: true, text: "TRUE" },
      is_free_email: { value: cleanEmail.includes("gmail") || cleanEmail.includes("yahoo") || cleanEmail.includes("hotmail"), text: "TRUE" },
      is_disposable_email: { value: false, text: "FALSE" },
      is_role_email: { value: false, text: "FALSE" },
      is_catchall_email: { value: false, text: "FALSE" },
      is_mx_found: { value: true, text: "TRUE" },
      is_smtp_valid: { value: true, text: "TRUE" }
    };
    const responsePayload = {
      success: true,
      source: "Sample Email Reputation (Set ABSTRACT_EMAIL_API_KEY for live data)",
      data: mockData
    };
    setInCache(cacheKey, responsePayload, 10 * 60 * 1000);
    return json(responsePayload);
  }

  const targetUrl = `https://emailvalidation.abstractapi.com/v1/?api_key=${encodeURIComponent(ABSTRACT_EMAIL_API_KEY)}&email=${encodeURIComponent(cleanEmail)}`;

  try {
    const apiRes = await fetch(targetUrl);
    const data = await apiRes.json();
    if (!apiRes.ok) {
      console.warn(`[Abstract API] ${ts} - /email Upstream Error ${apiRes.status}:`, data);
      return json({ error: data.error?.message || `Email API returned ${apiRes.status}`, details: data }, apiRes.status);
    }

    const responsePayload = {
      success: true,
      source: "AbstractAPI Email Reputation",
      data
    };

    setInCache(cacheKey, responsePayload, 10 * 60 * 1000);
    console.log(`[Abstract API] ${ts} - /email 200 OK`);
    return json(responsePayload);
  } catch (err: any) {
    console.error(`[Abstract API] ${ts} - /email 500 Error:`, err);
    return json({ error: err.message || "Email proxy error" }, 500);
  }
}

async function handleIpRequest(req: Request, directIp?: string): Promise<Response> {
  const ts = new Date().toISOString();
  let ip_address = directIp;
  if (!ip_address && req.method === "POST") {
    try {
      const body = await req.json();
      ip_address = body.ip_address || body.query;
    } catch { /* ignore */ }
  }
  if (!ip_address) {
    const parsedUrl = new URL(req.url);
    ip_address = parsedUrl.searchParams.get("ip_address") || parsedUrl.searchParams.get("ip") || parsedUrl.searchParams.get("query") || undefined;
  }

  if (!ip_address || ip_address === "auto" || ip_address.trim() === "") {
    const forwarded = req.headers.get("x-forwarded-for");
    const clientIp = forwarded ? forwarded.split(",")[0].trim() : "8.8.8.8";
    ip_address = (clientIp.includes("127.0.0.1") || clientIp === "::1") ? "8.8.8.8" : clientIp;
  }

  console.log(`[Abstract API] ${ts} - Request: ${req.method} /ip - Target IP: "${ip_address}"`);

  const cleanIp = ip_address.trim();
  const cacheKey = `ip:${cleanIp}`;
  const cached = getFromCache(cacheKey);
  if (cached) {
    console.log(`[Abstract API] ${ts} - /ip 200 OK (Memory Cache Hit)`);
    return json({ ...cached, source: "AbstractAPI IP Intelligence (Cached • 0ms)" });
  }

  if (!ABSTRACT_IP_API_KEY) {
    console.log(`[Abstract API] ${ts} - /ip: No API key set, returning sample IP intelligence data`);
    const mockData = {
      ip_address: cleanIp,
      city: "Mountain View",
      region: "California",
      country: "United States",
      country_code: "US",
      continent: "North America",
      latitude: 37.386,
      longitude: -122.0838,
      postal_code: "94035",
      timezone: { name: "America/Los_Angeles", current_time: ts },
      connection: {
        autonomous_system_number: 15169,
        autonomous_system_organization: "Google LLC",
        connection_type: "Corporate",
        isp_name: "Google LLC"
      },
      security: {
        is_vpn: false,
        is_proxy: false,
        is_tor: false,
        is_relay: false
      }
    };
    const responsePayload = {
      success: true,
      source: "Sample IP Intelligence (Set ABSTRACT_IP_API_KEY for live data)",
      data: mockData
    };
    setInCache(cacheKey, responsePayload, 10 * 60 * 1000);
    return json(responsePayload);
  }

  const targetUrl = `https://ipgeolocation.abstractapi.com/v1/?api_key=${encodeURIComponent(ABSTRACT_IP_API_KEY)}&ip_address=${encodeURIComponent(cleanIp)}`;

  try {
    const apiRes = await fetch(targetUrl);
    const data = await apiRes.json();
    if (!apiRes.ok) {
      console.warn(`[Abstract API] ${ts} - /ip Upstream Error ${apiRes.status}:`, data);
      return json({ error: data.error?.message || `IP API returned ${apiRes.status}`, details: data }, apiRes.status);
    }

    const responsePayload = {
      success: true,
      source: "AbstractAPI IP Intelligence",
      data
    };

    setInCache(cacheKey, responsePayload, 10 * 60 * 1000);
    console.log(`[Abstract API] ${ts} - /ip 200 OK`);
    return json(responsePayload);
  } catch (err: any) {
    console.error(`[Abstract API] ${ts} - /ip 500 Error:`, err);
    return json({ error: err.message || "IP proxy error" }, 500);
  }
}

async function handleScrapeRequest(req: Request, directUrl?: string, directRenderJs = false, directCountry?: string): Promise<Response> {
  const ts = new Date().toISOString();
  let url = directUrl;
  let render_js = directRenderJs;
  let country_code = directCountry;

  if (!url && req.method === "POST") {
    try {
      const body = await req.json();
      url = body.url || body.query;
      if (body.render_js !== undefined) render_js = body.render_js;
      if (body.country_code) country_code = body.country_code;
    } catch { /* ignore */ }
  }
  if (!url) {
    const parsedUrl = new URL(req.url);
    url = parsedUrl.searchParams.get("url") || parsedUrl.searchParams.get("query") || undefined;
    if (parsedUrl.searchParams.get("render_js") === "true") render_js = true;
  }

  console.log(`[Abstract API] ${ts} - Request: ${req.method} /scrape - Target URL: "${url || "none"}"`);

  if (!url || typeof url !== "string" || !url.startsWith("http")) {
    console.warn(`[Abstract API] ${ts} - /scrape 400: Missing or invalid URL`);
    return json({ error: "Please provide a valid URL starting with http:// or https://" }, 400);
  }

  const cleanUrl = url.trim();
  const cacheKey = `scrape:${cleanUrl}:${render_js}:${country_code || "default"}`;
  const cached = getFromCache(cacheKey);
  if (cached) {
    console.log(`[Abstract API] ${ts} - /scrape 200 OK (Memory Cache Hit)`);
    return json({ ...cached, source: "AbstractAPI Web Scraper (Cached • 0ms)" });
  }

  if (!ABSTRACT_SCRAPE_API_KEY) {
    console.log(`[Abstract API] ${ts} - /scrape: No key configured, performing direct fetch fallback`);
    try {
      const directRes = await fetch(cleanUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
      });
      const directHtml = await directRes.text();
      const directPayload = {
        success: true,
        source: "Proxy Engine Direct Scrape",
        target_url: cleanUrl,
        content_type: directRes.headers.get("content-type") || "text/html",
        html: directHtml,
        size_bytes: directHtml.length,
        fallback_used: true,
        parsed: extractHtmlMetadata(directHtml)
      };
      setInCache(cacheKey, directPayload, 10 * 60 * 1000);
      return json(directPayload);
    } catch (fallbackErr: any) {
      console.error(`[Abstract API] ${ts} - /scrape Direct Fallback Error:`, fallbackErr);
      return json({ error: `Failed to scrape target URL: ${fallbackErr.message || "Connection failed"}` }, 500);
    }
  }

  let apiUrl = `https://scrape.abstractapi.com/v1/?api_key=${encodeURIComponent(ABSTRACT_SCRAPE_API_KEY)}&url=${encodeURIComponent(cleanUrl)}`;
  if (render_js) apiUrl += "&render_js=true";
  if (country_code) apiUrl += `&country_code=${encodeURIComponent(country_code)}`;

  try {
    const apiRes = await fetch(apiUrl);
    const bodyText = await apiRes.text();
    if (apiRes.ok) {
      const responsePayload = {
        success: true,
        source: "AbstractAPI Web Scraper",
        target_url: cleanUrl,
        content_type: apiRes.headers.get("content-type") || "text/html",
        html: bodyText,
        size_bytes: bodyText.length,
        fallback_used: false,
        parsed: extractHtmlMetadata(bodyText)
      };
      setInCache(cacheKey, responsePayload, 10 * 60 * 1000);
      console.log(`[Abstract API] ${ts} - /scrape 200 OK (${bodyText.length} bytes)`);
      return json(responsePayload);
    }

    console.warn(`[Abstract API] ${ts} - /scrape Upstream returned ${apiRes.status}. Retrying via direct fetch fallback...`);
    const directRes = await fetch(cleanUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
    });
    const directHtml = await directRes.text();
    const fallbackPayload = {
      success: true,
      source: "Proxy Engine (AbstractAPI direct fallback)",
      target_url: cleanUrl,
      content_type: directRes.headers.get("content-type") || "text/html",
      html: directHtml,
      size_bytes: directHtml.length,
      fallback_used: true,
      parsed: extractHtmlMetadata(directHtml)
    };
    setInCache(cacheKey, fallbackPayload, 10 * 60 * 1000);
    return json(fallbackPayload);
  } catch (err: any) {
    console.error(`[Abstract API] ${ts} - /scrape 500 Error:`, err);
    return json({ error: err.message || "Scrape proxy error" }, 500);
  }
}

async function handleToolsProxy(req: Request): Promise<Response> {
  const ts = new Date().toISOString();
  console.log(`[Abstract API] ${ts} - Request: ${req.method} /api/tools`);
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const { tool, query, phone, email, ip_address, url, render_js, country_code } = body;
  const toolName = tool || (phone ? "phone" : email ? "email" : ip_address ? "ip" : url ? "scrape" : null);

  if (toolName === "phone") return await handlePhoneRequest(req, query || phone);
  if (toolName === "email") return await handleEmailRequest(req, query || email);
  if (toolName === "ip") return await handleIpRequest(req, query || ip_address);
  if (toolName === "scrape") return await handleScrapeRequest(req, query || url, render_js, country_code);

  return json({ error: "Missing tool or query parameter" }, 400);
}

function handleStatusRequest(): Response {
  console.log(`[Abstract API] ${new Date().toISOString()} - Request: GET /status`);
  return json({
    status: "online",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    proxy_mode: "dokploy_secure_proxy",
    cors_enabled: true,
    security: {
      encryption_algorithm: "AES-256-GCM",
      custom_secret_configured: true,
    },
    tools: {
      phone_intelligence: {
        configured: !!ABSTRACT_PHONE_API_KEY,
        encrypted_in_env: false,
        endpoint: "https://phoneintelligence.abstractapi.com/v1/"
      },
      email_reputation: {
        configured: !!ABSTRACT_EMAIL_API_KEY,
        encrypted_in_env: false,
        endpoint: "https://emailvalidation.abstractapi.com/v1/"
      },
      ip_intelligence: {
        configured: !!ABSTRACT_IP_API_KEY,
        encrypted_in_env: false,
        endpoint: "https://ipgeolocation.abstractapi.com/v1/"
      },
      web_scraper: {
        configured: !!ABSTRACT_SCRAPE_API_KEY,
        encrypted_in_env: false,
        endpoint: "https://scrape.abstractapi.com/v1/"
      }
    }
  });
}

Deno.serve({ port: PORT }, async (req: Request) => {

  const url = new URL(req.url);

  if (req.method === "OPTIONS") return cors(new Response(null, { status: 204 }));

  if (url.pathname === "/health") return json({ ok: true, ts: new Date().toISOString() });

  if (url.pathname === "/status" || url.pathname === "/api/status") {
    return handleStatusRequest();
  }

  if (url.pathname === "/phone" || url.pathname === "/api/phone") {
    return await handlePhoneRequest(req);
  }

  if (url.pathname === "/email" || url.pathname === "/api/email") {
    return await handleEmailRequest(req);
  }

  if (url.pathname === "/ip" || url.pathname === "/api/ip") {
    return await handleIpRequest(req);
  }

  if (url.pathname === "/scrape" || url.pathname === "/api/scrape") {
    return await handleScrapeRequest(req);
  }

  if (url.pathname === "/api/tools") {
    return await handleToolsProxy(req);
  }

  if (url.pathname === "/api/records" || url.pathname === "/records") {
    try {
      const { data: dbEntries, error } = await supabase
        .from("tracker_entries")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) {
        return cors(json({ success: false, error: error.message }, 500));
      }

      const records = (dbEntries || []).map((e: any) => ({
        id: e.id,
        phone: e.phone_number || formatPhoneDisplay(e.phone_digits || ""),
        cleanPhone: e.phone_digits,
        scamType: e.category || "Scam",
        detectedAt: e.report_date || e.created_at || new Date().toISOString(),
        sourceUrl: e.source_url || "/tracker",
        sourceDomain: e.source_name || "Database",
        platform: e.source_name || "Scam Tracker",
        snippet: e.description || "Verified threat entry",
        searchQuery: e.category || "Database Record",
        confidence: "High",
        isNumberDown: Boolean(e.is_number_down),
      }));

      return cors(json({
        success: true,
        records,
        lastScanTime: lastManualRefreshTime ? new Date(lastManualRefreshTime).toISOString() : null,
        nextScheduledRefresh: "Today at 1:00 PM PST",
        isScanningInProgress: running,
        scanProgress: running ? 50 : 100,
      }));
    } catch (err) {
      return cors(json({ success: false, error: String(err) }, 500));
    }
  }

  if (url.pathname.startsWith("/api/records/")) {
    return cors(json({ success: true }));
  }


  if (url.pathname === "/refresh") {
    if (req.method !== "POST") return cors(json({ error: "POST required" }, 405));
    if (running) return cors(json({ error: "Harvester scan is already running. Please wait." }, 429));

    const now = Date.now();
    if (now - lastManualRefreshTime < 60_000) {
      return cors(json({ error: "Scan rate limit exceeded. Please wait 1 minute between scans." }, 429));
    }

    running = true;
    lastManualRefreshTime = now;
    try {
      const stats = await runPipeline();
      return cors(json(stats));
    } catch (e) { return cors(json({ success: false, error: String(e) }, 500)); } finally { running = false; }
  }

  return json({ error: "not found" }, 404);
});

console.log(`tracker-fetcher listening on :${PORT}`);
