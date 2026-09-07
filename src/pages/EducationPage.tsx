import React, { useState, useRef } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, Phone, Mail, ShoppingBag, Heart, Cpu, DollarSign, ExternalLink, Shield, Eye, Zap, UserX, X, ZoomIn, ZoomOut, RotateCcw, Maximize2, ChevronLeft, ChevronRight, TrendingUp, Search, MonitorPlay } from 'lucide-react';
import { useFtcStats } from '../hooks/useFtcStats';
import Banner from '../components/Banner';

const SCAM_TYPES = [
  {
    num: '01',
    id: 'phone',
    icon: Phone,
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
    title: 'Phone & Robocall Scams',
    subtitle: 'Government, Law Enforcement & Toll Imposters',
    summary: 'Unsolicited calls and texts from fake government agencies, banks, or toll operators pressuring immediate payment or sensitive information.',
    warningSigns: [
      'Caller or text claims to be IRS, SSA, Medicare, law enforcement, or FasTrak / toll agency',
      'Demands immediate payment via gift card, wire transfer, or cryptocurrency',
      'Threatens arrest, driver license suspension, lawsuit, or bank account closure',
      'Caller ID shows a government or bank number (easily spoofed using VoIP services)',
      'Text includes a link to a lookalike website  that site exists solely to steal credentials',
      'Asks you to "press 1" or call back a specific unverified toll-free number',
    ],
    whatToDo: [
      'Hang up immediately or delete the text message  do NOT click any embedded links',
      'Never call back phone numbers left in suspicious voicemails or texts',
      'Look up the agency\'s official phone number independently on their official .gov site',
      'Report federal fraud attempts at ReportFraud.ftc.gov',
      'Register on the National Do Not Call Registry at donotcall.gov',
    ],
    resource: { label: 'FTC: Dealing with Unwanted Calls', url: 'https://consumer.ftc.gov/articles/dealing-unwanted-calls' },
    images: [
      { src: '/images/Toll_Road_Scam_Text.png', label: 'CA FasTrak Toll Road Scam Text', caption: 'Real toll road scam text message claiming a fake "CA FasTrak Final Notice" from a spoofed number. The embedded link leads to a phishing site designed to capture payment credentials.', objectFit: 'contain' as const },
    ],
  },
  {
    num: '02',
    id: 'invoice',
    icon: DollarSign,
    color: 'text-red-500',
    bg: 'bg-red-500/10',
    title: 'Invoice & Imposter Scams',
    summary: 'Fake invoices from Amazon, Apple, PayPal, Geek Squad, or Norton tricking you into calling fraudulent support numbers.',
    warningSigns: [
      'Unexpected email or text notification regarding a large pending charge or subscription renewal',
      'Urgent request to call a phone number immediately to cancel or dispute the charge',
      'Sender email address domain does not match the official company domain',
      'Grammatical errors, generic salutations ("Dear Customer"), or suspicious PDF attachments',
      'Callers demand remote desktop access to "process your refund"',
    ],
    whatToDo: [
      'Log into your official account directly through your web browser  never via email links',
      'Call the company\'s official support telephone number listed on their main website',
      'Report suspicious billing emails to the official company abuse address and reportphishing@apwg.org',
      'Never give remote control of your computer or phone to anyone who contacts you unsolicited',
    ],
    resource: { label: 'FTC: Imposter Scams & Alerts', url: 'https://consumer.ftc.gov/features/scam-alerts' },
    images: [
      { src: '/images/Invoice.png', label: 'Fake PayPal Bitcoin Invoice', caption: 'Fake PayPal billing invoice with fraudulent order ID, Bitcoin purchase details, and auto-debit threat. The toll-free number connects directly to a scammer call center.' },
      { src: '/images/fake_invoice.png', label: 'Fake Billing Email Notice', caption: 'Example of a fake PayPal invoice scam email designed to induce urgency and panic so victims dial the scammer phone number.' },
    ],
  },
  {
    num: '03',
    id: 'tech',
    icon: Cpu,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    title: 'Tech Support & Malware Scams',
    summary: 'Browser pop-ups, alarming text alerts, or voicemails claiming your computer is infected with viruses or compromised.',
    warningSigns: [
      'Full-screen browser pop-ups with loud warning sounds and a fake Microsoft or Apple hotline',
      'SMS alerts or voicemails claiming unauthorized high-dollar purchases on your account',
      'Callers claiming to be security specialists from Microsoft, Apple, Amazon, or your ISP',
      'Demands to download remote desktop software such as AnyDesk, TeamViewer, or UltraViewer',
      'Requests for payment using gift cards or wire transfers to pay for "system security repairs"',
    ],
    whatToDo: [
      'Force close your web browser (Alt+F4 or Cmd+Option+Esc)  do NOT call the displayed number',
      'Never grant remote access to your computer or mobile phone to unsolicited callers',
      'If concerned about your account, contact the company directly using their official website contact page',
      'Report tech support scams at ReportFraud.ftc.gov',
    ],
    resource: { label: 'FTC: How to Spot Tech Support Scams', url: 'https://consumer.ftc.gov/articles/tech-support-scams' },
    images: [
      { src: '/images/Fake_Text.jpg', label: 'Tech Support Confirmations', caption: 'Tech support scam text messages showing fake order confirmations from Norton, Apple, and Amazon with direct callback lines. Delete immediately.', objectFit: 'contain' as const },
    ],
  },
  {
    num: '04',
    id: 'lottery',
    icon: Zap,
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10',
    title: 'Lottery, Prize & Sweepstakes Scams',
    summary: 'You are informed you have won a major lottery or prize, but must pay taxes, shipping, or clearance fees upfront.',
    warningSigns: [
      'Claims that you won a sweepstakes, lottery, or giveaway you never entered',
      'Requirement to pay upfront fees, processing charges, or taxes before receiving winnings',
      'Payment demanded via PayPal, Zelle, Cash App, Apple Pay, wire transfer, or in-store cash barcodes',
      'Notifications received via phone call, text, social media DM, or standard mail',
      'Instructions to keep your winnings secret from family members or bank tellers',
    ],
    whatToDo: [
      'Legitimate lotteries and sweepstakes NEVER require winners to pay money upfront  no exceptions',
      'Never send funds via peer-to-peer payment apps, wire transfer, or gift cards to claim prizes',
      'Never generate or present a Walmart MoneyCard or CVS deposit barcode to cashiers for strangers',
      'Publishers Clearing House notifies major prize winners in person or by certified mail',
      'Report prize fraud at ReportFraud.ftc.gov',
    ],
    resource: { label: 'FTC: Prize & Lottery Scams', url: 'https://consumer.ftc.gov/articles/prize-sweepstakes-lottery-scams' },
    images: [
      { src: '/images/Paypal_Request.png', label: 'Fake PayPal Money Request', caption: 'Fraudulent PayPal money request where scammers impersonate "Apple Inc.". The real PayPal interface is abused to trick users into approving payments.' },
      { src: '/images/Walmart_Barcode.jpeg', label: 'Walmart Deposit Barcode', caption: 'Walmart Money Services barcode. Scammers instruct victims to present this code to store cashiers to deposit cash directly into scammer accounts. Never show cash barcodes to cashiers for anyone else.' },
    ],
  },
  {
    num: '05',
    id: 'romance',
    icon: Heart,
    color: 'text-pink-500',
    bg: 'bg-pink-500/10',
    title: 'Romance & Catfishing Scams',
    summary: 'Fake online romantic partners spend weeks or months building emotional intimacy before concocting financial emergencies or investment traps.',
    warningSigns: [
      'Met online via dating apps or social media; relationship develops intensely and rapidly',
      'Claims to work overseas  military deployment, offshore oil rig, international doctor',
      'Always has excuses for why they cannot video chat or meet face-to-face',
      'Requests emergency financial assistance for travel, medical emergencies, or crypto investments',
      'Profile pictures appear professionally polished or match stolen images online',
    ],
    whatToDo: [
      'Perform a reverse image search on profile photos using Google Lens, TinEye, or Yandex',
      'Never send money, cryptocurrency, or banking details to anyone you have not met in person',
      'Discuss the online relationship with a trusted friend, family member, or legal advocate',
      'Report romance fraud to the FTC and the specific dating platform or social network',
    ],
    resource: { label: 'FTC: Romance Scam Education', url: 'https://consumer.ftc.gov/articles/what-you-need-know-about-romance-scams' },
    images: [],
  },
  {
    num: '06',
    id: 'spiritual',
    icon: Eye,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    title: 'Spellcaster & Spiritual Scams',
    summary: 'Fraudulent psychics, spell casters, and spiritual healers on social media claiming to solve personal problems for exorbitant fees.',
    warningSigns: [
      'Claims to cast spells to restore lost relationships, grant financial prosperity, or remove curses',
      'Initial contact made through unsolicited Instagram, Facebook, or WhatsApp private messages',
      'Demands escalating payments for "stronger ingredients", special rituals, or candle ceremonies',
      'Uses staged photographs with fake currency, candles, or mystical props',
      'Guarantees 100% success or threatens bad fortune if payments cease',
    ],
    whatToDo: [
      'Understand that no individual can control events or guarantee outcomes through spells',
      'Immediately block and report scam profiles on social media platforms',
      'Refuse to send gift cards, wire transfers, or cryptocurrency to online spiritual accounts',
      'Report deceptive commercial practices at ReportFraud.ftc.gov',
    ],
    resource: { label: 'FTC: Psychic & Fortune Teller Scams', url: 'https://consumer.ftc.gov/articles/psychics-astrologers-and-crystal-ball-readers' },
    images: [
      { src: '/images/Fake_Money_With_Candles.jpeg', label: 'Staged Ritual Ad Photo', caption: 'Staged ritual imagery containing fake money and candles used in social media spellcaster advertisements to engineer false authenticity and trust.' },
      { src: '/images/Stupid Spell Stuff 2.jpeg', label: 'Spiritual Scam Example', caption: 'Another example of staged mystical props used by social media scammers to deceive victims into sending money for fake spiritual services.' },
    ],
  },
  {
    num: '07',
    id: 'shopping',
    icon: ShoppingBag,
    color: 'text-teal-500',
    bg: 'bg-teal-500/10',
    title: 'Online Shopping & Store Scams',
    summary: 'Fake e-commerce storefronts, counterfeit goods, and social media ad sellers that process payments but deliver nothing.',
    warningSigns: [
      'E-commerce site features unrealistically low prices on high-demand merchandise',
      'Domain name registered recently; missing physical address, customer support line, or terms page',
      'Checkout payment options restricted to non-refundable methods (Zelle, Cash App, Wire, Crypto)',
      'Sellers on social media platforms push to move communication and payment off-platform',
      'Product images are generic stock photos copied from major retailers',
    ],
    whatToDo: [
      'Research new online stores on Trustpilot, BBB, and Google Reviews prior to making purchases',
      'Always use a credit card for online purchases to preserve purchase protection and chargeback rights',
      'Avoid sellers who insist on non-protected peer-to-peer payment methods',
      'Report fraudulent storefronts to the FTC and the domain host',
    ],
    resource: { label: 'FTC: Online Shopping Safety', url: 'https://consumer.ftc.gov/articles/shopping-safely-online' },
    images: [],
  },
  {
    num: '08',
    id: 'phishing',
    icon: Mail,
    color: 'text-cyan-500',
    bg: 'bg-cyan-500/10',
    title: 'Phishing & Smishing Attacks',
    summary: 'Deceptive emails (phishing) and SMS text messages (smishing) attempting to harvest passwords, SSNs, or credit card numbers.',
    warningSigns: [
      'Urgent alerts regarding account suspension, security breaches, or failed parcel deliveries',
      'Hyperlink URLs do not match the official legitimate company domain',
      'Spelling errors, weird capitalization, or awkward phrasing',
      'Direct requests to confirm sensitive credentials, Social Security Numbers, or 2FA codes',
      'Unsolicited attachments or links promising account refunds',
    ],
    whatToDo: [
      'Never click links or open attachments in unexpected emails or text messages',
      'Navigate to services directly by manually typing official web addresses into your browser address bar',
      'Forward phishing emails to the Anti-Phishing Working Group at reportphishing@apwg.org',
      'Forward spam and scam text messages to 7726 (SPAM)',
    ],
    resource: { label: 'FTC: Recognizing Phishing Scams', url: 'https://consumer.ftc.gov/articles/how-recognize-and-avoid-phishing-scams' },
    images: [
      { src: '/images/phishing_email.png', label: 'Cloud Storage Phishing Email', caption: 'Real phishing email example showing a fake urgent cloud storage notice claiming files will be deleted to pressure victims into clicking malicious links.' },
    ],
  },
];

const EMERGENCY_RESOURCES = [
  { label: 'FTC  Report Fraud', url: 'https://reportfraud.ftc.gov/', desc: 'File a federal consumer fraud complaint' },
  { label: 'FBI IC3 (Internet Crime Complaint Center)', url: 'https://www.ic3.gov', desc: 'Report cybercrime, phishing, and financial scams' },
  { label: 'IdentityTheft.gov', url: 'https://www.identitytheft.gov', desc: 'Personalized identity theft recovery plans' },
  { label: 'BBB Scam Tracker', url: 'https://www.bbb.org/scamtracker', desc: 'Look up and report local scam occurrences' },
  { label: 'AARP Fraud Watch Network', url: 'https://www.aarp.org/money/scams-fraud/', desc: 'Free fraud helpline and prevention guides' },
  { label: 'National Elder Fraud Hotline', url: 'https://ovc.ojp.gov/program/stop-elder-fraud/introduction', desc: 'Call 1-833-FRAUD-11 for elder support' },
];

const GIFT_CARD_GALLERY = [
  { src: '/images/Gift_Card_Rack.jpg', label: 'In-Store Gift Card Display Rack', caption: 'A full gift card rack in a retail store. Scammers send victims here to buy untraceable payment cards. If anyone orders you to buy gift cards over the phone, stop immediately.' },
  { src: '/images/Amazon_Gift_Cards.jpg', label: 'Amazon Gift Cards', caption: 'Amazon Gift Cards ($10-$500). Scammers target these due to wide retail availability and rapid electronic code redemption.' },
  { src: '/images/steam-gc.png', label: 'Steam Digital Cards', caption: 'Steam Gift Cards. Frequently requested in online scams targeting gamers and younger adults. Codes are resold instantly.' },
  { src: '/images/Greendot_Moneypak.jpg', label: 'Green Dot MoneyPak', caption: 'Green Dot reloadable cards and MoneyPak. The code on the reverse side is all a scammer needs to drain funds permanently.' },
  { src: '/images/Apple_Gift_Cards.jpg', label: 'Apple Gift Cards', caption: 'Apple Gift Cards. Demanded heavily by tech support imposters pretending to represent Apple, the IRS, or Social Security.' },
  { src: '/images/Credit_Card_Gift_Cards.jpg', label: 'Prepaid Visa / Mastercard / Amex', caption: 'Prepaid credit card gift cards (Visa, Mastercard, Amex). Untraceable like cash once activated and spent.' },
  { src: '/images/Google_Play_Cards.jpg', label: 'Google Play Cards', caption: 'Google Play Gift Cards. Commonly demanded in prize scams, utility cutoff threats, and romance fraud.' },
];

export default function EducationPage() {
  const { stats } = useFtcStats();
  const [lightbox, setLightbox] = useState<{ src: string; caption: string; label?: string } | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const openLightbox = (src: string, caption: string, label?: string) => {
    setLightbox({ src, caption, label });
    setZoomLevel(1);
  };
  const closeLightbox = () => {
    setLightbox(null);
    setZoomLevel(1);
  };

  const openGallery = (index = 0) => {
    setGalleryIndex(index);
    setZoomLevel(1);
  };
  const closeGallery = () => {
    setGalleryIndex(null);
    setZoomLevel(1);
  };

  const galleryPrev = () => {
    setGalleryIndex(i => i === null ? 0 : (i - 1 + GIFT_CARD_GALLERY.length) % GIFT_CARD_GALLERY.length);
    setZoomLevel(1);
  };

  const galleryNext = () => {
    setGalleryIndex(i => i === null ? 0 : (i + 1) % GIFT_CARD_GALLERY.length);
    setZoomLevel(1);
  };

  const scrollToSection = (id: string) => {
    const el = sectionRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200 pb-20 text-slate-800 dark:text-slate-200">
      <Banner
        variant="info"
        id="education_tip"
        dismissible
        message={<span><strong>Educational Tip:</strong> Knowledge is your best defense against scammers. Review the evidence, images, and warning signs below.</span>}
      />

      {/* Full Size Interactive Lightbox Modal */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-between p-4 sm:p-6 animate-fade-in backdrop-blur-md"
          onClick={closeLightbox}
        >
          {/* Top Bar */}
          <div className="w-full max-w-6xl flex items-center justify-between text-white py-2 z-10" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-brand-400 bg-brand-500/20 px-3 py-1 rounded-full border border-brand-500/30">
                {lightbox.label || 'Full Size High Resolution Inspection'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoomLevel(z => Math.max(0.75, z - 0.25))}
                className="p-2 bg-slate-800/80 hover:bg-slate-700 rounded-lg text-white transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
              <span className="text-xs font-mono text-slate-300 w-12 text-center">{Math.round(zoomLevel * 100)}%</span>
              <button
                onClick={() => setZoomLevel(z => Math.min(3, z + 0.25))}
                className="p-2 bg-slate-800/80 hover:bg-slate-700 rounded-lg text-white transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
              <button
                onClick={() => setZoomLevel(1)}
                className="p-2 bg-slate-800/80 hover:bg-slate-700 rounded-lg text-white transition-colors"
                title="Reset Zoom"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
              <button
                onClick={closeLightbox}
                className="p-2 bg-red-600/80 hover:bg-red-600 rounded-lg text-white transition-colors ml-2 flex items-center gap-1 text-sm font-bold px-3"
              >
                <X className="w-5 h-5" />
                <span className="hidden sm:inline">Close</span>
              </button>
            </div>
          </div>

          {/* Main Image Viewport */}
          <div
            className="flex-1 w-full max-w-6xl flex items-center justify-center overflow-auto p-2 relative my-2"
            onClick={e => e.stopPropagation()}
          >
            <div
              className="transition-transform duration-200 ease-out flex items-center justify-center max-h-full"
              style={{ transform: `scale(${zoomLevel})` }}
            >
              <img
                src={lightbox.src}
                alt={lightbox.caption}
                className="max-h-[75vh] w-auto max-w-full object-contain rounded-xl shadow-2xl border border-slate-700/50"
              />
            </div>
          </div>

          {/* Bottom Caption */}
          <div className="w-full max-w-4xl text-center bg-slate-900/90 border border-slate-800 rounded-xl p-4 text-white/90 text-sm sm:text-base z-10" onClick={e => e.stopPropagation()}>
            <p className="font-medium">{lightbox.caption}</p>
          </div>
        </div>
      )}

      {/* Gift Card Gallery Lightbox */}
      {galleryIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-between p-4 sm:p-6 animate-fade-in backdrop-blur-md"
          onClick={closeGallery}
        >
          <div className="w-full max-w-6xl flex items-center justify-between text-white py-2 z-10" onClick={e => e.stopPropagation()}>
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-amber-400 bg-amber-500/20 px-3 py-1 rounded-full border border-amber-500/30">
              Gift Card Gallery ({galleryIndex + 1} / {GIFT_CARD_GALLERY.length})
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={closeGallery}
                className="p-2 bg-red-600/80 hover:bg-red-600 rounded-lg text-white transition-colors flex items-center gap-1 text-sm font-bold px-3"
              >
                <X className="w-5 h-5" />
                <span>Close</span>
              </button>
            </div>
          </div>

          <div className="relative w-full max-w-5xl flex items-center justify-center flex-1 my-2" onClick={e => e.stopPropagation()}>
            <button
              onClick={galleryPrev}
              className="absolute left-2 sm:left-4 z-20 w-12 h-12 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-white transition-all shadow-lg"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <img
              src={GIFT_CARD_GALLERY[galleryIndex].src}
              alt={GIFT_CARD_GALLERY[galleryIndex].label}
              className="max-h-[65vh] w-auto max-w-full object-contain rounded-xl shadow-2xl border border-slate-800"
            />
            <button
              onClick={galleryNext}
              className="absolute right-2 sm:right-4 z-20 w-12 h-12 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-white transition-all shadow-lg"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          <div className="w-full max-w-4xl text-center bg-slate-900/90 border border-slate-800 rounded-xl p-4 text-white z-10" onClick={e => e.stopPropagation()}>
            <p className="font-bold text-amber-400 mb-1">{GIFT_CARD_GALLERY[galleryIndex].label}</p>
            <p className="text-xs sm:text-sm text-slate-300">{GIFT_CARD_GALLERY[galleryIndex].caption}</p>
            <div className="flex justify-center gap-2 mt-3 overflow-x-auto py-1">
              {GIFT_CARD_GALLERY.map((card, i) => (
                <button
                  key={card.src}
                  onClick={() => setGalleryIndex(i)}
                  className={`relative w-12 h-12 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${i === galleryIndex ? 'border-amber-400 scale-110 ring-2 ring-amber-400/50' : 'border-white/20 opacity-60 hover:opacity-100'}`}
                >
                  <img src={card.src} alt={card.label} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Hero Header - Inspired by Flite.bike */}
      <section className="relative pt-12 md:pt-20 pb-16 overflow-hidden border-b border-slate-200 dark:border-slate-800 bg-slate-900 text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-brand-950/40 opacity-90" />
        <div className="relative max-w-6xl mx-auto px-4 text-center">

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black mb-6 tracking-tight leading-tight text-white">
            Scam Education Center
          </h1>

          <p className="text-lg sm:text-xl md:text-2xl text-slate-300 max-w-3xl mx-auto mb-10 font-light leading-relaxed">
            Spot, inspect, and stop fraud before it happens. Click or tap any image to inspect evidence in full size.
          </p>

          {/* Quick Jump Category Menu (Horizontal Scroll on Mobile) */}
          <div className="flex items-center justify-start sm:justify-center gap-2 overflow-x-auto pb-4 pt-2 px-2 no-scrollbar">
            {SCAM_TYPES.map(scam => (
              <button
                key={scam.id}
                onClick={() => scrollToSection(scam.id)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 hover:bg-brand-600/80 text-xs sm:text-sm font-semibold text-slate-200 hover:text-white rounded-full border border-slate-700/80 transition-all whitespace-nowrap flex-shrink-0 shadow-sm"
              >
                <span>{scam.num}</span>
                <span>{scam.title.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 pt-10">

        {/* Local Sheriff Emergency Callout Banner */}
        <div className="mb-12 rounded-2xl border-2 border-amber-500/50 bg-amber-50 dark:bg-amber-950/40 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5 shadow-lg">
          <div className="flex-shrink-0 flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            <Phone className="w-7 h-7" />
          </div>
          <div className="flex-1">
            <p className="text-slate-900 dark:text-amber-100 font-extrabold text-lg leading-snug mb-1">
              Suspect a Scam? Contact Your Local Sheriff's Non-Emergency Line
            </p>
            <p className="text-slate-700 dark:text-amber-300/90 text-sm leading-relaxed">
              Deputies can verify suspicious calls, texts, or door-to-door interactions before you take action or send funds.
            </p>
          </div>
          <a
            href="https://search.brave.com/search?q=local+sheriff+non-emergency+line+near+me"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold transition-all shadow-md min-h-[48px]"
          >
            <Search className="w-4 h-4" />
            Find Your Local Sheriff
          </a>
        </div>

        {/* Quick Impact Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-14">
          <QuickStatCard icon={Shield} label={`Americans lost to fraud in ${stats.report_year}`} value={stats.total_loss_short} color="text-red-500" />
          <QuickStatCard icon={AlertTriangle} label="Reports filed with FTC" value={stats.total_reports_short} color="text-yellow-500" />
          <QuickStatCard icon={UserX} label="Identity theft victims" value={stats.identity_theft_victims} color="text-blue-500" />
        </div>

        {/* Trending Irreversible Payment Methods Section - Inspired by Flite.bike Showcase */}
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-red-500" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              Primary Scam Payment Vectors
            </h2>
          </div>
          <p className="text-slate-600 dark:text-slate-400 text-base mb-8 max-w-3xl">
            Scammers demand these specific payment methods because they bypass bank fraud protections and are untraceable once sent.
          </p>

          <div className="grid lg:grid-cols-2 gap-8">
            <GiftCardSection onGallery={openGallery} />
            <BitcoinATMSection onZoom={openLightbox} />
          </div>
        </div>

        {/* Main Numbered Scam Sections - Flite.bike Inspired Design */}
        <div className="space-y-12 mb-16">
          {SCAM_TYPES.map(scam => (
            <div
              key={scam.id}
              ref={el => { sectionRefs.current[scam.id] = el; }}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden transition-all duration-300 hover:border-brand-500/40"
            >
              {/* Section Header */}
              <div className="p-6 sm:p-8 bg-slate-100 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <span className="text-3xl sm:text-4xl font-black font-mono text-brand-500 opacity-80">{scam.num}</span>
                  <div>
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white leading-tight">
                      {scam.title}
                    </h3>
                    <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1 font-medium">
                      {scam.summary}
                    </p>
                  </div>
                </div>
                <a
                  href={scam.resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-brand-500 hover:text-brand-600 hover:underline flex-shrink-0 bg-brand-500/10 px-4 py-2 rounded-xl border border-brand-500/20"
                >
                  <ExternalLink className="w-4 h-4" />
                  {scam.resource.label}
                </a>
              </div>

              {/* Section Content Grid */}
              <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {/* Warning Signs */}
                <div>
                  <h4 className="font-extrabold text-red-500 dark:text-red-400 text-base mb-4 flex items-center gap-2 uppercase tracking-wide">
                    <AlertTriangle className="w-5 h-5" />
                    Warning Signs
                  </h4>
                  <ul className="space-y-3">
                    {scam.warningSigns.map((sign, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300 leading-snug">
                        <span className="w-2 h-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                        <span>{sign}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* What To Do */}
                <div>
                  <h4 className="font-extrabold text-green-600 dark:text-green-400 text-base mb-4 flex items-center gap-2 uppercase tracking-wide">
                    <Shield className="w-5 h-5" />
                    Action Steps
                  </h4>
                  <ul className="space-y-3">
                    {scam.whatToDo.map((action, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300 leading-snug">
                        <span className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Evidence Images */}
                <div className="lg:col-span-1 md:col-span-2">
                  <h4 className="font-extrabold text-slate-900 dark:text-white text-base mb-4 flex items-center gap-2 uppercase tracking-wide">
                    <Maximize2 className="w-5 h-5 text-brand-500" />
                    Real Evidence (Full Size View)
                  </h4>
                  {scam.images && scam.images.length > 0 ? (
                    <div className="space-y-4">
                      {scam.images.map((img, idx) => (
                        <div
                          key={idx}
                          onClick={() => openLightbox(img.src, img.caption, img.label)}
                          className="group relative cursor-pointer rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 hover:border-brand-500 transition-all duration-300 shadow-md"
                        >
                          <div className="h-48 sm:h-56 w-full relative overflow-hidden bg-slate-950 flex items-center justify-center p-2">
                            <img
                              src={img.src}
                              alt={img.label}
                              className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-slate-950/40 transition-colors flex items-center justify-center">
                              <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-brand-600 text-white font-bold text-xs px-4 py-2 rounded-full flex items-center gap-2 shadow-lg transform translate-y-2 group-hover:translate-y-0">
                                <ZoomIn className="w-4 h-4" /> Click to Inspect Full Size
                              </span>
                            </div>
                          </div>
                          <div className="p-3 bg-slate-900 text-white border-t border-slate-800">
                            <p className="text-xs font-bold text-brand-400 mb-0.5">{img.label}</p>
                            <p className="text-xs text-slate-300 line-clamp-2">{img.caption}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 bg-slate-100 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-slate-500 text-sm">
                      <p className="font-semibold mb-1">Digital Fraud Vector</p>
                      <p className="text-xs">Manipulative tactics rely on emotional isolation and direct off-platform communication.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Universal Scam Prevention Rules */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 mb-14 border border-slate-200 dark:border-slate-800 shadow-xl">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2 flex items-center gap-3">
            <Shield className="w-7 h-7 text-brand-500" />
            Universal Rules of Scam Prevention
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
            Memorize these fundamental rules to protect yourself against current and future scam variants:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              'Never pay with gift cards, wire transfers, Zelle, Cash App, or crypto for unexpected demands.',
              'Government agencies NEVER contact you first by phone or text demanding immediate cash or threats.',
              'Urgency ("act within 1 hour!") is always a psychological manipulation tactic designed to block reason.',
              'Legitimate businesses will NEVER request remote control access to your personal phone or computer.',
              'If an offer or prize seems unrealistically profitable or easy, it is guaranteed to be fraudulent.',
              'Verify unexpected bills or account locks by logging into the official service directly in your browser.',
              'Protect your SSN, banking passwords, and 2FA authentication codes with absolute secrecy.',
              'Always consult a trusted family member, neighbor, or sheriff before authorizing large transactions.',
            ].map((rule, i) => (
              <div key={i} className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60">
                <span className="w-7 h-7 rounded-full bg-brand-500/20 text-brand-500 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-snug">{rule}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Content Creator Field Guide Notice */}
        <div className="bg-gradient-to-r from-brand-900/40 via-slate-900 to-indigo-900/40 rounded-3xl p-8 mb-14 border border-brand-500/30 text-white shadow-xl">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-brand-500/20 text-brand-400 flex items-center justify-center flex-shrink-0 border border-brand-500/30">
              <MonitorPlay className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl font-black mb-1 text-white">Livestreamer & Content Creator Safety Guide</h2>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                Streamers face unique attack vectors including stream hijacking, fake sponsor contracts, and live extortion. Access our dedicated Livestreaming Field Guide to secure your channel.
              </p>
            </div>
          </div>
          <Link
            to="/stream-safety"
            className="inline-flex items-center gap-2 px-6 py-3.5 bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm rounded-xl transition-all shadow-lg min-h-[48px]"
          >
            <MonitorPlay className="w-5 h-5" />
            View Livestreamer Safety Guide
          </Link>
        </div>

        {/* Emergency Resources */}
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6 flex items-center gap-3">
            <ExternalLink className="w-7 h-7 text-brand-500" />
            Federal & Emergency Fraud Resources
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {EMERGENCY_RESOURCES.map(r => (
              <a
                key={r.label}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-brand-500 transition-all group shadow-md block"
              >
                <p className="font-extrabold text-slate-900 dark:text-white text-base group-hover:text-brand-500 transition-colors mb-1">{r.label}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">{r.desc}</p>
                <div className="flex items-center gap-1 text-xs text-brand-500 font-bold mt-3">
                  <span>Visit Resource</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </div>
              </a>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

function GiftCardSection({ onGallery }: { onGallery: (index?: number) => void }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl font-black font-mono text-red-500">01</span>
          <div>
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">Gift Cards</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Irreversible, untraceable, instant transfer</p>
          </div>
        </div>

        <div
          onClick={() => onGallery(0)}
          className="group relative cursor-pointer rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 mb-4 h-56 sm:h-64 shadow-md"
        >
          <img
            src="/images/Gift_Card_Rack.jpg"
            alt="Gift Card Display Rack"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent p-4 flex flex-col justify-between">
            <span className="self-end bg-red-600 text-white font-bold text-xs px-3 py-1 rounded-full shadow">
              High Risk Payment Method
            </span>
            <div className="flex items-center justify-between text-white">
              <span className="font-bold text-sm sm:text-base flex items-center gap-2">
                <ZoomIn className="w-4 h-4 text-amber-400" />
                Inspect Full Size Gift Card Gallery ({GIFT_CARD_GALLERY.length} Types)
              </span>
            </div>
          </div>
        </div>

        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
          No legitimate company or law enforcement agency will EVER require payment via gift cards. If someone instructs you to read numbers off the back of a gift card, it is 100% a scam.
        </p>
      </div>

      <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl p-4">
        <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wide mb-1">The Gift Card Rule</p>
        <p className="text-xs text-red-700 dark:text-red-300">
          Anyone demanding gift card payment over the phone is stealing from you. Stop and hang up.
        </p>
      </div>
    </div>
  );
}

function BitcoinATMSection({ onZoom }: { onZoom: (src: string, caption: string, label?: string) => void }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl font-black font-mono text-yellow-500">02</span>
          <div>
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">Bitcoin ATMs & Cryptocurrency</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Irreversible blockchain transactions</p>
          </div>
        </div>

        <div
          onClick={() => onZoom('/images/Bitcoin_ATM.jpeg', 'Bitcoin ATM kiosk located in a gas station. Scammers instruct victims to deposit cash and scan QR codes.', 'Bitcoin ATM Full View')}
          className="group relative cursor-pointer rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 mb-4 h-56 sm:h-64 shadow-md"
        >
          <img
            src="/images/Bitcoin_ATM.jpeg"
            alt="Bitcoin ATM"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent p-4 flex flex-col justify-between">
            <span className="self-end bg-yellow-600 text-white font-bold text-xs px-3 py-1 rounded-full shadow">
              Irreversible Crypto Vector
            </span>
            <div className="flex items-center justify-between text-white">
              <span className="font-bold text-sm sm:text-base flex items-center gap-2">
                <ZoomIn className="w-4 h-4 text-yellow-400" />
                Inspect Bitcoin ATM In Full Size
              </span>
            </div>
          </div>
        </div>

        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
          Scammers direct victims to local Bitcoin kiosks at gas stations or instruct them to send crypto from wallet apps using QR codes. Once sent on the blockchain, funds cannot be reversed by banks or police.
        </p>
      </div>

      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl p-4">
        <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-1">If Directed To A Bitcoin Kiosk</p>
        <p className="text-xs text-amber-800 dark:text-amber-300">
          Walk away from the machine. Call your local sheriff or trusted relative immediately.
        </p>
      </div>
    </div>
  );
}

function QuickStatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md text-center">
      <Icon className={`w-8 h-8 ${color} mx-auto mb-2`} />
      <div className="text-3xl font-black text-slate-900 dark:text-white">{value}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">{label}</div>
    </div>
  );
}
