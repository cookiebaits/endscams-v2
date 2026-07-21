// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

/* ------------------------------------------------------------------ */
/*  Scam Tracker refresh — full rebuild                                */
/*                                                                     */
/*  Pipeline (per invocation):                                         */
/*    1. Purge every tracker row older than 31 days.                   */
/*    2. Pull the FCC/FTC Google Sheet (CSV export).                   */
/*    3. Take the newest 25 rows within the last 31 days, look each    */
/*       phone up via Google Custom Search API and pull metadata from  */
/*       the top result snippets (also constrained to last 14 days).   */
/*    4. Run 9 targeted Google CSE queries (WhatsApp/spellcaster/BTC   */
/*       recovery/etc.), each with dateRestrict=w2 (last 14 days).     */
/*       Extract any phone numbers found in titles/snippets.           */
/*    5. Fetch 3 BBB Scam Tracker search pages (paypal / emergency /   */
/*       million) directly and extract any phone numbers.              */
/*    6. Deduplicate by phone_digits (keeping the newest report_date). */
/*    7. Upsert into `tracker_entries`; sort by report_date DESC in    */
/*       the UI.                                                       */
/*                                                                     */
/*  Budget: Google CSE free tier = 100 queries/day. We call it at      */
/*  most 25 + 9 = 34 times per run × 2 runs/day = 68/day.              */
/* ------------------------------------------------------------------ */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ScamEntry {
  phone_number: string;
  phone_digits: string;
  source_name: string;
  source_url: string;
  report_date: string;   // ISO date (yyyy-mm-dd)
  category: string;
  description: string;
}

/* ---------------- Phone helpers ---------------- */

function extractPhoneNumbers(text: string): string[] {
  if (!text) return [];
  // Match common international patterns; keep it permissive, filter later.
  const phoneRegex = /(?:\+?\d{1,3}[\s\-.]*)?\(?\d{3}\)?[\s\-.]*\d{3}[\s\-.]*\d{3,4}/g;
  const raw = text.match(phoneRegex) || [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of raw) {
    const digits = m.replace(/\D/g, "");
    if (!isValidPhoneNumber(digits)) continue;
    if (seen.has(digits)) continue;
    seen.add(digits);
    out.push(digits);
  }
  return out;
}

function isValidPhoneNumber(digits: string): boolean {
  if (digits.length < 10 || digits.length > 14) return false;
  if (/^([0-9])\1+$/.test(digits)) return false;
  if (digits.length === 10 && digits.startsWith("555")) return false;
  // Reject obvious sequences (1234567890 etc)
  if (digits === "1234567890" || digits === "0123456789") return false;
  return true;
}

function formatPhoneDisplay(digits: string): string {
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11) {
    if (digits.startsWith("1")) return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    if (digits.startsWith("27")) return `+27 ${digits.slice(2, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
    if (digits.startsWith("44")) return `+44 ${digits.slice(2, 6)} ${digits.slice(6)}`;
  }
  if (digits.length === 12 && digits.startsWith("44")) return `+44 ${digits.slice(2, 6)} ${digits.slice(6)}`;
  if (digits.length === 13 && digits.startsWith("234")) return `+234 ${digits.slice(3, 6)} ${digits.slice(6, 10)} ${digits.slice(10)}`;
  if (digits.length > 10) {
    if (digits.startsWith("234")) return `+234 ${digits.slice(3)}`;
    if (digits.startsWith("27")) return `+27 ${digits.slice(2)}`;
    if (digits.startsWith("44")) return `+44 ${digits.slice(2)}`;
    if (digits.startsWith("1")) return `+1 ${digits.slice(1)}`;
  }
  return `+${digits}`;
}

/* ---------------- CSV parsing ---------------- */

// Parse a CSV file honoring quoted fields and embedded commas / newlines.
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur); }
  return rows;
}

/* Sheet dates come in like "7/20/2026" or "7/6/26 15:39" – handle both. */
function parseSheetDate(raw: string): Date | null {
  if (!raw) return null;
  const stripped = raw.trim().split(/\s+/)[0]; // drop time portion
  const m = stripped.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!m) {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  const month = parseInt(m[1], 10);
  const day = parseInt(m[2], 10);
  let year = parseInt(m[3], 10);
  if (year < 100) year += 2000;
  const d = new Date(Date.UTC(year, month - 1, day));
  return isNaN(d.getTime()) ? null : d;
}

function withinLastNDays(d: Date, days: number, now = new Date()): boolean {
  const cutoff = new Date(now.getTime() - days * 86400_000);
  return d >= cutoff && d <= new Date(now.getTime() + 86400_000);
}

function toIsoDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

/* ---------------- Google CSE ---------------- */

interface CseItem { title?: string; snippet?: string; link?: string; }

async function googleSearch(
  q: string,
  key: string,
  cx: string,
  dateRestrict = "w2",
  num = 5,
): Promise<CseItem[]> {
  const url = `https://customsearch.googleapis.com/customsearch/v1?key=${encodeURIComponent(key)}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(q)}&num=${num}&dateRestrict=${dateRestrict}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.warn(`CSE query failed [${res.status}] ${q}: ${txt.slice(0, 200)}`);
      return [];
    }
    const data = await res.json();
    return (data.items || []) as CseItem[];
  } catch (e) {
    console.warn(`CSE fetch error for query "${q}"`, e);
    return [];
  }
}

// Pick the most-informative snippet, strip HTML tags & compact whitespace.
function summarizeSnippets(items: CseItem[], maxChars = 240): string {
  const bits: string[] = [];
  for (const it of items.slice(0, 3)) {
    const s = (it.snippet || it.title || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (s) bits.push(s);
  }
  const joined = bits.join(" • ");
  return joined.length > maxChars ? joined.slice(0, maxChars - 1) + "…" : joined;
}

/* ---------------- BBB Scam Tracker ---------------- */

// Fetch a BBB Scam Tracker page and pull phone numbers from the HTML.
// Returns [{digits, snippet}]
async function fetchBBB(url: string): Promise<{ digits: string; snippet: string }[]> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; EndScamsBot/1.0)" },
    });
    if (!res.ok) {
      console.warn(`BBB fetch ${res.status}: ${url}`);
      return [];
    }
    const html = await res.text();
    // Strip HTML to make regex extraction cleaner
    const stripped = html.replace(/<script[\s\S]*?<\/script>/gi, " ")
                         .replace(/<style[\s\S]*?<\/style>/gi, " ")
                         .replace(/<[^>]+>/g, " ")
                         .replace(/&nbsp;/g, " ")
                         .replace(/\s+/g, " ");
    const digits = extractPhoneNumbers(stripped);
    return digits.map(d => {
      // Grab a bit of context around the phone number if we can find it
      const displayForms = [
        d,
        d.length === 10 ? `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}` : "",
        d.length === 10 ? `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}` : "",
      ].filter(Boolean);
      let snippet = "";
      for (const form of displayForms) {
        const idx = stripped.indexOf(form);
        if (idx >= 0) {
          const start = Math.max(0, idx - 80);
          const end = Math.min(stripped.length, idx + form.length + 120);
          snippet = stripped.slice(start, end).trim();
          break;
        }
      }
      return { digits: d, snippet };
    });
  } catch (e) {
    console.warn(`BBB fetch error for ${url}`, e);
    return [];
  }
}

/* ---------------- Main pipeline ---------------- */

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/1wA8LivoY-tYG1gLI4BtX06SLARiiS83a/export?format=csv&id=1wA8LivoY-tYG1gLI4BtX06SLARiiS83a";

const WHATSAPP_QUERIES: { q: string; category: string; label: string }[] = [
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

const BBB_QUERIES: { url: string; category: string; label: string }[] = [
  { url: "https://www.bbb.org/scamtracker/lookupscam?q=all%3Dpaypal%26from%3D0",    category: "Invoice / Imposter Scam", label: "BBB — PayPal" },
  { url: "https://www.bbb.org/scamtracker/lookupscam?q=all%3Demergency%26from%3D0", category: "Emergency Scam",          label: "BBB — Emergency" },
  { url: "https://www.bbb.org/scamtracker/lookupscam?q=all%3Dmillion%26from%3D0",   category: "Lottery / Prize Scam",    label: "BBB — Million" },
];

// Map free-text sheet categories to the frontend category buckets
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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const started = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY") || "";
    const GOOGLE_CX = Deno.env.get("GOOGLE_CX") || "70ee405777bb74c54";

    /* ---------- 1. Purge >31 day rows ---------- */
    const cutoffIso = new Date(Date.now() - 31 * 86400_000).toISOString().split("T")[0];
    const { error: purgeErr } = await supabase
      .from("tracker_entries")
      .delete()
      .lt("report_date", cutoffIso);
    if (purgeErr) console.warn("Purge error:", purgeErr.message);

    const collected: ScamEntry[] = [];

    /* ---------- 2. Sheet CSV ---------- */
    let csvRowsCount = 0;
    let csvUsed = 0;
    try {
      const csvRes = await fetch(CSV_URL);
      if (csvRes.ok) {
        const text = await csvRes.text();
        const rows = parseCSV(text);
        if (rows.length > 1) {
          // Drop header
          const dataRows = rows.slice(1).filter(r => r.length >= 2 && r[0]?.trim());
          csvRowsCount = dataRows.length;

          // Parse & filter to last 31 days
          const parsed = dataRows.map(r => {
            const digits = (r[0] || "").replace(/\D/g, "");
            const date = parseSheetDate(r[1] || "");
            const subject = (r[2] || "").trim();
            const notes = (r[3] || "").trim();
            return { digits, date, subject, notes };
          }).filter(r => r.date && withinLastNDays(r.date, 31) && isValidPhoneNumber(r.digits));

          // Sort newest → oldest
          parsed.sort((a, b) => (b.date!.getTime() - a.date!.getTime()));

          // Take newest 25 unique phone numbers (dedupe by digits)
          const uniqueTop: typeof parsed = [];
          const seen = new Set<string>();
          for (const row of parsed) {
            if (seen.has(row.digits)) continue;
            seen.add(row.digits);
            uniqueTop.push(row);
            if (uniqueTop.length >= 25) break;
          }

          for (const row of uniqueTop) {
            const category = normalizeCategory(row.subject);
            let metaSnippet = "";
            let foundUrl = "https://docs.google.com/spreadsheets/d/1wA8LivoY-tYG1gLI4BtX06SLARiiS83a";

            if (GOOGLE_API_KEY) {
              const items = await googleSearch(`"${row.digits}" scam`, GOOGLE_API_KEY, GOOGLE_CX, "w2", 5);
              csvUsed++;
              if (items.length > 0) {
                foundUrl = items[0].link || foundUrl;
                metaSnippet = summarizeSnippets(items);
              }
            }

            const parts: string[] = [];
            parts.push(`FCC/FTC report ${toIsoDate(row.date!)}`);
            if (row.subject) parts.push(`Subject: ${row.subject}`);
            if (row.notes) parts.push(`Notes: ${row.notes}`);
            if (metaSnippet) parts.push(`Google (14d): ${metaSnippet}`);
            const description = parts.join(" | ").slice(0, 900);

            collected.push({
              phone_number: formatPhoneDisplay(row.digits),
              phone_digits: row.digits,
              source_name: "US Gov Data — FCC/FTC Sheet",
              source_url: foundUrl,
              report_date: toIsoDate(row.date!),
              category,
              description,
            });
          }
        }
      } else {
        console.warn("CSV fetch failed:", csvRes.status);
      }
    } catch (e) {
      console.warn("CSV fetch error:", e);
    }

    /* ---------- 3. WhatsApp / Spellcaster / Crypto CSE queries ---------- */
    let cseUsed = 0;
    if (GOOGLE_API_KEY) {
      const todayIso = toIsoDate(new Date());
      for (const q of WHATSAPP_QUERIES) {
        const items = await googleSearch(q.q, GOOGLE_API_KEY, GOOGLE_CX, "w2", 8);
        cseUsed++;
        for (const item of items) {
          const text = `${item.title || ""} ${item.snippet || ""}`;
          const nums = extractPhoneNumbers(text);
          for (const digits of nums) {
            if (collected.some(c => c.phone_digits === digits)) continue;
            const desc = `${q.label} (14d) | ${summarizeSnippets([item])}`.slice(0, 900);
            collected.push({
              phone_number: formatPhoneDisplay(digits),
              phone_digits: digits,
              source_name: `Google Search — ${q.label}`,
              source_url: item.link || "https://www.google.com",
              report_date: todayIso,
              category: q.category,
              description: desc,
            });
          }
        }
      }
    }

    /* ---------- 4. BBB Scam Tracker (direct HTML) ---------- */
    let bbbFound = 0;
    const todayIso = toIsoDate(new Date());
    for (const b of BBB_QUERIES) {
      const found = await fetchBBB(b.url);
      for (const f of found) {
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

    /* ---------- 5. Deduplicate one more time (keep newest) ---------- */
    const byDigits = new Map<string, ScamEntry>();
    for (const e of collected) {
      const existing = byDigits.get(e.phone_digits);
      if (!existing || existing.report_date < e.report_date) byDigits.set(e.phone_digits, e);
    }
    const finalEntries = Array.from(byDigits.values());

    /* ---------- 6. Upsert ---------- */
    const inserted: string[] = [];
    const errors: string[] = [];
    for (const entry of finalEntries) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 31);

      const { error } = await supabase
        .from("tracker_entries")
        .upsert(
          {
            phone_number: entry.phone_number,
            phone_digits: entry.phone_digits,
            source_name: entry.source_name,
            source_url: entry.source_url,
            report_date: entry.report_date,
            category: entry.category,
            description: entry.description,
            expires_at: expiresAt.toISOString(),
          },
          { onConflict: "phone_digits,source_name" },
        );

      if (error) errors.push(`${entry.phone_digits}: ${error.message}`);
      else inserted.push(entry.phone_digits);
    }

    return new Response(
      JSON.stringify({
        success: true,
        elapsed_ms: Date.now() - started,
        csv_rows_total: csvRowsCount,
        csv_google_queries: csvUsed,
        cse_queries: cseUsed,
        bbb_found: bbbFound,
        total_candidates: collected.length,
        deduped: finalEntries.length,
        inserted: inserted.length,
        errors: errors.length,
        errorDetails: errors.slice(0, 10),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
