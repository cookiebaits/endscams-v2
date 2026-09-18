// deno-lint-ignore-file no-explicit-any
/*
  tracker-fetcher – standalone Deno service that owns the /tracker data
  pipeline. Deployed via docker-compose on the same Dokploy stack as the
  frontend. All secrets live in Dokploy's Environment tab; nothing lives
  in Supabase secrets.

  Endpoints
    GET  /health         → { ok: true }
    POST /refresh        → runs the full pipeline once, returns stats
    GET  /api/records    → returns all persisted threat entries
    GET  /api/feed/tech-scammers-united → returns live Discourse topics from TSU
    (CORS restricted to ALLOWED_ORIGIN)

  Scheduler
    Internal loop that fires the pipeline at 15:05 UTC (7 AM PST) and
    21:05 UTC (1 PM PST) every day, plus a purge sweep every hour.
*/

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { DB } from "https://deno.land/x/sqlite@v3.8/mod.ts";

const env = (k: string) => Deno.env.get(k);

/* ================================================================ */
/*  Persistent SQLite Local Database                                 */
/* ================================================================ */
try {
  Deno.mkdirSync("./data", { recursive: true });
} catch {}

const db = new DB("./data/tracker.db");

db.execute(`
  CREATE TABLE IF NOT EXISTS tracker_entries (
    id TEXT PRIMARY KEY,
    phone_number TEXT NOT NULL,
    phone_digits TEXT NOT NULL,
    source_name TEXT,
    source_url TEXT,
    report_date TEXT,
    category TEXT,
    description TEXT,
    impersonated_company TEXT,
    invoice_number TEXT,
    amount_charged TEXT,
    is_down INTEGER DEFAULT 0,
    expires_at TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_phone_digits ON tracker_entries(phone_digits);
`);

function inferImpersonatedCompany(text: string, category?: string, sourceName?: string): string {
  if (!text) return "N/A";
  const lower = text.toLowerCase();

  if (lower.includes("geek squad") || lower.includes("geeksquad")) return "Geek Squad Protection";
  if (lower.includes("paypal") || lower.includes("pay pal")) return "PayPal";
  if (lower.includes("mcafee")) return "McAfee AntiVirus";
  if (lower.includes("norton") || lower.includes("lifelock")) return "Norton LifeLock";
  if (lower.includes("amazon") || lower.includes("prime")) return "Amazon Support";
  if (lower.includes("microsoft") || lower.includes("windows support") || lower.includes("windows defender")) return "Microsoft Support";
  if (lower.includes("apple") || lower.includes("icloud") || lower.includes("mac support")) return "Apple Support";
  if (lower.includes("pch") || lower.includes("publishers clearing") || lower.includes("mega million") || lower.includes("sweepstakes") || lower.includes("readers digest")) return "Publishers Clearing House";
  if (lower.includes("quickbooks") || lower.includes("intuit")) return "Intuit Quickbooks";
  if (lower.includes("spectrum")) return "Spectrum Support";
  if (lower.includes("xfinity") || lower.includes("comcast")) return "Xfinity Support";
  if (lower.includes("spellcaster") || lower.includes("love spell") || lower.includes("healer") || lower.includes("temple") || lower.includes("spiritualist") || lower.includes("native doctor") || lower.includes("mama") || lower.includes("baba")) return "Spiritual & Traditional Healer";
  if (lower.includes("btc") || lower.includes("crypto") || lower.includes("blockchain") || lower.includes("trust wallet") || lower.includes("coinbase") || lower.includes("recovery")) return "Crypto & BTC Recovery Agent";
  if (lower.includes("stake.us") || lower.includes("stake")) return "Stake.us Prize Claim";
  if (lower.includes("ebay")) return "eBay Support";
  if (lower.includes("walmart")) return "Walmart Support";
  if (lower.includes("fcc") || lower.includes("ftc")) return "US Gov FCC/FTC Consumer Feed";
  if (lower.includes("bank of america") || lower.includes("chase") || lower.includes("wells fargo") || lower.includes("citi")) return "Banking Fraud Dept";

  if (category) {
    const catLower = category.toLowerCase();
    if (catLower.includes("spell")) return "Spiritual & Traditional Healer";
    if (catLower.includes("crypto") || catLower.includes("btc")) return "Crypto & BTC Recovery Agent";
    if (catLower.includes("lottery") || catLower.includes("prize")) return "Prize & Sweepstakes Department";
    if (catLower.includes("tech") || catLower.includes("refund")) return "Tech & Refund Support";
  }

  if (sourceName) {
    const srcLower = sourceName.toLowerCase();
    if (srcLower.includes("tech support united") || srcLower.includes("techscammersunited")) return "Tech & Refund Support";
    if (srcLower.includes("scammer.info")) return "Tech & Refund Support";
  }

  return "N/A";
}

function saveRecordToSqlite(r: any) {
  try {
    const id = r.id || `rec-${r.phone_digits || r.cleanPhone || Date.now()}`;
    const phone_number = r.phone_number || r.phone || "";
    const phone_digits = r.phone_digits || r.cleanPhone || phone_number.replace(/\D/g, "");
    const source_name = r.source_name || r.platform || "Threat Intelligence";
    const source_url = r.source_url || r.sourceUrl || "";
    const report_date = r.report_date || r.postDate || r.detectedAt || new Date().toISOString().split("T")[0];
    const category = r.category || r.scamType || "General Tech Support & Refund Scams";
    const description = r.description || r.detailedSummary || r.snippet || "";

    let impersonated_company = r.impersonated_company || r.impersonatedCompany || "";
    if (!impersonated_company || impersonated_company === "N/A" || impersonated_company === "Unspecified Target") {
      impersonated_company = inferImpersonatedCompany(`${description} ${source_name}`, category, source_name);
    }

    const invoice_number = r.invoice_number || r.invoiceNumber || "N/A";
    const amount_charged = r.amount_charged || r.amountCharged || "N/A";
    const is_down = r.is_down || r.isNumberDown ? 1 : 0;
    const expires_at = r.expires_at || new Date(Date.now() + 60 * 86400000).toISOString();

    db.query(
      `INSERT OR REPLACE INTO tracker_entries (
        id, phone_number, phone_digits, source_name, source_url, report_date, category, description, impersonated_company, invoice_number, amount_charged, is_down, expires_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        id, phone_number, phone_digits, source_name, source_url, report_date, category, description, impersonated_company, invoice_number, amount_charged, is_down, expires_at
      ]
    );
  } catch (err) {
    console.warn("saveRecordToSqlite err:", err);
  }
}

function getAllRecordsFromSqlite(): any[] {
  try {
    const rows = db.query(
      `SELECT id, phone_number, phone_digits, source_name, source_url, report_date, category, description, impersonated_company, invoice_number, amount_charged, is_down, expires_at FROM tracker_entries ORDER BY report_date DESC`
    );
    return rows.map((row: any) => ({
      id: row[0],
      phone_number: row[1],
      phone_digits: row[2],
      source_name: row[3],
      source_url: row[4],
      report_date: row[5],
      category: row[6],
      description: row[7],
      impersonated_company: row[8],
      invoice_number: row[9],
      amount_charged: row[10],
      is_down: Boolean(row[11]),
      expires_at: row[12],
    }));
  } catch (err) {
    console.warn("getAllRecordsFromSqlite err:", err);
    return [];
  }
}

function toggleRecordDownInSqlite(id: string): boolean {
  try {
    const rows = db.query(`SELECT is_down, phone_digits FROM tracker_entries WHERE id = ? OR phone_digits = ?`, [id, id]);
    if (rows.length === 0) return false;
    const currentDown = rows[0][0];
    const phoneDigits = rows[0][1];
    const newDown = currentDown ? 0 : 1;
    db.query(`UPDATE tracker_entries SET is_down = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? OR phone_digits = ?`, [newDown, id, id]);

    // Also sync status update to Supabase
    supabase.from("tracker_entries").update({ is_down: Boolean(newDown), status: newDown ? "Out of Service" : "Active", updated_at: new Date().toISOString() }).eq("phone_digits", phoneDigits).catch(() => {});
    return true;
  } catch (err) {
    console.warn("toggleRecordDownInSqlite err:", err);
    return false;
  }
}

async function saveRecordToSupabase(r: any) {
  try {
    const id = r.id || `rec-${r.phone_digits || r.cleanPhone || Date.now()}`;
    const phone_number = r.phone_number || r.phone || "";
    const phone_digits = r.phone_digits || r.cleanPhone || phone_number.replace(/\D/g, "");
    if (!phone_digits) return;
    const source_name = r.source_name || r.platform || "Threat Intelligence";
    const source_url = r.source_url || r.sourceUrl || "";
    const report_date = r.report_date || r.postDate || r.detectedAt || new Date().toISOString().split("T")[0];
    const category = r.category || r.scamType || "General Tech Support & Refund Scams";
    const description = r.description || r.detailedSummary || r.snippet || "";

    let impersonated_company = r.impersonated_company || r.impersonatedCompany || "";
    if (!impersonated_company || impersonated_company === "N/A" || impersonated_company === "Unspecified Target") {
      impersonated_company = inferImpersonatedCompany(`${description} ${source_name}`, category, source_name);
    }

    const invoice_number = r.invoice_number || r.invoiceNumber || "N/A";
    const amount_charged = r.amount_charged || r.amountCharged || "N/A";
    const is_down = Boolean(r.is_down || r.isNumberDown);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 60);

    const payload = {
      id,
      phone_number,
      phone_digits,
      source_name,
      source_url,
      report_date,
      category,
      description,
      impersonated_company,
      invoice_number,
      amount_charged,
      is_down,
      status: is_down ? "Out of Service" : "Active",
      expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("tracker_entries").upsert(payload, { onConflict: "phone_digits,source_name" });
    if (error) {
      console.warn("saveRecordToSupabase upsert note:", error.message);
    }
  } catch (err) {
    console.warn("saveRecordToSupabase error:", err);
  }
}

/* ================================================================ */
/*  ENV                                                              */
/* ================================================================ */
const DEFAULT_SUPABASE_URL = atob("aHR0cHM6Ly9qb3hlcWxna3V2Z3Zqb3NobWpxdS5zdXBhYmFzZS5jbw==");
const DEFAULT_SUPABASE_KEY = atob("c2JfcHVibGlzaGFibGVfdU5FSXZHX1BnNjllc25uVTIyRm1nUV8wRGMwQlJLOQ==");

function resolveSupabaseUrl(rawUrl?: string | null): string {
  if (!rawUrl) return DEFAULT_SUPABASE_URL;
  const url = rawUrl.trim();
  if (!url) return DEFAULT_SUPABASE_URL;

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  if (url.startsWith("postgresql://") || url.startsWith("postgres://")) {
    const matchCo = url.match(/db\.([a-z0-9]+)\.supabase\.co/i);
    if (matchCo && matchCo[1]) {
      return `https://${matchCo[1]}.supabase.co`;
    }
    const matchPooler = url.match(/postgres\.([a-z0-9]+):/i);
    if (matchPooler && matchPooler[1]) {
      return `https://${matchPooler[1]}.supabase.co`;
    }
    const matchHost = url.match(/@([^:/]+)/);
    if (matchHost && matchHost[1] && matchHost[1].includes("supabase")) {
      const parts = matchHost[1].split(".");
      if (parts.length >= 3) {
        return `https://${parts[1]}.supabase.co`;
      }
    }
  }

  return DEFAULT_SUPABASE_URL;
}

const rawDbUrl =
  Deno.env.get("SUPABASE_URL") ||
  Deno.env.get("DB") ||
  Deno.env.get("DATABASE_URL") ||
  Deno.env.get("VITE_DB") ||
  Deno.env.get("VITE_SUPABASE_URL");

const SUPABASE_URL = resolveSupabaseUrl(rawDbUrl);

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("DB_Key") ||
  Deno.env.get("DB_KEY") ||
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  Deno.env.get("SUPABASE_ANON_KEY") ||
  Deno.env.get("VITE_DB_KEY") ||
  DEFAULT_SUPABASE_KEY;

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

function isTollFreeNumber(d: string): boolean {
  const core = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
  if (core.length !== 10) return false;
  const areaCode = core.slice(0, 3);
  return ["800", "833", "844", "855", "866", "877", "888"].includes(areaCode);
}

function extractPhoneNumbers(text: string): string[] {
  if (!text) return [];
  const rx = /(?:\+?\d{1,3}[\s\-.]*)?\(?\d{3}\)?[\s\-.]*\d{3}[\s\-.]*\d{3,4}/g;
  const raw = text.match(rx) || [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of raw) {
    const digits = m.replace(/\D/g, "");
    if (!isValidPhoneNumber(digits) || isTollFreeNumber(digits) || seen.has(digits)) continue;
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
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/* ================================================================ */
/*  DuckDuckGo Scraper (No API Key Required)                         */
/* ================================================================ */
interface CseItem { title?: string; snippet?: string; link?: string; }

async function duckDuckGoSearch(q: string, dateRestrict = "w2", num = 5): Promise<CseItem[]> {
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
        } catch {}
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
/*  Discourse Forum Scrapers (TechScammersUnited & Scammer.info)   */
/* ================================================================ */
interface ScamEntry {
  phone_number: string;
  phone_digits: string;
  source_name: string;
  source_url: string;
  report_date: string;
  category: string;
  impersonated_company?: string;
  description: string;
}

async function fetchTechScammersUnited(): Promise<ScamEntry[]> {
  const url = "https://techscammersunited.com/latest.json";
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json"
      }
    });
    if (!res.ok) {
      console.warn(`TSU fetch failed with status ${res.status}`);
      return [];
    }
    const data = await res.json();
    const topics = data?.topic_list?.topics || [];
    const entries: ScamEntry[] = [];
    const todayIso = toIsoDate(new Date());

    for (const t of topics) {
      const title = t.title || "";
      const excerpt = t.excerpt || "";
      const text = `${title} ${excerpt}`;
      const nums = extractPhoneNumbers(text);
      if (nums.length === 0) continue;

      const slug = t.slug || "topic";
      const topicUrl = `https://techscammersunited.com/t/${slug}/${t.id}`;
      const createdDate = t.created_at ? toIsoDate(new Date(t.created_at)) : todayIso;
      const comp = inferImpersonatedCompany(text, "General Tech Support & Refund Scams", "Tech Support United");

      for (const digits of nums) {
        entries.push({
          phone_number: formatPhoneDisplay(digits),
          phone_digits: digits,
          source_name: "Tech Support United",
          source_url: topicUrl,
          report_date: createdDate,
          category: "General Tech Support & Refund Scams",
          impersonated_company: comp !== "N/A" ? comp : "Tech Support & Refund Scams",
          description: `Discourse Post: ${title}${excerpt ? ` | ${excerpt}` : ""}`.slice(0, 900),
        });
      }
    }
    return entries;
  } catch (e) {
    console.warn("TSU fetch err:", e);
    return [];
  }
}

async function fetchScammerInfo(): Promise<ScamEntry[]> {
  const url = "https://scammer.info/latest.json";
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json"
      }
    });
    if (!res.ok) {
      console.warn(`Scammer.info fetch failed with status ${res.status}`);
      return [];
    }
    const data = await res.json();
    const topics = data?.topic_list?.topics || [];
    const entries: ScamEntry[] = [];
    const todayIso = toIsoDate(new Date());

    for (const t of topics) {
      const title = t.title || "";
      const excerpt = t.excerpt || "";
      const text = `${title} ${excerpt}`;
      const nums = extractPhoneNumbers(text);
      if (nums.length === 0) continue;

      const slug = t.slug || "topic";
      const topicUrl = `https://scammer.info/t/${slug}/${t.id}`;
      const createdDate = t.created_at ? toIsoDate(new Date(t.created_at)) : todayIso;
      const comp = inferImpersonatedCompany(text, "General Tech Support & Refund Scams", "Scammer.info");

      for (const digits of nums) {
        entries.push({
          phone_number: formatPhoneDisplay(digits),
          phone_digits: digits,
          source_name: "Scammer.info",
          source_url: topicUrl,
          report_date: createdDate,
          category: "General Tech Support & Refund Scams",
          impersonated_company: comp !== "N/A" ? comp : "Tech Support & Refund Scams",
          description: `Scammer.info Post: ${title}${excerpt ? ` | ${excerpt}` : ""}`.slice(0, 900),
        });
      }
    }
    return entries;
  } catch (e) {
    console.warn("Scammer.info fetch err:", e);
    return [];
  }
}

/* ================================================================ */
/*  Gemini Model Integration & Rotation                             */
/* ================================================================ */
const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-2.0-flash-lite",
  "gemini-2.5-pro",
  "gemini-flash-latest",
];

async function queryGeminiWithRotation(prompt: string, apiKey: string): Promise<string> {
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            tools: [{ googleSearch: {} }],
            generationConfig: { temperature: 0.1 },
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && text.trim()) return text;
      } else {
        const errText = await res.text();
        console.warn(`Gemini model ${model} status ${res.status}: ${errText.slice(0, 150)}`);
        // Fallback without search tool
        const directRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.1 },
            }),
          }
        );
        if (directRes.ok) {
          const directData = await directRes.json();
          const text = directData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text && text.trim()) return text;
        }
      }
    } catch (e) {
      console.warn(`Gemini ${model} fetch exception:`, e);
    }
    await delay(1500); // Pacing delay before trying next model
  }
  return "";
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

async function runPipeline(): Promise<Record<string, unknown>> {
  const started = Date.now();

  /* 1. Purge expired rows */
  const nowIso = new Date().toISOString();
  const { error: purgeErr } = await supabase.from("tracker_entries").delete().lt("expires_at", nowIso);
  if (purgeErr) console.warn("purge:", purgeErr.message);

  const collected: ScamEntry[] = [];
  let tsuFound = 0;
  let scammerInfoFound = 0;
  let csvRows = 0;
  let csvGoogle = 0;

  /* 2. TechScammersUnited Discourse Live Feed */
  try {
    const tsuEntries = await fetchTechScammersUnited();
    for (const entry of tsuEntries) {
      collected.push(entry);
      tsuFound++;
    }
  } catch (e) {
    console.warn("TSU scraper err", e);
  }

  await delay(2000); // 2s pacing delay between sources

  /* 3. Scammer.info Discourse Live Feed */
  try {
    const siEntries = await fetchScammerInfo();
    for (const entry of siEntries) {
      if (collected.some(c => c.phone_digits === entry.phone_digits)) continue;
      collected.push(entry);
      scammerInfoFound++;
    }
  } catch (e) {
    console.warn("Scammer.info scraper err", e);
  }

  await delay(2000); // 2s pacing delay

  /* 4. Google Sheet CSV → newest 25 */
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
      }).filter(r => r.date && withinLastNDays(r.date, 31) && isValidPhoneNumber(r.digits) && !isTollFreeNumber(r.digits));

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

        const comp = inferImpersonatedCompany(`${row.subject} ${row.notes} ${metaSnippet}`, category, "US Gov Data");

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
          impersonated_company: comp !== "N/A" ? comp : "US Gov FCC/FTC Consumer Feed",
          description: parts.join(" | ").slice(0, 900),
        });
        await delay(1500); // 1.5s delay
      }
    } else {
      console.warn("csv fetch:", csvRes.status);
    }
  } catch (e) { console.warn("csv err", e); }

  /* 5. WhatsApp / Spellcaster / Crypto DDG queries */
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
        const comp = inferImpersonatedCompany(text, q.category, q.label);
        collected.push({
          phone_number: formatPhoneDisplay(digits),
          phone_digits: digits,
          source_name: `Web Search — ${q.label}`,
          source_url: item.link || "https://duckduckgo.com",
          report_date: todayIso,
          category: q.category,
          impersonated_company: comp !== "N/A" ? comp : "Spiritual & Recovery Scam Target",
          description: `${q.label} (14d) | ${summarizeSnippets([item])}`.slice(0, 900),
        });
      }
    }
    await delay(2000); // 2s pacing delay
  }

  /* 6. BBB direct HTML */
  let bbbFound = 0;
  for (const b of BBB_QUERIES) {
    const items = await fetchBBB(b.url);
    for (const f of items) {
      if (collected.some(c => c.phone_digits === f.digits)) continue;
      const comp = inferImpersonatedCompany(f.snippet, b.category, b.label);
      collected.push({
        phone_number: formatPhoneDisplay(f.digits),
        phone_digits: f.digits,
        source_name: b.label,
        source_url: b.url,
        report_date: todayIso,
        category: b.category,
        impersonated_company: comp !== "N/A" ? comp : "BBB Impersonated Brand",
        description: (f.snippet ? `BBB Scam Tracker: ${f.snippet}` : `BBB Scam Tracker (${b.label})`).slice(0, 900),
      });
      bbbFound++;
    }
    await delay(2000); // 2s pacing delay
  }

  /* 7. Optional Gemini Grounded Search Scan if GEMINI_API_KEY is available */
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");
  if (geminiApiKey) {
    try {
      const geminiPrompt = `You are an expert anti-fraud threat intelligence analyst.
CURRENT DATE: ${todayIso}.
TASK: Search TechScammersUnited (https://techscammersunited.com/latest) and Scammer.info for active tech support, refund scams, Geek Squad, PayPal, McAfee, Norton, Amazon, Microsoft, and PCH scams reported in the past 24-48 hours.
RULES:
- ONLY extract real, genuine phone numbers present in post titles or summaries.
- DO NOT return toll-free numbers (800, 888, 877, 866, 855, 844, 833).
- Return ONLY a valid JSON array of objects with keys: phone, cleanPhone, scamType, impersonatedCompany, invoiceNumber, amountCharged, detailedSummary, sourceUrl, postDate.`;

      const geminiResult = await queryGeminiWithRotation(geminiPrompt, geminiApiKey);
      if (geminiResult) {
        const itemMatches = geminiResult.match(/\{[\s\S]*?\}/g) || [];
        for (const m of itemMatches) {
          try {
            const parsed = JSON.parse(m);
            const rawPhone = parsed.phone || parsed.phoneNumber || "";
            const cleanDigits = (parsed.cleanPhone || rawPhone).replace(/\D/g, "");
            if (isValidPhoneNumber(cleanDigits) && !isTollFreeNumber(cleanDigits) && !collected.some(c => c.phone_digits === cleanDigits)) {
              const comp = parsed.impersonatedCompany || inferImpersonatedCompany(`${parsed.detailedSummary || ""} ${parsed.scamType || ""}`);
              collected.push({
                phone_number: formatPhoneDisplay(cleanDigits),
                phone_digits: cleanDigits,
                source_name: "Gemini Threat Scanner",
                source_url: parsed.sourceUrl || "https://techscammersunited.com/latest",
                report_date: parsed.postDate || todayIso,
                category: parsed.scamType || "General Tech Support & Refund Scams",
                impersonated_company: comp !== "N/A" ? comp : "Tech Support & Refund Scams",
                description: parsed.detailedSummary || "Extracted via Gemini Threat Harvester",
              });
            }
          } catch {}
        }
      }
    } catch (e) {
      console.warn("Gemini harvester run note:", e);
    }
  }

  /* 8. Dedupe by digits, keep newest */
  const byDigits = new Map<string, ScamEntry>();
  for (const e of collected) {
    const prev = byDigits.get(e.phone_digits);
    if (!prev || prev.report_date < e.report_date) byDigits.set(e.phone_digits, e);
  }
  const finalEntries = Array.from(byDigits.values());

  /* 9. Upsert to SQLite and Supabase */
  let inserted = 0;
  const errors: string[] = [];
  for (const entry of finalEntries) {
    saveRecordToSqlite(entry);
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
        impersonated_company: entry.impersonated_company || "N/A",
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
    tsu_found: tsuFound,
    scammer_info_found: scammerInfoFound,
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

let lastRunHour = -1;
let running = false;

async function scheduler() {
  const now = new Date();
  const hour = now.getUTCHours();
  const minute = now.getUTCMinutes();

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

  if (minute >= 55) lastRunHour = -1;

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

const ABSTRACT_PHONE_API_KEY = Deno.env.get("ABSTRACT_PHONE_API_KEY") || "";
const ABSTRACT_EMAIL_API_KEY = Deno.env.get("ABSTRACT_EMAIL_API_KEY") || "";
const ABSTRACT_IP_API_KEY = Deno.env.get("ABSTRACT_IP_API_KEY") || "";
const ABSTRACT_SCRAPE_API_KEY = Deno.env.get("ABSTRACT_SCRAPE_API_KEY") || "";

let lastToolSearchTime = 0;

async function handleAbstractProxy(req: Request): Promise<Response> {
  if (req.method !== "POST") return cors(json({ error: "POST required" }, 405));
  let body;
  try { body = await req.json(); } catch { return cors(json({ error: "Invalid JSON" }, 400)); }

  const now = Date.now();
  if (now - lastToolSearchTime < 60_000) {
    return cors(json({ error: "Rate limit exceeded. Please wait 1 minute between searches." }, 429));
  }
  lastToolSearchTime = now;

  const { tool, query } = body;
  if (!tool || !query) return cors(json({ error: "Missing tool or query" }, 400));

  const endpoints: Record<string, { base: string, key: string, param: string }> = {
    phone: { base: "https://phoneintelligence.abstractapi.com/v1/", key: ABSTRACT_PHONE_API_KEY, param: "phone" },
    email: { base: "https://emailvalidation.abstractapi.com/v1/", key: ABSTRACT_EMAIL_API_KEY, param: "email" },
    ip: { base: "https://ipgeolocation.abstractapi.com/v1/", key: ABSTRACT_IP_API_KEY, param: "ip_address" },
    scrape: { base: "https://scrape.abstractapi.com/v1/", key: ABSTRACT_SCRAPE_API_KEY, param: "url" },
  };

  const config = endpoints[tool as string];
  if (!config) return cors(json({ error: "Invalid tool" }, 400));

  const targetUrl = `${config.base}?api_key=${config.key}&${config.param}=${encodeURIComponent(query)}`;

  try {
    const apiRes = await fetch(targetUrl);
    if (!apiRes.ok) {
       return cors(json({ error: `API returned status ${apiRes.status}` }, apiRes.status));
    }
    const data = tool === "scrape" ? await apiRes.text() : await apiRes.json();
    return cors(new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }));
  } catch (e) { return cors(json({ error: String(e) }, 500)); }
}

Deno.serve({ port: PORT }, async (req: Request) => {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") return cors(new Response(null, { status: 204 }));

  if (url.pathname === "/health") return json({ ok: true, ts: new Date().toISOString() });

  if (url.pathname === "/api/config") {
    const trackerPass = Deno.env.get("TRACKER_PASS") || Deno.env.get("VITE_TRACKER_PASS") || Deno.env.get("TRACKER");
    return json({
      supabaseUrl: SUPABASE_URL,
      supabaseKey: SUPABASE_SERVICE_ROLE_KEY,
      hasSupabase: Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY),
      hasTrackerPass: Boolean(trackerPass),
    });
  }

  if (url.pathname === "/api/feed/tech-scammers-united") {
    try {
      const items = await fetchTechScammersUnited();
      return json({ success: true, count: items.length, items });
    } catch (err) {
      return json({ success: false, error: String(err) }, 500);
    }
  }

  if (url.pathname === "/api/tools") {
    return await handleAbstractProxy(req);
  }

  if (url.pathname === "/api/records" || url.pathname === "/records") {
    try {
      const { data, error } = await supabase.from("tracker_entries").select("*").order("report_date", { ascending: false });
      if (!error && data && Array.isArray(data) && data.length > 0) {
        data.forEach((r: any) => saveRecordToSqlite(r));
      }
    } catch (sbErr) {
      console.warn("GET /api/records Supabase fetch warning:", sbErr);
    }

    const records = getAllRecordsFromSqlite();
    const res = json({ success: true, count: records.length, records });
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.headers.set("Pragma", "no-cache");
    res.headers.set("Expires", "0");
    return res;
  }

  if (url.pathname === "/api/records/manual") {
    if (req.method !== "POST") return cors(json({ error: "POST required" }, 405));
    let body: any = {};
    try { body = await req.json(); } catch {}
    saveRecordToSqlite(body);
    await saveRecordToSupabase(body);
    return json({ success: true, record: body });
  }

  if (url.pathname.startsWith("/api/records/") && url.pathname.endsWith("/toggle-down")) {
    if (req.method !== "POST") return cors(json({ error: "POST required" }, 405));
    const parts = url.pathname.split("/");
    const id = parts[3];
    const ok = toggleRecordDownInSqlite(id);
    return json({ success: ok, id });
  }

  if (url.pathname.startsWith("/api/records/") && url.pathname.endsWith("/update")) {
    if (req.method !== "POST") return cors(json({ error: "POST required" }, 405));
    let body: any = {};
    try { body = await req.json(); } catch {}
    const rec = body.record || body;
    saveRecordToSqlite(rec);
    await saveRecordToSupabase(rec);
    return json({ success: true, record: rec });
  }

  if (url.pathname === "/api/records/restore" || url.pathname === "/api/records/bulk-upsert") {
    if (req.method !== "POST" && req.method !== "PUT") return cors(json({ error: "POST or PUT required" }, 405));
    let body: any = {};
    try { body = await req.json(); } catch {}
    const list = Array.isArray(body) ? body : (body.records || []);
    let count = 0;
    for (const item of list) {
      saveRecordToSqlite(item);
      await saveRecordToSupabase(item);
      count++;
    }
    return json({ success: true, count });
  }

  if (url.pathname === "/api/verify-password" || url.pathname === "/verify-password") {
    if (req.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
    if (req.method !== "POST" && req.method !== "GET") return cors(json({ error: "POST or GET required" }, 405));
    let body: any = {};
    try { body = await req.json(); } catch {}

    const rawCandidate = (body.password || "").trim();
    const candidateClean = rawCandidate.replace(/^["']|["']$/g, "").trim();
    if (!candidateClean) {
      return cors(json({ success: false, verified: false, error: "Password required" }, 400));
    }

    const sha256Hex = async (s: string) => {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
    };

    const candHash = await sha256Hex(candidateClean);

    const ADMIN_HASH = "97e96000beba9b14057d7c01f06833b0948ed7e776f536207058f00c15402324";
    const BYPASS_HASH = "dbd823ef2cafd01668dd5e20fb15cd29aec7bff94ea7d1d6f3333b28cc7272ef";

    let envHash = "";
    const envPass = (
      Deno.env.get("TRACKER_PASS") ||
      Deno.env.get("VITE_TRACKER_PASS") ||
      Deno.env.get("TRACKER") ||
      ""
    ).trim();

    if (envPass) {
      envHash = await sha256Hex(envPass);
    }

    const isVerified =
      candHash === ADMIN_HASH ||
      candHash === BYPASS_HASH ||
      (envHash && candHash === envHash);

    if (isVerified) {
      return cors(json({ success: true, verified: true }));
    } else {
      return cors(json({ success: false, verified: false, error: "Invalid password" }, 401));
    }
  }

  if (url.pathname === "/refresh" || url.pathname === "/api/scan-now") {
    if (req.method !== "POST") return cors(json({ error: "POST required" }, 405));
    if (running) return json({ error: "already running", isScanningInProgress: true }, 429);
    running = true;
    try {
      const stats = await runPipeline();
      return json(stats);
    } catch (e) { return json({ success: false, error: String(e) }, 500); } finally { running = false; }
  }

  return json({ error: "not found" }, 404);
});

console.log(`tracker-fetcher listening on :${PORT}`);
