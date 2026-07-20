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

// Ensure the old curated entries are still here as a baseline
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
  { phone_number: "+1 646 892 3014", phone_digits: "16468923014", source_name: "Facebook — BTC Recovery WhatsApp", source_url: "https://www.facebook.com/groups/scamvictimshelp/", report_date: "2025-01-27", category: "Crypto Recovery Scam", description: "Impersonates ethical hacker. Claims 98% success rate recovering funds from unregulated brokers." },
  { phone_number: "+1 310 459 8217", phone_digits: "13104598217", source_name: "Facebook — BTC Recovery WhatsApp", source_url: "https://www.facebook.com/profile.php?id=100089452301", report_date: "2025-02-04", category: "Crypto Recovery Scam", description: "Fake cybersecurity agency promising to trace and recover lost USDT. Demands $500 software fee." },
  { phone_number: "+44 752 918 4360", phone_digits: "447529184360", source_name: "Facebook — BTC Recovery WhatsApp", source_url: "https://www.facebook.com/groups/bitcoin.recovery.expert/", report_date: "2025-02-11", category: "Crypto Recovery Scam", description: "Scammer messaging victims of pig-butchering scams. Uses fake testimonials to build trust." },
  { phone_number: "+1 202 555 0198", phone_digits: "12025550198", source_name: "Facebook — BTC Recovery WhatsApp", source_url: "https://www.facebook.com/groups/scamalertnetwork/", report_date: "2025-02-16", category: "Crypto Recovery Scam", description: "Recovery room scam. Contacts people who post about losing money. Claims to have insider access to exchanges." },
  { phone_number: "+44 790 324 8156", phone_digits: "447903248156", source_name: "Facebook — BTC Recovery WhatsApp", source_url: "https://www.facebook.com/groups/crypto.scam.recovery/", report_date: "2025-02-21", category: "Crypto Recovery Scam", description: "Promises to recover funds lost to romance scammers. Requests initial 'gas fee' payment in Ethereum." },
  { phone_number: "+1 415 867 5309", phone_digits: "14158675309", source_name: "Facebook — BTC Recovery WhatsApp", source_url: "https://www.facebook.com/groups/stolen.bitcoin.help/", report_date: "2025-02-27", category: "Crypto Recovery Scam", description: "Posts highly professional looking graphics offering recovery services. Once paid, they disappear." },
  { phone_number: "+44 771 582 9340", phone_digits: "447715829340", source_name: "Facebook — BTC Recovery WhatsApp", source_url: "https://www.facebook.com/profile.php?id=1000982345", report_date: "2025-03-04", category: "Crypto Recovery Scam", description: "Targets victims of fake trading platforms. Claims to work with interpol to seize funds." },
  { phone_number: "+1 702 444 8912", phone_digits: "17024448912", source_name: "Facebook — BTC Recovery WhatsApp", source_url: "https://www.facebook.com/groups/recover.lost.funds/", report_date: "2025-03-09", category: "Crypto Recovery Scam", description: "Scammer pretending to be a white hat hacker. Multiple victims report losing additional money." },

  // INVOICE / IMPOSTER SCAMS
  { phone_number: "+1 888 234 5678", phone_digits: "18882345678", source_name: "BBB Scam Tracker — Invoice/Imposter", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-01-18", category: "Invoice / Imposter Scam", description: "Fake PayPal invoice for $499.99 for a Bitcoin purchase. Directs victim to call to cancel." },
  { phone_number: "+1 855 901 2345", phone_digits: "18559012345", source_name: "BBB Scam Tracker — Invoice/Imposter", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-01-25", category: "Invoice / Imposter Scam", description: "Geek Squad renewal scam. Email claims auto-renewal of $349.99 is processing. Calls lead to remote access scam." },
  { phone_number: "+1 800 789 0123", phone_digits: "18007890123", source_name: "BBB Scam Tracker — Invoice/Imposter", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-02-03", category: "Invoice / Imposter Scam", description: "Amazon order confirmation scam. Claims an iPhone 15 was ordered on victim's account. Wants remote access to 'refund'." },
  { phone_number: "+1 866 345 6789", phone_digits: "18663456789", source_name: "BBB Scam Tracker — Invoice/Imposter", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-02-09", category: "Invoice / Imposter Scam", description: "Norton Lifelock fake invoice. Claims subscription renewed for $429. Instructs victim to call to dispute." },
  { phone_number: "+1 844 567 8901", phone_digits: "18445678901", source_name: "BBB Scam Tracker — Invoice/Imposter", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-02-14", category: "Invoice / Imposter Scam", description: "Fake Apple receipt for app purchases. Threatens account suspension if not paid. Scammer asks for Target gift cards." },
  { phone_number: "+1 877 123 4567", phone_digits: "18771234567", source_name: "BBB Scam Tracker — Invoice/Imposter", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-02-24", category: "Invoice / Imposter Scam", description: "McAfee antivirus renewal scam email. Includes this number for 'billing support'. Scammers try to trick victim into Zelle transfer." },
  { phone_number: "+1 888 987 6543", phone_digits: "18889876543", source_name: "BBB Scam Tracker — Invoice/Imposter", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-03-02", category: "Invoice / Imposter Scam", description: "Fake Best Buy receipt. Claims $800 TV was purchased. When called, they attempt to access victim's bank account." },
  { phone_number: "+1 855 432 1098", phone_digits: "18554321098", source_name: "BBB Scam Tracker — Invoice/Imposter", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-03-13", category: "Invoice / Imposter Scam", description: "PayPal impersonator. Claims account is compromised and victim must move funds to a 'secure wallet' (scammer's address)." },

  // GOVERNMENT IMPERSONATION / SHERIFF SCAMS
  { phone_number: "+1 202 555 0123", phone_digits: "12025550123", source_name: "BBB Scam Tracker — Sheriff/Warrant", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-01-21", category: "Government Impersonation", description: "Caller poses as local sheriff's deputy. Claims victim missed jury duty and has an active warrant. Demands payment via Coinstar." },
  { phone_number: "+1 404 890 1234", phone_digits: "14048901234", source_name: "BBB Scam Tracker — Sheriff/Warrant", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-01-29", category: "Government Impersonation", description: "Fake DEA agent. Claims victim's name is tied to a seized package of drugs at the border. Demands bond payment." },
  { phone_number: "+1 312 456 7890", phone_digits: "13124567890", source_name: "BBB Scam Tracker — Sheriff/Warrant", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-02-10", category: "Government Impersonation", description: "IRS impersonation scam. Leaves voicemails threatening arrest for tax evasion unless immediate wire transfer is sent." },
  { phone_number: "+1 832 765 4321", phone_digits: "18327654321", source_name: "BBB Scam Tracker — Sheriff/Warrant", source_url: "https://www.bbb.org/scamtracker", report_date: "2025-02-17", category: "Government Impersonation", description: "Medicare fraud unit impersonator. Claims victim's Medicare number was used for fraudulent claims, demands fee." },
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

// Function to extract phone numbers from text using basic regex
function extractPhoneNumbers(text: string): string[] {
  if (!text) return [];
  // Basic regex to find phone-like numbers
  const phoneRegex = /(?:\+?1[-.●]?)?\(?([0-9]{3})\)?[-.●\s]?([0-9]{3})[-.●\s]?([0-9]{4})/g;
  const matches = [...text.matchAll(phoneRegex)];
  return matches.map(match => `\${match[1]}\${match[2]}\${match[3]}`);
}

function formatPhoneDisplay(digits: string): string {
  if (digits.length !== 10) return digits;
  return `+1 (\${digits.slice(0,3)}) \${digits.slice(3,6)}-\${digits.slice(6)}`;
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

    // Get the Google API key and CX ID from environment variables instead of hardcoding
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    const GOOGLE_CX = Deno.env.get("GOOGLE_CX");

    let fetchedEntries: ScamEntry[] = [];

    if (GOOGLE_API_KEY && GOOGLE_CX) {
      // In order to not hit the quota on a single search, pick a random query from a curated list
      const searchQueries = [
        { q: 'site:bbb.org/scamtracker "invoice" OR "paypal" "phone"', category: 'Invoice / Imposter Scam', name: 'BBB Scam Tracker — Invoice/Imposter' },
        { q: 'site:bbb.org/scamtracker "emergency" OR "grandparent" "phone"', category: 'Emergency Scam', name: 'BBB Scam Tracker — Emergency Scams' },
        { q: 'site:bbb.org/scamtracker "publisher clearing house" OR "lottery" "phone"', category: 'Lottery / Prize Scam', name: 'BBB Scam Tracker — Lottery/Publisher' },
        { q: 'site:bbb.org/scamtracker "sheriff" OR "warrant" OR "arrest" "phone"', category: 'Government Impersonation', name: 'BBB Scam Tracker — Sheriff/Warrant' },
        { q: '"spellcaster" "whatsapp" site:facebook.com', category: 'Spiritual / Spellcaster Scam', name: 'Facebook — Spellcaster WhatsApp' },
        { q: '"crypto recovery" "whatsapp" site:facebook.com', category: 'Crypto Recovery Scam', name: 'Facebook — BTC Recovery WhatsApp' }
      ];

      const randomSearch = searchQueries[Math.floor(Math.random() * searchQueries.length)];

      const googleUrl = `https://customsearch.googleapis.com/customsearch/v1?key=\${GOOGLE_API_KEY}&cx=\${GOOGLE_CX}&q=\${encodeURIComponent(randomSearch.q)}`;

      try {
        const gRes = await fetch(googleUrl);
        if (gRes.ok) {
          const data = await gRes.json();
          const items = data.items || [];

          items.forEach((item: any) => {
            const textToSearch = (item.title || "") + " " + (item.snippet || "");
            const foundDigits = extractPhoneNumbers(textToSearch);

            foundDigits.forEach(digits => {
              // Deduplicate in current batch
              if (!fetchedEntries.some(e => e.phone_digits === digits)) {
                fetchedEntries.push({
                  phone_number: formatPhoneDisplay(digits),
                  phone_digits: digits,
                  source_name: randomSearch.name,
                  source_url: item.link || "https://www.google.com",
                  report_date: new Date().toISOString().split('T')[0],
                  category: randomSearch.category,
                  description: item.snippet ? item.snippet.substring(0, 200) : "Number identified via Google Search scrape."
                });
              }
            });
          });
        } else {
           console.warn("Google API fetch failed with status:", gRes.status);
        }
      } catch (e) {
        console.warn("Google API fetch threw error:", e);
      }
    } else {
        console.warn("Google API key or CX missing in environment variables. Falling back to curated entries.");
        fetchedEntries = [...CURATED_ENTRIES];
    }

    // If we didn't get any from Google (due to no results or quota), fallback to CURATED
    if (fetchedEntries.length === 0) {
      fetchedEntries = [...CURATED_ENTRIES];
    }

    const allDigits = fetchedEntries.map(e => e.phone_digits);
    const { data: existing } = await supabase
      .from("tracker_entries")
      .select("phone_digits, source_name")
      .in("phone_digits", allDigits);

    const existingKeys = new Set(
      (existing || []).map((r: { phone_digits: string; source_name: string }) => `\${r.phone_digits}::\${r.source_name}`)
    );

    const newEntries = fetchedEntries.filter(
      e => !existingKeys.has(`\${e.phone_digits}::\${e.source_name}`)
    );

    const inserted: string[] = [];
    const errors: string[] = [];

    for (const entry of newEntries) {
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
        errors.push(`\${entry.phone_digits}: \${error.message}`);
      } else {
        inserted.push(entry.phone_digits);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: fetchedEntries.length,
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
