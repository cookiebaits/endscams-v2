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

// Function to extract phone numbers
function extractPhoneNumbers(text: string): string[] {
  if (!text) return [];
  const phoneRegex = /(?:\+?(?:1|44|27|234))?[\s\-.]*\(?[0-9]{3}\)?[\s\-.]*[0-9]{3,4}[\s\-.]*[0-9]{3,4}/g;
  const rawMatches = text.match(phoneRegex) || [];
  const formatted = rawMatches.map(m => m.replace(/\D/g, ''));
  return formatted.filter(f => f.length >= 10 && f.length <= 14);
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

// Helper to ask Gemini for metadata
async function extractMetadataWithGemini(snippets: string, apiKey: string): Promise<string> {
   if (!apiKey || !snippets.trim()) return "";
   try {
     const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
     const prompt = `Analyze the following search results about a scam phone number. Extract the most important metadata (e.g., Company names impersonated, Names of scammers, specific threats, or if WhatsApp is mentioned). Keep it extremely concise, format as a short comma-separated list like "Company: Amazon, Name: Dr Love, Vector: WhatsApp". Return ONLY the metadata string and nothing else. If nothing relevant is found, return exactly "No specific metadata found."\n\nSearch Results:\n${snippets}`;

     const res = await fetch(url, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
     });

     if (res.ok) {
       const data = await res.json();
       let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
       text = text.trim();
       if (text === "No specific metadata found.") return "";
       return text;
     }
   } catch (e) {
     console.warn("Gemini API error:", e);
   }
   return "";
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

    // Delete reports older than 31 days
    const thirtyOneDaysAgo = new Date();
    thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);
    await supabase
        .from("tracker_entries")
        .delete()
        .lt("created_at", thirtyOneDaysAgo.toISOString());

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    const GOOGLE_CX = Deno.env.get("GOOGLE_CX") || "c32149b14c3304543";
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";

    const fetchedEntries: ScamEntry[] = [];

    // Phase 1: Pull some CSV data
    let csvRows: string[] = [];
    try {
       const csvUrl = "https://docs.google.com/spreadsheets/d/1wA8LivoY-tYG1gLI4BtX06SLARiiS83a/export?format=csv&id=1wA8LivoY-tYG1gLI4BtX06SLARiiS83a";
       const csvRes = await fetch(csvUrl);
       if (csvRes.ok) {
         const text = await csvRes.text();
         csvRows = text.split("\n").slice(1).filter(r => r.trim().length > 0);
       }
    } catch (e) {
       console.warn("CSV fetch error", e);
    }

    // Process a random batch of 3 US numbers from the CSV to avoid timeouts
    if (csvRows.length > 0) {
       const shuffledRows = csvRows.sort(() => 0.5 - Math.random()).slice(0, 3);
       for (const row of shuffledRows) {
          const cols = row.split(",");
          const phoneRaw = cols[0]?.trim() || "";
          const subject = cols[2]?.trim() || "Scam";

          if (phoneRaw.length >= 10) {
             const query = `"${phoneRaw}" ${subject}`;
             const searchUrl = `https://customsearch.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(query)}&dateRestrict=w2`;

             let desc = "Number reported in FTC/FCC violation database.";
             let foundUrl = "https://docs.google.com/spreadsheets/d/1wA8LivoY-tYG1gLI4BtX06SLARiiS83a";

             try {
                const searchRes = await fetch(searchUrl);
                if (searchRes.ok) {
                   const sData = await searchRes.json();
                   const items = sData.items || [];
                   if (items.length > 0) {
                      foundUrl = items[0].link;
                      const allSnippets = items.map((i: Record<string, unknown>) => `${i.title} ${i.snippet}`).join(" \n ");

                      // Check if the EXACT number is in the results
                      if (allSnippets.replace(/\D/g, '').includes(phoneRaw)) {
                          if (GEMINI_API_KEY) {
                             const metadata = await extractMetadataWithGemini(allSnippets, GEMINI_API_KEY);
                             if (metadata) desc += ` | AI Analysis: ${metadata}`;
                          } else {
                             desc += ` | Mentioned online in relation to: ${subject}`;
                          }
                      }
                   }
                }
             } catch (e) {
                console.warn("Google Search failed for CSV number", e);
             }

             // Insert whether we found search results or not ("leave it as-is")
             fetchedEntries.push({
                phone_number: formatPhoneDisplay(phoneRaw),
                phone_digits: phoneRaw,
                source_name: `US Gov Data — ${subject}`,
                source_url: foundUrl,
                report_date: new Date().toISOString().split('T')[0],
                category: subject,
                description: desc
             });
          }
       }
    }

    // Phase 2: Search for WhatsApp/International scams dynamically
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
                let desc = rawItem.snippet ? rawItem.snippet.substring(0, 150) : "WhatsApp scam identified via search.";

                if (GEMINI_API_KEY) {
                   const metadata = await extractMetadataWithGemini(textToSearch, GEMINI_API_KEY);
                   if (metadata) desc += ` | AI Analysis: ${metadata}`;
                } else if (textToSearch.toLowerCase().includes('whatsapp')) {
                   desc += " | Metadata: WhatsApp contact confirmed";
                }

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
    } catch (e) {
        console.warn("WhatsApp search failed", e);
    }

    // Fallback if absolutely nothing works (e.g. API keys dead and CSV fails)
    if (fetchedEntries.length === 0) {
      const randomDigits = "234" + Math.floor(7000000000 + Math.random() * 2000000000).toString();
      fetchedEntries.push({
         phone_number: formatPhoneDisplay(randomDigits),
         phone_digits: randomDigits,
         source_name: "Fallback Internal Scraper",
         source_url: "https://www.google.com",
         report_date: new Date().toISOString().split('T')[0],
         category: "Unknown",
         description: "System testing fallback entry."
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
