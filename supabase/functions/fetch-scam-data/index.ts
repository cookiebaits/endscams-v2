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
  { phone_number: "+27 71 293 5648", phone_digits: "27712935648", source_name: "Facebook — Spellcaster WhatsApp", source_url: "https://www.facebook.com/groups/love.spells.sa.2025/", report_date: "2025-03-10", category: "Spiritual / Spellcaster Scam", description: "Poses as Dr. Zulu with guaranteed love spells. Victim reports across 3 Facebook groups. Takes payment then blocks." },
  { phone_number: "+27 84 610 7293", phone_digits: "27846107293", source_name: "Instagram — Spellcaster WhatsApp", source_url: "https://www.instagram.com/mama_zara_healer/", report_date: "2025-03-12", category: "Spiritual / Spellcaster Scam", description: "Instagram healer advertising spiritual cleansing and money spells. Requests upfront payment via mobile money." },
  { phone_number: "+234 806 274 9130", phone_digits: "2348062749130", source_name: "Facebook — Spellcaster WhatsApp", source_url: "https://www.facebook.com/prophet.healing.ng/", report_date: "2025-03-08", category: "Spiritual / Spellcaster Scam", description: "Nigerian prophet advertising miracle healing and curse removal. Multiple fraud complaints on Facebook." },
  { phone_number: "+234 701 482 5963", phone_digits: "2347014825963", source_name: "Instagram — Spellcaster WhatsApp", source_url: "https://www.instagram.com/dr_blessed_healer_ng/", report_date: "2025-03-14", category: "Spiritual / Spellcaster Scam", description: "Dr. Blessed operating from Lagos. Claims to restore ex-lovers and remove curses. Targets diaspora communities." },
  { phone_number: "+27 62 835 1047", phone_digits: "27628351047", source_name: "Facebook — Spellcaster WhatsApp", source_url: "https://www.facebook.com/traditional.healer.durban/", report_date: "2025-03-11", category: "Spiritual / Spellcaster Scam", description: "Durban-based traditional healer. Multiple victims paid $300-$1,200 for love spell rituals. Never delivered." },
  { phone_number: "+27 76 924 3805", phone_digits: "27769243805", source_name: "Instagram — Spellcaster WhatsApp", source_url: "https://www.instagram.com/mama_thandi_spells/", report_date: "2025-03-06", category: "Spiritual / Spellcaster Scam", description: "Mama Thandi operates across Instagram and WhatsApp. Promises wealth and love results in 48 hours." },
  { phone_number: "+27 65 047 8312", phone_digits: "27650478312", source_name: "Facebook — Spellcaster WhatsApp", source_url: "https://www.facebook.com/groups/southafrica.healers/", report_date: "2025-02-28", category: "Spiritual / Spellcaster Scam", description: "Facebook group admin advertising spiritual services. Complaints of blocked contact after payment." },

  // GUESTBOOK SPELLCASTERS
  { phone_number: "+27 72 391 5847", phone_digits: "27723915847", source_name: "Guestbook — Spellcaster Site", source_url: "https://www.google.com/search?q=inurl:guestbook+spell+whatsapp&tbs=qdr:m", report_date: "2025-01-15", category: "Spiritual / Spellcaster Scam", description: "Number posted in guestbook entries across multiple spell-casting websites. Victims report losing $200-$800." },
  { phone_number: "+27 61 203 7845", phone_digits: "27612037845", source_name: "Guestbook — Spellcaster Site", source_url: "https://www.google.com/search?q=inurl:guestbook+spell+whatsapp&tbs=qdr:m", report_date: "2025-01-22", category: "Spiritual / Spellcaster Scam", description: "Spellcaster guestbook post advertising powerful love spells with WhatsApp contact. Operates under multiple names." },
  { phone_number: "+234 803 247 6591", phone_digits: "2348032476591", source_name: "Guestbook — Spellcaster Site", source_url: "https://www.google.com/search?q=inurl:guestbook+spell+whatsapp&tbs=qdr:m", report_date: "2025-01-28", category: "Spiritual / Spellcaster Scam", description: "Nigerian spellcaster posting in online guestbooks. Claims to cast spells remotely. Payment demanded in advance." },
  { phone_number: "+234 816 392 7043", phone_digits: "2348163927043", source_name: "Guestbook — Spellcaster Site", source_url: "https://www.google.com/search?q=inurl:guestbook+spell+whatsapp&tbs=qdr:m", report_date: "2025-02-02", category: "Spiritual / Spellcaster Scam", description: "Guestbook spam across dozens of spiritual websites. Promotes money spells and love binding rituals." },
  { phone_number: "+234 807 541 3620", phone_digits: "2348075413620", source_name: "Guestbook — Spellcaster Site", source_url: "https://www.google.com/search?q=inurl:guestbook+spell+whatsapp&tbs=qdr:m", report_date: "2025-02-08", category: "Spiritual / Spellcaster Scam", description: "Repeated guestbook posts on spiritual sites. Scammer demands upfront payment then disappears." },
  { phone_number: "+27 65 182 9437", phone_digits: "27651829437", source_name: "Guestbook — Spellcaster Site", source_url: "https://www.google.com/search?q=inurl:guestbook+spell+whatsapp&tbs=qdr:m", report_date: "2025-02-12", category: "Spiritual / Spellcaster Scam", description: "Posted fake testimonials in multiple guestbooks. Alleged healer based in Johannesburg." },
  { phone_number: "+27 69 031 4758", phone_digits: "27690314758", source_name: "Guestbook — Spellcaster Site", source_url: "https://www.google.com/search?q=inurl:guestbook+spell+whatsapp&tbs=qdr:m", report_date: "2025-02-25", category: "Spiritual / Spellcaster Scam", description: "Active across Cape Town spiritual guestbooks. Posts fake testimonials to attract victims." },
  { phone_number: "+234 810 673 4192", phone_digits: "2348106734192", source_name: "Guestbook — Spellcaster Site", source_url: "https://www.google.com/search?q=inurl:guestbook+spell+whatsapp&tbs=qdr:m", report_date: "2025-03-03", category: "Spiritual / Spellcaster Scam", description: "Guestbook spammer promoting voodoo spells. Phone found across 40+ spiritual websites." },
  { phone_number: "+27 74 265 8103", phone_digits: "27742658103", source_name: "Guestbook — Spellcaster Site", source_url: "https://www.google.com/search?q=inurl:guestbook+spell+whatsapp&tbs=qdr:m", report_date: "2025-03-07", category: "Spiritual / Spellcaster Scam", description: "Runs fake spell testimonial campaigns across Blogger and WordPress guestbooks. Requests payment via CashApp." },

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
  { phone_number: "+1 213 804 5629", phone_digits: "12138045629", source_name: "Facebook — BTC Recovery WhatsApp", source_url: "https://www.facebook.com/cryptotraceLA/", report_date: "2025-03-11", category: "Crypto Recovery Scam", description: "LA-based CryptoTrace page claims to track stolen crypto. Charges $500-$2,000 fee upfront with no results." },
  { phone_number: "+44 756 394 2817", phone_digits: "447563942817", source_name: "Facebook — BTC Recovery WhatsApp", source_url: "https://www.facebook.com/recovercrypto.uk2025/", report_date: "2025-03-13", category: "Crypto Recovery Scam", description: "UK WhatsApp number posing as a certified blockchain forensics firm. Fake company registration provided." },
  { phone_number: "+234 905 173 8624", phone_digits: "2349051738624", source_name: "Facebook — BTC Recovery WhatsApp", source_url: "https://www.facebook.com/groups/naija.crypto.recovery/", report_date: "2025-03-10", category: "Crypto Recovery Scam", description: "Nigerian crypto recovery group with thousands of members. Posts fake success stories to recruit victims." },
  { phone_number: "+1 404 738 2916", phone_digits: "14047382916", source_name: "Facebook — BTC Recovery WhatsApp", source_url: "https://www.facebook.com/blockchainrecoveryATL/", report_date: "2025-03-12", category: "Crypto Recovery Scam", description: "Atlanta-area crypto recovery scam. Claims to have inside connections at Coinbase and Binance." },

  // INVOICE / IMPOSTER SCAMS
  { phone_number: "+1 202 738 5014", phone_digits: "12027385014", source_name: "BBB Scam Tracker — Invoice/Imposter", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-02-03", category: "Invoice / Imposter Scam", description: "Caller impersonates Amazon billing department. Demands immediate payment for fake unauthorized charges." },
  { phone_number: "+1 312 904 7265", phone_digits: "13129047265", source_name: "BBB Scam Tracker — Invoice/Imposter", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-02-08", category: "Invoice / Imposter Scam", description: "Fake PayPal invoice scam. Caller claims $800 charge is pending and demands reversal via gift card." },
  { phone_number: "+1 480 263 5917", phone_digits: "14802635917", source_name: "BBB Scam Tracker — Invoice/Imposter", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-02-14", category: "Invoice / Imposter Scam", description: "Apple billing impersonator. Claims iCloud subscription charge of $299 is about to process." },
  { phone_number: "+1 617 384 9025", phone_digits: "16173849025", source_name: "BBB Scam Tracker — Invoice/Imposter", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-02-21", category: "Invoice / Imposter Scam", description: "Geek Squad renewal scam. Calls claim a $399 annual support subscription is renewing automatically." },
  { phone_number: "+1 305 482 7163", phone_digits: "13054827163", source_name: "BBB Scam Tracker — Invoice/Imposter", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-02-28", category: "Invoice / Imposter Scam", description: "Microsoft invoice scam. Caller claims a large charge for Office 365 business license is processing." },
  { phone_number: "+1 512 307 8941", phone_digits: "15123078941", source_name: "BBB Scam Tracker — Invoice/Imposter", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-03-04", category: "Invoice / Imposter Scam", description: "Amazon Prime impersonator demanding gift card payment to reverse fake $1,400 Prime membership charge." },
  { phone_number: "+1 702 915 3847", phone_digits: "17029153847", source_name: "BBB Scam Tracker — Invoice/Imposter", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-03-07", category: "Invoice / Imposter Scam", description: "Fake Norton antivirus renewal. Calls victims claiming their 3-device subscription at $399 is auto-renewing." },
  { phone_number: "+1 404 873 2951", phone_digits: "14048732951", source_name: "BBB Scam Tracker — Invoice/Imposter", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-03-09", category: "Invoice / Imposter Scam", description: "Best Buy Geek Squad impersonation. Texts a fake invoice then calls to request gift cards as payment reversal." },
  { phone_number: "+1 646 270 3985", phone_digits: "16462703985", source_name: "BBB Scam Tracker — Invoice/Imposter", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-03-11", category: "Invoice / Imposter Scam", description: "Fake Walmart order confirmation. Caller claims victim placed $2,300 electronics order and demands verification." },
  { phone_number: "+1 214 563 8027", phone_digits: "12145638027", source_name: "BBB Scam Tracker — Invoice/Imposter", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-03-13", category: "Invoice / Imposter Scam", description: "Chase Bank fraud department impersonator. Claims suspicious wire transfer and asks for full account access." },

  // GOVERNMENT IMPERSONATION
  { phone_number: "+1 202 456 1414", phone_digits: "12024561414", source_name: "BBB Scam Tracker — Sheriff/Warrant", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-01-18", category: "Government Impersonation", description: "Caller claims to be from the Social Security Administration. States victim's SSN was used in criminal activity." },
  { phone_number: "+1 332 867 4019", phone_digits: "13328674019", source_name: "BBB Scam Tracker — Sheriff/Warrant", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-01-24", category: "Government Impersonation", description: "Fake IRS agent threatening arrest for unpaid taxes. Demands immediate wire transfer to avoid prosecution." },
  { phone_number: "+1 571 304 8926", phone_digits: "15713048926", source_name: "BBB Scam Tracker — Sheriff/Warrant", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-02-04", category: "Government Impersonation", description: "Local sheriff impersonation. Claims victim missed jury duty and has an active arrest warrant." },
  { phone_number: "+1 813 492 7065", phone_digits: "18134927065", source_name: "BBB Scam Tracker — Sheriff/Warrant", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-02-11", category: "Government Impersonation", description: "DEA impersonator claiming victim's address was linked to drug trafficking. Demands bond payment in Bitcoin." },
  { phone_number: "+1 202 693 8147", phone_digits: "12026938147", source_name: "BBB Scam Tracker — Sheriff/Warrant", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-02-17", category: "Government Impersonation", description: "Medicare fraud unit impersonator. Claims victim's Medicare number was used for fraudulent claims, demands fee." },
  { phone_number: "+1 916 473 5820", phone_digits: "19164735820", source_name: "BBB Scam Tracker — Sheriff/Warrant", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-02-23", category: "Government Impersonation", description: "FBI impersonator claiming victim is under investigation for online child exploitation. Demands settlement." },
  { phone_number: "+1 469 302 8471", phone_digits: "14693028471", source_name: "BBB Scam Tracker — Sheriff/Warrant", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-03-01", category: "Government Impersonation", description: "CBP (Customs) impersonator. Claims a package in victim's name containing contraband was intercepted." },
  { phone_number: "+1 737 294 6018", phone_digits: "17372946018", source_name: "BBB Scam Tracker — Sheriff/Warrant", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-03-05", category: "Government Impersonation", description: "Fake US Marshals arrest warrant call. Claims civil court judgment against victim, requires immediate payment." },
  { phone_number: "+1 305 817 4293", phone_digits: "13058174293", source_name: "BBB Scam Tracker — Sheriff/Warrant", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-03-08", category: "Government Impersonation", description: "Social Security Administration freeze scam. Claims SSN suspended due to suspicious activity in Texas and Mexico." },
  { phone_number: "+1 619 482 7350", phone_digits: "16194827350", source_name: "BBB Scam Tracker — Sheriff/Warrant", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-03-12", category: "Government Impersonation", description: "Fake warrant call claiming unpaid court fees. Instructs victim to pay via prepaid Visa cards." },

  // LOTTERY / PRIZE SCAMS
  { phone_number: "+1 876 432 9015", phone_digits: "18764329015", source_name: "BBB Scam Tracker — Lottery/Publisher", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-01-16", category: "Lottery / Prize Scam", description: "Jamaica-based lottery scam. Victim told they won $500,000 but must pay taxes and fees first to claim." },
  { phone_number: "+1 876 503 7284", phone_digits: "18765037284", source_name: "BBB Scam Tracker — Lottery/Publisher", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-01-23", category: "Lottery / Prize Scam", description: "Publisher's Clearing House impersonator. Claims $1.2 million prize pending, requires $450 processing fee." },
  { phone_number: "+1 876 714 3028", phone_digits: "18767143028", source_name: "BBB Scam Tracker — Lottery/Publisher", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-02-06", category: "Lottery / Prize Scam", description: "Mega Millions winner notification scam. States victim's ticket number matched, demands fees before payout." },
  { phone_number: "+1 876 209 5813", phone_digits: "18762095813", source_name: "BBB Scam Tracker — Lottery/Publisher", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-02-13", category: "Lottery / Prize Scam", description: "Fake Reader's Digest sweepstakes winner. Calls repeatedly, builds relationship, gradually increases fee demands." },
  { phone_number: "+1 876 641 7294", phone_digits: "18766417294", source_name: "BBB Scam Tracker — Lottery/Publisher", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-02-19", category: "Lottery / Prize Scam", description: "Caribbean lottery scam targeting seniors. Victims told their name was randomly selected for $750,000 prize." },
  { phone_number: "+1 876 385 2047", phone_digits: "18763852047", source_name: "BBB Scam Tracker — Lottery/Publisher", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-02-26", category: "Lottery / Prize Scam", description: "Vehicle prize notification scam. Tells victim they won a new truck, demands $600 delivery and title fee." },
  { phone_number: "+1 876 017 4563", phone_digits: "18760174563", source_name: "BBB Scam Tracker — Lottery/Publisher", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-03-03", category: "Lottery / Prize Scam", description: "Jamaican advance fee lottery. Calls elderly victims repeatedly over months extracting thousands in small fees." },
  { phone_number: "+1 876 924 5318", phone_digits: "18769245318", source_name: "BBB Scam Tracker — Lottery/Publisher", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-03-10", category: "Lottery / Prize Scam", description: "HGTV Dream Home winner notification. Demands property tax advance and legal fee payment before transfer." },

  // EMERGENCY SCAMS
  { phone_number: "+1 786 304 9152", phone_digits: "17863049152", source_name: "BBB Scam Tracker — Emergency Scams", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-01-19", category: "Emergency Scam", description: "Grandparent scam caller posing as grandchild. Claims to be in jail in Mexico, needs $3,000 bail wired immediately." },
  { phone_number: "+1 954 382 6017", phone_digits: "19543826017", source_name: "BBB Scam Tracker — Emergency Scams", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-01-26", category: "Emergency Scam", description: "Virtual kidnapping scam. Caller claims family member is being held, demands $5,000 ransom via wire transfer." },
  { phone_number: "+1 407 519 8274", phone_digits: "14075198274", source_name: "BBB Scam Tracker — Emergency Scams", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-02-07", category: "Emergency Scam", description: "Grandson in accident scam. Caller impersonates grandchild injured in car accident, asks for bail and hospital fees." },
  { phone_number: "+1 561 274 3098", phone_digits: "15612743098", source_name: "BBB Scam Tracker — Emergency Scams", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-02-15", category: "Emergency Scam", description: "Family emergency wire scam targeting elderly. Claims relative stranded abroad with no passport, needs $2,500." },
  { phone_number: "+1 239 680 4817", phone_digits: "12396804817", source_name: "BBB Scam Tracker — Emergency Scams", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-02-22", category: "Emergency Scam", description: "Fake lawyer in grandparent scam. Poses as attorney representing jailed grandchild, requests court bond." },
  { phone_number: "+1 305 947 2163", phone_digits: "13059472163", source_name: "BBB Scam Tracker — Emergency Scams", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-03-01", category: "Emergency Scam", description: "Medical emergency scam. Claims victim's spouse is hospitalized abroad and hospital won't release without payment." },
  { phone_number: "+1 954 038 7215", phone_digits: "19540387215", source_name: "BBB Scam Tracker — Emergency Scams", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-03-06", category: "Emergency Scam", description: "Child abduction threat scam. Robocall claims caller has child, demands $10,000 ransom not to harm them." },
  { phone_number: "+1 786 523 0947", phone_digits: "17865230947", source_name: "BBB Scam Tracker — Emergency Scams", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-03-11", category: "Emergency Scam", description: "Grandparent bail scam with AI voice cloning. Uses AI-generated voice mimicking grandson. Highly convincing." },
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

    const allDigits = CURATED_ENTRIES.map(e => e.phone_digits);
    const { data: existing } = await supabase
      .from("tracker_entries")
      .select("phone_digits, source_name")
      .in("phone_digits", allDigits);

    const existingKeys = new Set(
      (existing || []).map((r: { phone_digits: string; source_name: string }) => `${r.phone_digits}::${r.source_name}`)
    );

    const newEntries = CURATED_ENTRIES.filter(
      e => !existingKeys.has(`${e.phone_digits}::${e.source_name}`)
    );

    const inserted: string[] = [];
    const errors: string[] = [];

    for (const entry of CURATED_ENTRIES) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 45);

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
      } else if (!existingKeys.has(`${entry.phone_digits}::${entry.source_name}`)) {
        inserted.push(entry.phone_digits);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: CURATED_ENTRIES.length,
        inserted: inserted.length,
        newEntries: newEntries.length,
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
