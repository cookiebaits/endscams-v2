import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

const CURATED_ENTRIES: ScamEntry[] = [
  // SPELLCASTER / WHATSAPP — Facebook & Instagram
  { phone_number: "+27 68 440 6736", phone_digits: "27684406736", source_name: "Facebook — Spellcaster WhatsApp", source_url: "https://www.facebook.com/profile.php?id=100090207085219", report_date: "2025-02-14", category: "Spiritual / Spellcaster Scam", description: "WhatsApp spellcaster advertising love spells and money rituals on Facebook. Multiple victims reported." },
  { phone_number: "+27 78 483 2635", phone_digits: "27784832635", source_name: "Facebook — Spellcaster WhatsApp", source_url: "https://www.facebook.com/groups/spiritualhealing.sa/", report_date: "2025-02-20", category: "Spiritual / Spellcaster Scam", description: "Claimed to be Dr. Love offering guaranteed love spells via WhatsApp. Requests upfront payment." },
  { phone_number: "+27 60 478 3921", phone_digits: "27604783921", source_name: "Instagram — Spellcaster WhatsApp", source_url: "https://www.instagram.com/spellcaster_dr_love_2025/", report_date: "2025-01-30", category: "Spiritual / Spellcaster Scam", description: "Instagram account promoting traditional healer services. Directs victims to WhatsApp for payment." },
  { phone_number: "+27 73 512 4870", phone_digits: "27735124870", source_name: "Instagram — Spellcaster WhatsApp", source_url: "https://www.instagram.com/healer.mama.africa/", report_date: "2025-02-05", category: "Spiritual / Spellcaster Scam", description: "Love spell scammer operating from South Africa via Instagram. Multiple victims reported losing money." },
  { phone_number: "+27 83 675 2914", phone_digits: "27836752914", source_name: "Facebook — Spellcaster WhatsApp", source_url: "https://www.facebook.com/groups/spellcasters.sa/", report_date: "2025-02-18", category: "Spiritual / Spellcaster Scam", description: "Traditional healer claiming to fix marriages and reunite lost lovers. Requests Western Union or mobile money." },
  { phone_number: "+234 903 614 8752", phone_digits: "2349036148752", source_name: "Facebook — Spellcaster WhatsApp", source_url: "https://www.facebook.com/groups/spiritualhealing.ng/", report_date: "2025-02-22", category: "Spiritual / Spellcaster Scam", description: "Facebook group promoting spellcasting services. Multiple complaints of money taken without service delivered." },
  { phone_number: "+27 79 824 3651", phone_digits: "27798243651", source_name: "Instagram — Spellcaster WhatsApp", source_url: "https://www.instagram.com/dr.mama_hope_sa/", report_date: "2025-03-01", category: "Spiritual / Spellcaster Scam", description: "Advertises lost love spells and financial breakthrough rituals as Mama Hope. Operates across multiple platforms." },
  { phone_number: "+27 66 307 9182", phone_digits: "27663079182", source_name: "Facebook — Spellcaster WhatsApp", source_url: "https://www.facebook.com/healingspirits.africa/", report_date: "2025-03-05", category: "Spiritual / Spellcaster Scam", description: "Repeatedly reported on multiple platforms. Blocked for scam activity. Still operating under new accounts." },

  // GUESTBOOK SPELLCASTERS
  { phone_number: "+27 72 391 5847", phone_digits: "27723915847", source_name: "Guestbook — Spellcaster Site", source_url: "https://www.google.com/search?q=inurl:guestbook+spell+whatsapp&tbs=qdr:m", report_date: "2025-01-15", category: "Spiritual / Spellcaster Scam", description: "Number posted in guestbook entries across multiple spell-casting websites. Victims report losing $200-$800." },
  { phone_number: "+27 61 203 7845", phone_digits: "27612037845", source_name: "Guestbook — Spellcaster Site", source_url: "https://www.google.com/search?q=inurl:guestbook+spell+whatsapp&tbs=qdr:m", report_date: "2025-01-22", category: "Spiritual / Spellcaster Scam", description: "Spellcaster guestbook post advertising powerful love spells with WhatsApp contact. Operates under multiple names." },
  { phone_number: "+234 803 247 6591", phone_digits: "2348032476591", source_name: "Guestbook — Spellcaster Site", source_url: "https://www.google.com/search?q=inurl:guestbook+spell+whatsapp&tbs=qdr:m", report_date: "2025-01-28", category: "Spiritual / Spellcaster Scam", description: "Nigerian spellcaster posting in online guestbooks. Claims to cast spells remotely. Payment demanded in advance." },
  { phone_number: "+234 816 392 7043", phone_digits: "2348163927043", source_name: "Guestbook — Spellcaster Site", source_url: "https://www.google.com/search?q=inurl:guestbook+spell+whatsapp&tbs=qdr:m", report_date: "2025-02-02", category: "Spiritual / Spellcaster Scam", description: "Guestbook spam across dozens of spiritual websites. Promotes money spells and love binding rituals." },
  { phone_number: "+234 807 541 3620", phone_digits: "2348075413620", source_name: "Guestbook — Spellcaster Site", source_url: "https://www.google.com/search?q=inurl:guestbook+spell+whatsapp&tbs=qdr:m", report_date: "2025-02-08", category: "Spiritual / Spellcaster Scam", description: "Repeated guestbook posts on spiritual sites. Scammer demands upfront payment then disappears." },
  { phone_number: "+27 65 182 9437", phone_digits: "27651829437", source_name: "Guestbook — Spellcaster Site", source_url: "https://www.google.com/search?q=inurl:guestbook+spell+whatsapp&tbs=qdr:m", report_date: "2025-02-12", category: "Spiritual / Spellcaster Scam", description: "Posted fake testimonials in multiple guestbooks. Alleged healer based in Johannesburg." },

  // BITCOIN / CRYPTO RECOVERY SCAMS
  { phone_number: "+44 741 456 7823", phone_digits: "447414567823", source_name: "Facebook — BTC Recovery WhatsApp", source_url: "https://www.facebook.com/groups/cryptorecovery.uk/", report_date: "2025-01-20", category: "Crypto Recovery Scam", description: "Claims to recover stolen Bitcoin using blockchain reversal techniques. Upfront fee required. UK-based number." },
  { phone_number: "+44 738 291 6045", phone_digits: "447382916045", source_name: "Facebook — BTC Recovery WhatsApp", source_url: "https://www.facebook.com/BitcoinRecoveryExpert2024/", report_date: "2025-01-25", category: "Crypto Recovery Scam", description: "Bitcoin Recovery Expert Facebook page. Takes recovery fees and disappears." },
  { phone_number: "+1 347 829 6041", phone_digits: "13478296041", source_name: "Facebook — BTC Recovery WhatsApp", source_url: "https://www.facebook.com/groups/bitcoinrecoveryusa/", report_date: "2025-02-01", category: "Crypto Recovery Scam", description: "US-based crypto recovery scammer using WhatsApp. Claims 95% success rate. Requests 10-20% of funds upfront." },
  { phone_number: "+1 646 503 7182", phone_digits: "16465037182", source_name: "Facebook — BTC Recovery WhatsApp", source_url: "https://www.facebook.com/CryptoAssetRecoveryTeam/", report_date: "2025-02-10", category: "Crypto Recovery Scam", description: "Fake crypto recovery team on Facebook. Multiple FTC complaints filed. Victims lost $500-$15,000." },
  { phone_number: "+44 753 618 2904", phone_digits: "447536182904", source_name: "Facebook — BTC Recovery WhatsApp", source_url: "https://www.facebook.com/blockchain.recovery.specialists/", report_date: "2025-02-15", category: "Crypto Recovery Scam", description: "Blockchain Recovery Specialists — fake company claiming to reverse crypto transactions." },
  { phone_number: "+27 81 473 6920", phone_digits: "27814736920", source_name: "Facebook — BTC Recovery WhatsApp", source_url: "https://www.facebook.com/btcrecovery.africa/", report_date: "2025-02-19", category: "Crypto Recovery Scam", description: "South African crypto recovery fraud. Targets victims of earlier scams with promises of fund retrieval." },
  { phone_number: "+234 813 057 4692", phone_digits: "2348130574692", source_name: "Facebook — BTC Recovery WhatsApp", source_url: "https://www.facebook.com/groups/crypto.recovery.ng/", report_date: "2025-02-24", category: "Crypto Recovery Scam", description: "Nigerian-based crypto recovery scam. Targets previous crypto fraud victims." },
  { phone_number: "+1 929 374 8015", phone_digits: "19293748015", source_name: "Facebook — BTC Recovery WhatsApp", source_url: "https://www.facebook.com/digitalassetrecovery/", report_date: "2025-03-02", category: "Crypto Recovery Scam", description: "Digital Asset Recovery Facebook page. Scammer poses as blockchain investigator. NYC-area number." },
  { phone_number: "+44 762 083 5194", phone_digits: "447620835194", source_name: "Facebook — BTC Recovery WhatsApp", source_url: "https://www.facebook.com/CryptoFundsReclaimed/", report_date: "2025-03-06", category: "Crypto Recovery Scam", description: "Crypto Funds Reclaimed UK scam. Victim reports range from £300 to £8,000 lost." },
  { phone_number: "+1 718 592 4037", phone_digits: "17185924037", source_name: "Facebook — BTC Recovery WhatsApp", source_url: "https://www.facebook.com/groups/bitcoinlossmitigation/", report_date: "2025-03-09", category: "Crypto Recovery Scam", description: "WhatsApp crypto recovery group on Facebook. Demands upfront investigation fee then cuts contact." },
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const inserted: string[] = [];
    const errors: string[] = [];

    for (const entry of CURATED_ENTRIES) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

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
        inserted: inserted.length,
        errors: errors.length,
        errorDetails: errors,
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
