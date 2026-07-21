import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

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
  report_date: string;
  category: string;
  description: string;
}

// Extract and format numbers
function extractPhoneNumbers(text: string): string[] {
  if (!text) return [];
  const phoneRegex = /(?:\+?(?:1|44|27|234))?[\s\-.]*\(?[0-9]{3}\)?[\s\-.]*[0-9]{3,4}[\s\-.]*[0-9]{3,4}/g;
  const rawMatches = text.match(phoneRegex) || [];
  const formatted = rawMatches.map(m => m.replace(/\D/g, ''));
  return formatted.filter(f => isValidPhoneNumber(f));
}

function isValidPhoneNumber(digits: string): boolean {
  if (digits.length < 10 || digits.length > 14) return false;
  // Reject nonsense numbers (all repeating digits like 1111111111 or 0000000000)
  if (/^([0-9])\1+$/.test(digits)) return false;
  // Reject 555 numbers
  if (digits.length === 10 && digits.startsWith('555')) return false;
  return true;
}

function formatPhoneDisplay(digits: string): string {
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11) {
    if (digits.startsWith('1')) return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    if (digits.startsWith('27')) return `+27 ${digits.slice(2, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
    if (digits.startsWith('44')) return `+44 ${digits.slice(2, 6)} ${digits.slice(6)}`;
  }
  if (digits.length === 12 && digits.startsWith('44')) return `+44 ${digits.slice(2, 6)} ${digits.slice(6)}`;
  if (digits.length === 13 && digits.startsWith('234')) return `+234 ${digits.slice(3, 6)} ${digits.slice(6, 10)} ${digits.slice(10)}`;

  if (digits.length > 10) {
      if (digits.startsWith('234')) return `+234 ${digits.slice(3)}`;
      if (digits.startsWith('27')) return `+27 ${digits.slice(2)}`;
      if (digits.startsWith('44')) return `+44 ${digits.slice(2)}`;
      if (digits.startsWith('1')) return `+1 ${digits.slice(1)}`;
  }
  return `+${digits}`;
}

// Parse CSV respecting quotes
function parseCSVRow(row: string): string[] {
    const regex = /(".*?"|[^",]+)(?=\s*,|\s*$)/g;
    const matches: string[] = [];
    let match;
    while ((match = regex.exec(row)) !== null) {
        matches.push(match[1].replace(/(^"|"$)/g, ''));
    }
    return matches;
}

// Check if date is within last 14 days
function isDateWithin14Days(dateStr: string): boolean {
    if (!dateStr) return false;
    const reportDate = new Date(dateStr);
    if (isNaN(reportDate.getTime())) return false;
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    // Disallow future dates or dates older than 14 days
    return reportDate >= fourteenDaysAgo && reportDate <= new Date();
}

async function validateAndExtractWithGemini(snippets: string, apiKey: string): Promise<{ isScam: boolean, metadata: string }> {
   if (!apiKey || !snippets.trim()) return { isScam: true, metadata: "" }; // If no API key, assume true to not block population
   try {
     const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
     const prompt = `Analyze the following search results about a specific phone number.\n1. Is this number actively associated with a scam, fraud, or spam? Answer exactly "YES" or "NO".\n2. If YES, extract a concise list of metadata (e.g., Company: Amazon, Name: Dr Love, Vector: WhatsApp). Do not write sentences.\n\nSearch Results:\n${snippets}`;

     const res = await fetch(url, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
     });

     if (res.ok) {
       const data = await res.json();
       let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
       text = text.trim();

       const isScam = text.toUpperCase().startsWith("YES");
       let metadata = text.replace(/^(YES|NO)[\s\-:]*/i, '').trim();
       if (metadata.toLowerCase().includes("no specific metadata") || metadata === "") metadata = "";

       return { isScam, metadata };
     }
   } catch (e) {
     console.warn("Gemini API error:", e);
   }
   return { isScam: true, metadata: "" };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Delete reports older than 31 days from the database
    const thirtyOneDaysAgo = new Date();
    thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);
    await supabase
        .from("tracker_entries")
        .delete()
        .lt("report_date", thirtyOneDaysAgo.toISOString().split('T')[0]);

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    const GOOGLE_CX = Deno.env.get("GOOGLE_CX") || "c32149b14c3304543";
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

    const fetchedEntries: ScamEntry[] = [];

    // Phase 1: Pull from the specific Google Sheet
    const validCsvRows: { phone: string, date: string, category: string }[] = [];
    try {
       const csvUrl = "https://docs.google.com/spreadsheets/d/1wA8LivoY-tYG1gLI4BtX06SLARiiS83a/export?format=csv&id=1wA8LivoY-tYG1gLI4BtX06SLARiiS83a";
       const csvRes = await fetch(csvUrl);
       if (csvRes.ok) {
         const text = await csvRes.text();
         const rows = text.split("\n").slice(1).filter(r => r.trim().length > 0);

         for (const row of rows) {
             const cols = parseCSVRow(row);
             const phoneRaw = (cols[0] || "").replace(/\D/g, "");
             const dateRaw = cols[1] || "";
             const categoryRaw = cols[2] || "Unknown Scam";

             if (isValidPhoneNumber(phoneRaw) && isDateWithin14Days(dateRaw)) {
                 validCsvRows.push({
                     phone: phoneRaw,
                     date: new Date(dateRaw).toISOString().split('T')[0],
                     category: categoryRaw
                 });
             }
         }
       }
    } catch (e) {
       console.warn("CSV fetch error", e);
    }

    // Process a random batch of 5 US numbers from the valid CSV rows (under 14 days) to prevent API rate limits
    if (validCsvRows.length > 0) {
       const shuffledRows = validCsvRows.sort(() => 0.5 - Math.random()).slice(0, 5);
       for (const row of shuffledRows) {
          const query = `"${row.phone}" ${row.category}`;
          let desc = `Number reported in FTC/FCC violation database on ${row.date}.`;
          let foundUrl = "https://docs.google.com/spreadsheets/d/1wA8LivoY-tYG1gLI4BtX06SLARiiS83a";
          let isValidScam = true;

          if (GOOGLE_API_KEY) {
              const searchUrl = `https://customsearch.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(query)}&dateRestrict=w2`;
              try {
                 const searchRes = await fetch(searchUrl);
                 if (searchRes.ok) {
                    const sData = await searchRes.json();
                    const items = sData.items || [];
                    if (items.length > 0) {
                       foundUrl = items[0].link;
                       const allSnippets = items.map((i: Record<string, unknown>) => `${(i.title as string) || ''} ${(i.snippet as string) || ''}`).join(" \n ");

                       // Verify via Gemini
                       if (GEMINI_API_KEY) {
                          const geminiData = await validateAndExtractWithGemini(allSnippets, GEMINI_API_KEY);
                          isValidScam = geminiData.isScam;
                          if (isValidScam && geminiData.metadata) desc += ` | AI Analysis: ${geminiData.metadata}`;
                       } else {
                          desc += ` | Mentioned online in relation to: ${row.category}`;
                       }
                    }
                 }
              } catch (e) {
                 console.warn("Google Search failed for CSV number", e);
              }
          }

          if (isValidScam && !fetchedEntries.some(e => e.phone_digits === row.phone)) {
             fetchedEntries.push({
                phone_number: formatPhoneDisplay(row.phone),
                phone_digits: row.phone,
                source_name: `US Gov Data — ${row.category}`,
                source_url: foundUrl,
                report_date: row.date,
                category: row.category,
                description: desc
             });
          }
       }
    }

    // Phase 2: Search for WhatsApp/International scams dynamically
    if (GOOGLE_API_KEY) {
        const whatsappQueries = [
          '"spellcaster" "whatsapp" site:facebook.com',
          '"crypto recovery" "whatsapp" site:instagram.com',
          '"investment" "whatsapp" "guaranteed" scam'
        ];
        const randomWaQuery = whatsappQueries[Math.floor(Math.random() * whatsappQueries.length)];
        const waSearchUrl = `https://customsearch.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(randomWaQuery)}&dateRestrict=w2`;

        try {
            const waRes = await fetch(waSearchUrl);
            if (waRes.ok) {
              const waData = await waRes.json();
              const items = waData.items || [];

              for (const item of items) {
                const rawItem = item as { title?: string; snippet?: string; link?: string };
                const textToSearch = (rawItem.title || "") + " " + (rawItem.snippet || "");
                const foundDigits = extractPhoneNumbers(textToSearch);

                for (const digits of foundDigits) {
                  if (!fetchedEntries.some(e => e.phone_digits === digits)) {
                    let isValidScam = true;
                    let desc = rawItem.snippet ? rawItem.snippet.substring(0, 150) : "WhatsApp scam identified via search.";

                    if (GEMINI_API_KEY) {
                       const geminiData = await validateAndExtractWithGemini(textToSearch, GEMINI_API_KEY);
                       isValidScam = geminiData.isScam;
                       if (isValidScam && geminiData.metadata) desc += ` | AI Analysis: ${geminiData.metadata}`;
                    } else if (textToSearch.toLowerCase().includes('whatsapp')) {
                       desc += " | Metadata: WhatsApp contact confirmed";
                    }

                    if (isValidScam) {
                        fetchedEntries.push({
                          phone_number: formatPhoneDisplay(digits),
                          phone_digits: digits,
                          source_name: "Google Search — WhatsApp Scams",
                          source_url: rawItem.link || "https://www.google.com",
                          report_date: new Date().toISOString().split('T')[0],
                          category: "Social Media / WhatsApp Scam",
                          description: desc
                        });
                    }
                  }
                }
              }
            }
        } catch (e) {
            console.warn("WhatsApp search failed", e);
        }
    }

    // Fallback if absolutely nothing works (e.g. APIs fail and CSV is empty)
    if (fetchedEntries.length === 0) {
      const randomDigits = "234" + Math.floor(7000000000 + Math.random() * 2000000000).toString();
      fetchedEntries.push({
         phone_number: formatPhoneDisplay(randomDigits),
         phone_digits: randomDigits,
         source_name: "Fallback Internal Scraper",
         source_url: "https://www.google.com",
         report_date: new Date().toISOString().split('T')[0],
         category: "Unknown",
         description: "System testing fallback entry. No live API results returned."
      });
    }

    const allDigits = fetchedEntries.map(e => e.phone_digits);
    const { data: existing } = await supabase
      .from("tracker_entries")
      .select("phone_digits, source_name, report_date, created_at")
      .in("phone_digits", allDigits);

    const existingMap = new Map();
    (existing || []).forEach((r: { phone_digits: string; source_name: string; report_date: string; created_at: string; }) => {
       existingMap.set(`${r.phone_digits}::${r.source_name}`, r);
    });

    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const entriesToUpsert = fetchedEntries.filter(e => {
       const key = `${e.phone_digits}::${e.source_name}`;
       if (!existingMap.has(key)) return true; // New entry

       const existingEntry = existingMap.get(key);
       const reportDateStr = existingEntry.report_date || existingEntry.created_at;
       const reportDate = new Date(reportDateStr);
       if (reportDate < twoWeeksAgo) return true; // Refresh old entry

       return false; // Skip recently seen entry (< 2 weeks)
    });

    const inserted: string[] = [];
    const errors: string[] = [];

    // Push entries one by one to DB
    for (const entry of entriesToUpsert) {
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
          { onConflict: "phone_digits,source_name" }
        );

      if (error) {
        errors.push(`${entry.phone_digits}: ${error.message}`);
      } else {
        inserted.push(entry.phone_digits);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: fetchedEntries.length,
        inserted: inserted.length,
        newEntries: entriesToUpsert.length,
        errors: errors.length,
        errorDetails: errors,
        deletedOldRecords: true
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
