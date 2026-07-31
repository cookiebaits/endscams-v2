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

const GOOGLE_API_KEY = env("GOOGLE_API_KEY");
const GOOGLE_CX = env("GOOGLE_CX");
const SUPABASE_URL = env("SUPABASE_URL", true);
const SUPABASE_SERVICE_ROLE_KEY = env("SUPABASE_SERVICE_ROLE_KEY", true);
const ALLOWED_ORIGIN = env("ALLOWED_ORIGIN") || "*";
const ALLOWED_ORIGIN2 = "http://localhost:5173";
const ALLOWED_ORIGIN3 = "http://localhost:5174";
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
/*  Google CSE                                                       */
/* ================================================================ */
interface CseItem { title?: string; snippet?: string; link?: string; }

async function googleSearch(q: string, dateRestrict = "w2", num = 5): Promise<CseItem[]> {
  if (!GOOGLE_API_KEY) return [];
  const url = `https://customsearch.googleapis.com/customsearch/v1?key=${encodeURIComponent(GOOGLE_API_KEY)}&cx=${encodeURIComponent(GOOGLE_CX)}&q=${encodeURIComponent(q)}&num=${num}&dateRestrict=${dateRestrict}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.warn(`CSE ${res.status} q=${q}: ${t.slice(0, 200)}`);
      return [];
    }
    const data = await res.json();
    return (data.items || []) as CseItem[];
  } catch (e) {
    console.warn(`CSE err q=${q}`, e);
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
/*  PetScams scraper                                                 */
/* ================================================================ */
async function fetchPetScams(url: string): Promise<{ digits: string; snippet: string }[]> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; EndScamsBot/1.0)" } });
    if (!res.ok) { console.warn(`PetScams ${res.status}: ${url}`); return []; }
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
    console.warn(`PetScams err ${url}`, e);
    return [];
  }
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
  { q: 'site:facebook.com "spellcaster" "Whatsapp"', category: "Spiritual / Spellcaster Scam", label: "Facebook — Spellcaster" },
  { q: 'site:facebook.com "illuminati" "Whatsapp"',  category: "Spiritual / Spellcaster Scam", label: "Facebook — Illuminati" },
  { q: 'site:instagram.com "spellcaster" "Whatsapp"',category: "Spiritual / Spellcaster Scam", label: "Instagram — Spellcaster" },
  { q: 'inurl:"guestbook" spell whatsapp',           category: "Spiritual / Spellcaster Scam", label: "Web — Guestbook Spell" },
  { q: 'site:facebook.com "btc recovery" "Whatsapp"',category: "Crypto Recovery Scam",         label: "Facebook — BTC Recovery" },
  { q: 'site:instagram.com "btc recovery" "Whatsapp"',category: "Crypto Recovery Scam",         label: "Instagram — BTC Recovery" },
  { q: '"book publisher" "amazon" "chat"',           category: "Publisher Scam",               label: "Web — Book Publisher" },
];

const BBB_QUERIES = [
  { url: "https://www.bbb.org/scamtracker/lookupscam?q=all%3Dpaypal%26from%3D0",    category: "Invoice / Imposter Scam", label: "BBB — PayPal" },
  { url: "https://www.bbb.org/scamtracker/lookupscam?q=all%3Demergency%26from%3D0", category: "Emergency Scam",          label: "BBB — Emergency" },
  { url: "https://www.bbb.org/scamtracker/lookupscam?q=all%3Dmillion%26from%3D0",   category: "Lottery / Prize Scam",    label: "BBB — Million" },
];

const PETSCAMS_URLS = [
  { url: "https://petscams.com/category/puppy-scammer-list/", category: "Pet / Puppy Scam", label: "PetScams — Puppy Scammer List" }
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

  /* 1. Purge >31-day rows */
  const cutoff = toIsoDate(new Date(Date.now() - 31 * 86400_000));
  const { error: purgeErr } = await supabase.from("tracker_entries").delete().lt("report_date", cutoff);
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

        if (GOOGLE_API_KEY) {
          const items = await googleSearch(`"${row.digits}" scam`, "w2", 5);
          csvGoogle++;
          if (items.length > 0) {
            foundUrl = items[0].link || foundUrl;
            metaSnippet = summarizeSnippets(items);
          }
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

  /* 3. WhatsApp / Spellcaster / Crypto CSE queries */
  let cseUsed = 0;
  const todayIso = toIsoDate(new Date());
  if (GOOGLE_API_KEY) {
    for (const q of WHATSAPP_QUERIES) {
      const items = await googleSearch(q.q, "w2", 8);
      cseUsed++;
      for (const item of items) {
        const text = `${item.title || ""} ${item.snippet || ""}`;
        const nums = extractPhoneNumbers(text);
        for (const digits of nums) {
          if (collected.some(c => c.phone_digits === digits)) continue;
          collected.push({
            phone_number: formatPhoneDisplay(digits),
            phone_digits: digits,
            source_name: `Google Search — ${q.label}`,
            source_url: item.link || "https://www.google.com",
            report_date: todayIso,
            category: q.category,
            description: `${q.label} (14d) | ${summarizeSnippets([item])}`.slice(0, 900),
          });
        }
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

  /* 5. PetScams HTML */
  let petscamsFound = 0;
  for (const p of PETSCAMS_URLS) {
    const items = await fetchPetScams(p.url);
    for (const f of items) {
      if (collected.some(c => c.phone_digits === f.digits)) continue;
      collected.push({
        phone_number: formatPhoneDisplay(f.digits),
        phone_digits: f.digits,
        source_name: p.label,
        source_url: p.url,
        report_date: todayIso,
        category: p.category,
        description: (f.snippet ? `PetScams Tracker: ${f.snippet}` : `PetScams Tracker (${p.label})`).slice(0, 900),
      });
      petscamsFound++;
    }
  }

  /* 6. Dedupe by digits, keep newest */
  const byDigits = new Map<string, ScamEntry>();
  for (const e of collected) {
    const prev = byDigits.get(e.phone_digits);
    if (!prev || prev.report_date < e.report_date) byDigits.set(e.phone_digits, e);
  }
  const finalEntries = Array.from(byDigits.values());

  /* 7. Upsert */
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
    petscams_found: petscamsFound,
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

async function scheduler() {
  const now = new Date();
  const hour = now.getUTCHours();
  const minute = now.getUTCMinutes();

  // Cron trigger — top of the hour, 14:00 UTC (6 AM PST) or 21:00 UTC (1 PM PST)
  if (!running && (hour === 14 || hour === 21) && minute < 5 && lastRunHour !== hour) {
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
    const cutoff = toIsoDate(new Date(Date.now() - 31 * 86400_000));
    const { error } = await supabase.from("tracker_entries").delete().lt("report_date", cutoff);
    if (error) console.warn("[purge] err", error.message);
  }
}

setInterval(() => { scheduler().catch(e => console.error("scheduler err", e)); }, 60_000);

// Run once on boot so the tracker is populated the moment the container starts
runPipeline()
  .then(stats => console.log("[boot] initial run:", stats))
  .catch(e => console.error("[boot] initial run failed", e));

/* ================================================================ */
/*  HTTP server                                                      */
/* ================================================================ */
Deno.serve({ port: PORT }, async (req: Request) => {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") return cors(new Response(null, { status: 204 }));

  if (url.pathname === "/health") return json({ ok: true, ts: new Date().toISOString() });

  if (url.pathname === "/refresh") {
    if (req.method !== "POST") return json({ error: "POST required" }, 405);
    if (running) return json({ error: "already running" }, 429);
    running = true;
    try {
      const stats = await runPipeline();
      return json(stats);
    } catch (e) {
      return json({ success: false, error: String(e) }, 500);
    } finally { running = false; }
  }

  return json({ error: "not found" }, 404);
});

console.log(`tracker-fetcher listening on :${PORT}`);
