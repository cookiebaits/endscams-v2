import React, { useState } from 'react';
import { Link } from 'react-router';
import { BookOpen, AlertTriangle, Phone, Mail, ShoppingBag, Heart, Cpu, DollarSign, ChevronDown, ChevronUp, ExternalLink, Shield, Eye, Zap, UserX, Bitcoin, X, ZoomIn, TrendingUp, PhoneCall, Search, MonitorPlay, Image as ImageIcon, Smartphone, Monitor } from 'lucide-react';
import { useFtcStats } from '../hooks/useFtcStats';
import { useDeviceType } from '../hooks/useDeviceType';
import Banner from '../components/Banner';

const ALL_IDS = ['invoice', 'phishing', 'tech', 'lottery', 'phone', 'spiritual', 'shopping', 'romance'];
const SCAM_ORDER = ['invoice', 'phishing', 'tech', 'lottery', 'phone', 'spiritual', 'shopping', 'romance'];

const SCAM_TYPES = [
  {
    id: 'phone',
    icon: Phone,
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
    title: 'Phone & Robocall Scams',
    summary: 'Unsolicited calls and texts from fake government agencies, banks, or companies pressuring immediate action.',
    warningsSigns: [
      'Caller or text claims to be IRS, SSA, Medicare, law enforcement, or a toll agency',
      'Demands immediate payment via gift card, wire transfer, or crypto',
      'Threatens arrest, license suspension, lawsuit, or account closure',
      'Caller ID shows a government or bank number (easily spoofed)',
      'Text includes a link to a website — that site exists only to steal your data',
      'Asks you to "press 1" or call back a specific number',
    ],
    whatToDo: [
      'Hang up or delete the text — do not click any links',
      'Never call back numbers left in suspicious voicemails or texts',
      'Look up the agency\'s real number independently and call that instead',
      'Report to the FTC at ReportFraud.ftc.gov',
      'Register on the National Do Not Call Registry: donotcall.gov',
    ],
    resource: { label: 'FTC: Unwanted Calls', url: 'https://consumer.ftc.gov/articles/dealing-unwanted-calls' },
    images: [
      { src: '/images/Toll_Road_Scam_Text.png', caption: 'Real toll road scam text — fake "CA FasTrak Final Notice" from a spoofed number. The link goes to a fake site designed to steal your payment information. Legitimate toll agencies do not threaten license suspension via text.', objectFit: 'contain' as const },
    ],
  },
  {
    id: 'invoice',
    icon: DollarSign,
    color: 'text-red-500',
    bg: 'bg-red-500/10',
    title: 'Invoice & Imposter Scams',
    summary: 'Fake invoices from Amazon, Apple, PayPal, Geek Squad, or similar companies tricking you into calling scammers.',
    warningsSigns: [
      'Unexpected email or text about a large charge or subscription renewal',
      'Urgent request to call a number to cancel or dispute a charge',
      'Email address doesn\'t match the legitimate company domain',
      'Grammar errors, generic greetings, or unusual formatting',
      'Links that redirect to lookalike websites',
    ],
    whatToDo: [
      'Log in to the actual company website directly — never through email links',
      'Call the company\'s official support number found on their real website',
      'Report phishing emails to the company and to reportphishing@apwg.org',
      'Do not click links or call numbers in suspicious emails',
    ],
    resource: { label: 'FTC: Imposter Scams', url: 'https://consumer.ftc.gov/features/scam-alerts' },
    images: [
      { src: '/images/Invoice.png', caption: 'Fake PayPal billing invoice — note the fraudulent order ID, bitcoin purchase, and auto-debit threat. The toll-free number is a scammer line. Never call numbers listed in unsolicited invoices.' },
      { src: '/images/fake_invoice.png', caption: 'Example of a fake PayPal invoice scam email. Note the fake phone number and auto-debit threat designed to create panic.' },
    ],
  },
  {
    id: 'tech',
    icon: Cpu,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    title: 'Tech Support Scams',
    summary: 'Pop-ups, texts, or voicemails claiming your computer has a virus or your account was charged, luring you into calling scammers.',
    warningsSigns: [
      'Browser pop-up with alarming message and a phone number to call',
      'Text or voicemail claiming a large purchase was made from your account',
      'Caller claims to be from Microsoft, Apple, Amazon, or your internet provider',
      'Request to install remote access software (AnyDesk, TeamViewer)',
      'Request to pay with gift cards or wire transfer for "repairs"',
      'Any website mentioned in these texts or pop-ups is a data-harvesting trap — never visit or enter information',
    ],
    whatToDo: [
      'Close the browser tab or delete the text — do not call any number',
      'Never give anyone remote access to your computer unsolicited',
      'If in doubt, look up the company\'s official number and call them directly',
      'Report at ReportFraud.ftc.gov',
    ],
    resource: { label: 'FTC: Tech Support Scams', url: 'https://consumer.ftc.gov/articles/tech-support-scams' },
    images: [
      { src: '/images/Fake_Text.jpg', caption: 'Tech support scam texts — fake order confirmations from Norton, Apple Pay, and Amazon with callback numbers. Never call these numbers. Delete the messages immediately.', objectFit: 'contain' as const },
    ],
  },
  {
    id: 'lottery',
    icon: Zap,
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10',
    title: 'Lottery, Prize & Sweepstakes Scams',
    summary: 'You\'ve "won" a prize but must pay fees or taxes upfront to collect. Publishers Clearing House imposters are extremely common.',
    warningsSigns: [
      'You\'re told you won a lottery or sweepstakes you never entered',
      'Required to pay a fee, tax, or processing charge to claim your prize',
      'Payment demanded via PayPal, Zelle, CashApp, Apple Pay, wire transfer, or a store barcode',
      'Offer arrives by phone, text, or postal mail with vague instructions',
      'Prize amount seems extraordinarily large',
      'Pressure to keep winnings secret until the "check clears"',
    ],
    whatToDo: [
      'Real prizes never require upfront payment of any kind — full stop',
      'Never send money via PayPal, Zelle, CashApp, Apple Pay, wire, or gift cards',
      'Never generate or photograph a Walmart, CVS, or other store money barcode for anyone',
      'Real Publishers Clearing House winners are notified only by certified mail',
      'Report at ReportFraud.ftc.gov',
    ],
    resource: { label: 'FTC: Prize & Lottery Scams', url: 'https://consumer.ftc.gov/articles/prize-sweepstakes-lottery-scams' },
    images: [
      { src: '/images/Paypal_Request.png', caption: 'Fake PayPal money request — scammers send real PayPal requests labeled "Apple Inc." or any name. The legitimate PayPal interface makes it look real. Ignore and report.' },
      { src: '/images/Walmart_Barcode.jpeg', caption: 'Walmart Money Services barcode — scammers instruct victims to open this screen in-store and show the code to a cashier to deposit cash. Sharing this is the same as handing over cash. Never do it for a stranger.' },
    ],
  },
  {
    id: 'romance',
    icon: Heart,
    color: 'text-pink-500',
    bg: 'bg-pink-500/10',
    title: 'Romance Scams',
    summary: 'Fake online partners build trust over weeks or months then request money for emergencies or "investments".',
    warningsSigns: [
      'Met online and progresses very fast emotionally',
      'Claims to be overseas — military, oil rig, doctor working abroad',
      'Always has a reason they can\'t video chat or meet in person',
      'Asks for money for travel, medical bills, or investment opportunities',
      'Profile photos look too perfect — may be stolen from another person',
    ],
    whatToDo: [
      'Reverse image search profile photos using Google Images or TinEye',
      'Never send money to someone you haven\'t met in person',
      'Talk to a trusted friend or family member about the relationship',
      'Report to the FTC and the platform where you met',
    ],
    resource: { label: 'FTC: Romance Scams', url: 'https://consumer.ftc.gov/articles/what-you-need-know-about-romance-scams' },
    images: [],
  },
  {
    id: 'spiritual',
    icon: Eye,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    title: 'Spellcaster & Spiritual Scams',
    summary: 'Fake psychics, spell casters, and spiritual healers on social media promising to solve problems for payment.',
    warningsSigns: [
      'Claims to cast spells to bring back a lost lover or improve fortune',
      'Contact made via Facebook, Instagram, or WhatsApp messages',
      'Requests increasing amounts of money for stronger spells or rituals',
      'Uses fake testimonials and stolen or staged photos',
      'Promises guaranteed results for a fee',
    ],
    whatToDo: [
      'No one can control others or guarantee outcomes through spells',
      'Block and report accounts on the social media platform',
      'Never send money, gift cards, or cryptocurrency to these individuals',
      'Report to the FTC and the platform',
    ],
    resource: { label: 'FTC: Psychic & Fortune Teller Scams', url: 'https://consumer.ftc.gov/articles/psychics-astrologers-and-crystal-ball-readers' },
    images: [
      { src: '/images/Fake_Money_With_Candles.jpeg', caption: 'Staged ritual imagery with fake money and candles used in spellcaster ads — photos like these are specifically curated to appear authentic and build false trust with victims.' },
      { src: '/images/Stupid Spell Stuff 2.jpeg', caption: 'Another example of staged spellcaster imagery used to deceive victims into paying for fake spiritual services.' },
    ],
  },
  {
    id: 'shopping',
    icon: ShoppingBag,
    color: 'text-teal-500',
    bg: 'bg-teal-500/10',
    title: 'Online Shopping Scams',
    summary: 'Fake stores, counterfeit goods, and social media sellers that take payment but never deliver.',
    warningsSigns: [
      'Website has extremely low prices with no reviews or company history',
      'No physical address, only a contact form or email',
      'Limited payment options — only wire transfer, Zelle, or crypto',
      'Seller pressures you to pay outside the platform',
      'Stock photos are used instead of actual product images',
    ],
    whatToDo: [
      'Research stores with BBB, Google reviews, and Trustpilot before buying',
      'Pay with a credit card for the best fraud protection',
      'Use platforms with buyer protection (eBay, Amazon, PayPal)',
      'Report fake stores to the FTC and the web host',
    ],
    resource: { label: 'FTC: Online Shopping', url: 'https://consumer.ftc.gov/articles/shopping-safely-online' },
    images: [],
  },
  {
    id: 'phishing',
    icon: Mail,
    color: 'text-cyan-500',
    bg: 'bg-cyan-500/10',
    title: 'Phishing & Smishing',
    summary: 'Fraudulent emails (phishing) and texts (smishing) that trick you into giving credentials or clicking malicious links.',
    warningsSigns: [
      'Urgent message about account verification, suspicious activity, or package delivery',
      'Link URL doesn\'t match the legitimate company\'s domain',
      'Grammar mistakes or unusual formatting',
      'Request to confirm sensitive information like SSN or password',
      'Asks you to click a link to claim a refund or avoid suspension',
    ],
    whatToDo: [
      'Never click links in unexpected emails or texts',
      'Go directly to the company\'s website by typing the URL',
      'Report phishing to the Anti-Phishing Working Group at reportphishing@apwg.org',
      'Forward spam texts to 7726 (SPAM)',
    ],
    resource: { label: 'FTC: Phishing Scams', url: 'https://consumer.ftc.gov/articles/how-recognize-and-avoid-phishing-scams' },
    images: [
      { src: '/images/phishing_email.png', caption: 'Real phishing email example: fake urgent notice about cloud storage claiming your files will be deleted to pressure you into clicking.' },
    ],
  },
];

const EMERGENCY_RESOURCES = [
  { label: 'FTC — Report Fraud', url: 'https://reportfraud.ftc.gov/', desc: 'File a consumer fraud complaint' },
  { label: 'FBI Internet Crime Complaint Center (IC3)', url: 'https://www.ic3.gov', desc: 'Report internet and cybercrime' },
  { label: 'Identity Theft.gov', url: 'https://www.identitytheft.gov', desc: 'Personalized recovery plan for identity theft' },
  { label: 'BBB Scam Tracker', url: 'https://www.bbb.org/scamtracker', desc: 'Report and look up scams' },
  { label: 'AARP Fraud Watch Network', url: 'https://www.aarp.org/money/scams-fraud/', desc: 'Resources and fraud helpline' },
  { label: 'National Elder Fraud Hotline', url: 'https://ovc.ojp.gov/program/stop-elder-fraud/introduction', desc: '1-833-FRAUD-11 for elder fraud reporting' },
];

const GIFT_CARD_GALLERY = [
  { src: '/images/Gift_Card_Rack.jpg', label: 'Gift Card Display Rack', caption: 'A full gift card display rack in a store — scammers send victims here to buy untraceable payment. If anyone tells you to go buy gift cards, stop and call a trusted person first.' },
  { src: '/images/Amazon_Gift_Cards.jpg', label: 'Amazon', caption: 'Amazon Gift Cards ($10–$500) — scammers love these for their wide availability and instant redemption.' },
  { src: '/images/steam-gc.png', label: 'Steam', caption: 'Steam Gift Cards — often requested in online scams targeting gamers and younger adults. Easy for scammers to resell game codes.' },
  { src: '/images/Greendot_Moneypak.jpg', label: 'Green Dot / MoneyPak', caption: 'Green Dot reloadable cards and MoneyPak — the code on the back is all a scammer needs to drain it instantly. Frequently used in IRS, utility, and government impersonation scams.' },
  { src: '/images/Apple_Gift_Cards.jpg', label: 'Apple', caption: 'Apple Gift Cards — frequently demanded by tech support scammers impersonating Apple, the IRS, or Social Security.' },
  { src: '/images/Credit_Card_Gift_Cards.jpg', label: 'Visa / Amex / Mastercard', caption: 'Credit card-branded gift cards (Visa, American Express, Mastercard) — accepted everywhere and completely untraceable once used. Often sold at pharmacy and grocery checkout lanes.' },
  { src: '/images/Google_Play_Cards.jpg', label: 'Google Play', caption: 'Google Play Gift Cards — commonly used in prize scams, utility shutoff threats, and tech support fraud.' },
];

const ALL_SCAM_EVIDENCE_IMAGES = [
  { src: '/images/Toll_Road_Scam_Text.png', title: 'Fake Toll Road Text Notice', category: 'Smishing Scam', desc: 'Fake CA FasTrak text threatening license suspension. Links to phishing site.' },
  { src: '/images/Invoice.png', title: 'Fake PayPal Invoice', category: 'Invoice Scam', desc: 'Auto-debit threat for $499.00 with fake toll-free number.' },
  { src: '/images/fake_invoice.png', title: 'Geek Squad Renewal Phish', category: 'Imposter Scam', desc: 'Fake $399 auto-renewal invoice created to trick victims into calling.' },
  { src: '/images/Fake_Text.jpg', title: 'Tech Support Text Confirmations', category: 'Tech Support', desc: 'Texts claiming Norton / Apple Pay charges with scammer callback numbers.' },
  { src: '/images/Paypal_Request.png', title: 'Fraudulent PayPal Payment Request', category: 'Payment Fraud', desc: 'Scammer sent real PayPal request disguised as Apple Inc.' },
  { src: '/images/Walmart_Barcode.jpeg', title: 'Walmart Money Barcode Trick', category: 'Cash Deposit Scam', desc: 'Barcode screen shown to store cashiers to deposit victim cash into scammer accounts.' },
  { src: '/images/Fake_Money_With_Candles.jpeg', title: 'Spellcaster Ritual Setup', category: 'Spiritual Scam', desc: 'Staged ritual scene with candles and fake money used to lure victims.' },
  { src: '/images/phishing_email.png', title: 'Urgent Cloud Storage Email', category: 'Phishing', desc: 'Fake urgent deletion notice designed to steal credentials.' },
  { src: '/images/Bitcoin_ATM.jpeg', title: 'Gas Station Bitcoin ATM Machine', category: 'Crypto ATM', desc: 'Physical Bitcoin kiosk used by scammers to receive irreversible cash deposits.' },
];

export default function EducationPage() {
  const device = useDeviceType();
  const [expanded, setExpanded] = useState<Set<string>>(new Set(ALL_IDS));
  const [lightbox, setLightbox] = useState<{ src: string; caption: string } | null>(null);
  const [gallery, setGallery] = useState<number | null>(null);
  const { stats } = useFtcStats();

  const toggle = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const openLightbox = (src: string, caption: string) => setLightbox({ src, caption });
  const closeLightbox = () => setLightbox(null);
  const openGallery = (index = 0) => setGallery(index);
  const closeGallery = () => setGallery(null);
  const galleryPrev = () => setGallery(i => i === null ? 0 : (i - 1 + GIFT_CARD_GALLERY.length) % GIFT_CARD_GALLERY.length);
  const galleryNext = () => setGallery(i => i === null ? 0 : (i + 1) % GIFT_CARD_GALLERY.length);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200 pb-20 text-slate-800 dark:text-slate-200 text-base sm:text-lg leading-relaxed">
      <Banner
        variant="info"
        id="education_tip"
        dismissible
        message={<span><strong>Educational Tip:</strong> Stay vigilant! Knowledge is your best defense against scammers. Scroll through our full-size evidence showcase below.</span>}
      />

      {/* Device Auto-Detection Status Indicator */}
      <div className="bg-slate-200/70 dark:bg-slate-900/70 border-b border-slate-300 dark:border-slate-800 py-1.5 px-4 text-center text-xs sm:text-sm text-slate-600 dark:text-slate-400 flex items-center justify-center gap-2">
        {device.isMobilePhone ? (
          <>
            <Smartphone className="w-4 h-4 text-brand-500" />
            <span>Mobile Phone View Auto-Detected — Tap images for full-screen evidence zoom</span>
          </>
        ) : device.isTablet ? (
          <>
            <Smartphone className="w-4 h-4 text-brand-500" />
            <span>Tablet View Auto-Detected — Enhanced layout enabled</span>
          </>
        ) : (
          <>
            <Monitor className="w-4 h-4 text-brand-500" />
            <span>Desktop Computer View Auto-Detected — Scrollable full-size image gallery enabled</span>
          </>
        )}
      </div>

      {gallery !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 animate-fade-in"
          onClick={closeGallery}
        >
          <div className="relative max-w-4xl w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-white/80 font-bold text-base">{gallery + 1} / {GIFT_CARD_GALLERY.length} — {GIFT_CARD_GALLERY[gallery].label}</span>
              <button onClick={closeGallery} className="text-white/90 hover:text-white flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 rounded-lg text-sm font-semibold">
                <X className="w-5 h-5" /> Close
              </button>
            </div>
            <div className="relative">
              <img
                src={GIFT_CARD_GALLERY[gallery].src}
                alt={GIFT_CARD_GALLERY[gallery].label}
                className="w-full max-h-[70vh] object-contain rounded-xl shadow-2xl bg-black"
              />
              <button
                onClick={galleryPrev}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/70 hover:bg-black/90 rounded-full flex items-center justify-center text-white text-2xl font-bold transition-all border border-white/20"
              >&#8249;</button>
              <button
                onClick={galleryNext}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/70 hover:bg-black/90 rounded-full flex items-center justify-center text-white text-2xl font-bold transition-all border border-white/20"
              >&#8250;</button>
            </div>
            <p className="mt-4 text-center text-white/90 text-sm sm:text-base px-4 leading-relaxed bg-slate-900/80 p-3 rounded-xl border border-slate-800">{GIFT_CARD_GALLERY[gallery].caption}</p>
            <div className="flex justify-center gap-2 mt-4 flex-wrap">
              {GIFT_CARD_GALLERY.map((card, i) => (
                <button
                  key={card.src}
                  onClick={() => setGallery(i)}
                  className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${i === gallery ? 'border-brand-500 scale-110 shadow-lg' : 'border-white/20 hover:border-white/50 opacity-70'}`}
                >
                  <img src={card.src} alt={card.label} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 animate-fade-in"
          onClick={closeLightbox}
        >
          <div className="relative max-w-5xl w-full flex flex-col items-center" onClick={e => e.stopPropagation()}>
            <div className="w-full flex items-center justify-between mb-3 text-white">
              <span className="text-sm font-semibold flex items-center gap-2"><ZoomIn className="w-4 h-4 text-brand-400" /> High-Resolution Evidence View</span>
              <button
                onClick={closeLightbox}
                className="text-white/90 hover:text-white flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-semibold transition-colors"
              >
                <X className="w-5 h-5" /> Close
              </button>
            </div>
            <img src={lightbox.src} alt={lightbox.caption} className="w-full h-auto rounded-xl shadow-2xl max-h-[75vh] object-contain bg-slate-900 border border-slate-800" />
            <p className="mt-4 text-center text-slate-100 text-sm sm:text-base max-w-3xl bg-slate-900/90 p-4 rounded-xl border border-slate-800 leading-relaxed">{lightbox.caption}</p>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 pt-8">
        {/* Main Title Section with Larger High-Legibility Typography */}
        <div className="text-center mb-12 sm:mb-16">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-brand-500/10 mb-6 border border-brand-500/20">
            <BookOpen className="w-8 h-8 sm:w-10 sm:h-10 text-brand-500" />
          </div>
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-slate-900 dark:text-white mb-6 tracking-tight leading-tight">
            Scam Education & Evidence Center
          </h1>
          <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto leading-relaxed">
            Knowledge is your best defense. Scroll through real evidence images, learn to spot red flags, and protect yourself against active scam tactics.
          </p>
        </div>

        {/* Local Sheriff Emergency Callout Box */}
        <div className="mb-12 rounded-2xl border-2 border-amber-400/60 bg-amber-50 dark:bg-amber-950/30 p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-5 shadow-md">
          <div className="flex-shrink-0 flex items-center justify-center w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/50 border border-amber-300 dark:border-amber-700">
            <Phone className="w-7 h-7 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="text-slate-900 dark:text-amber-100 font-bold text-lg sm:text-xl leading-snug mb-1">
              If you believe something is a scam, feel free to call your local sheriff's non-emergency line to verify.
            </p>
            <p className="text-slate-700 dark:text-amber-300/90 text-base">
              Deputies can help you confirm whether a call, text, or situation is legitimate — before you take any action.
            </p>
          </div>
          <a
            href="https://search.brave.com/search?q=local+sheriff+non-emergency+line+near+me"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 text-base font-bold transition-colors shadow-md whitespace-nowrap"
          >
            <Search className="w-5 h-5" />
            Find Number
          </a>
        </div>

        {/* Quick Stats Grid with Large Legible Figures */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <QuickStatCard icon={Shield} label={`Americans lost to fraud in ${stats.report_year}`} value={stats.total_loss_short} color="text-red-500" />
          <QuickStatCard icon={AlertTriangle} label="Reports filed with FTC" value={stats.total_reports_short} color="text-yellow-500" />
          <QuickStatCard icon={UserX} label="Identity theft victims" value={stats.identity_theft_victims} color="text-blue-500" />
        </div>

        {/* FEATURED: Scrollable Full-Size Real Scam Evidence Showcase (P2 focus) */}
        <section className="mb-16 card p-6 sm:p-8 bg-slate-900 text-slate-100 border border-slate-800 shadow-2xl">
          <div className="flex items-center gap-3 mb-4 border-b border-slate-800 pb-4">
            <div className="w-12 h-12 rounded-xl bg-brand-500/20 flex items-center justify-center flex-shrink-0 border border-brand-500/30">
              <ImageIcon className="w-6 h-6 text-brand-400" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-white">Full-Size Scam Evidence Showcase</h2>
              <p className="text-sm sm:text-base text-slate-400">Scroll through full-size authentic scam evidence images captured in real investigations.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
            {ALL_SCAM_EVIDENCE_IMAGES.map((img, idx) => (
              <div
                key={idx}
                className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden hover:border-brand-500/60 transition-all duration-300 flex flex-col group cursor-pointer shadow-lg"
                onClick={() => openLightbox(img.src, `${img.title} — ${img.desc}`)}
              >
                <div className="relative h-64 bg-slate-900 overflow-hidden flex items-center justify-center p-2">
                  <img
                    src={img.src}
                    alt={img.title}
                    className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <span className="px-4 py-2 bg-brand-600 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-xl">
                      <ZoomIn className="w-4 h-4" /> View Full Scale
                    </span>
                  </div>
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between border-t border-slate-800 bg-slate-900/60">
                  <div>
                    <span className="inline-block px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded bg-brand-500/20 text-brand-300 border border-brand-500/30 mb-2">
                      {img.category}
                    </span>
                    <h3 className="font-bold text-white text-base sm:text-lg mb-1">{img.title}</h3>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">{img.desc}</p>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-brand-400 font-semibold">
                    <span>Click to Enlarge</span>
                    <ZoomIn className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Trending Payment Methods Section */}
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-3">
            <TrendingUp className="w-6 h-6 text-red-500" />
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">Trending Payment Methods Used by Scammers</h2>
          </div>
          <p className="text-base text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
            Scammers demand these payment methods because they are irreversible, untraceable, and instant.
          </p>
          <div className="grid lg:grid-cols-2 gap-8">
            <GiftCardSection onZoom={openLightbox} onGallery={openGallery} />
            <BitcoinATMSection onZoom={openLightbox} />
          </div>
        </div>

        {/* Scrollable Scam Types Accordion Feed */}
        <div className="space-y-4 mb-16">
          <div className="mb-6">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mb-2">Scam Tactics Breakdown</h2>
            <p className="text-base text-slate-600 dark:text-slate-400">Expand any category to review warning signs, defensive actions, and full scam evidence.</p>
          </div>
          {SCAM_ORDER.map(id => {
            const scam = SCAM_TYPES.find(s => s.id === id)!;
            return (
              <ScamTypeCard
                key={scam.id}
                scam={scam}
                isExpanded={expanded.has(scam.id)}
                onToggle={() => toggle(scam.id)}
                onZoom={openLightbox}
              />
            );
          })}
        </div>

        {/* Universal Scam Prevention Rules */}
        <div className="card p-6 sm:p-8 mb-16 shadow-lg border border-slate-200 dark:border-slate-800">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mb-3 flex items-center gap-3">
            <Shield className="w-7 h-7 text-brand-500" />
            Universal Scam Prevention Rules
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-base mb-8">These golden rules protect you against almost every scam tactic:</p>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              'Never pay with gift cards, wire transfers, Zelle, or cryptocurrency for unexpected requests.',
              'Government agencies NEVER contact you first by phone, text, or email demanding payment.',
              'If someone creates extreme urgency ("act now or face arrest!"), it is a manipulation tactic.',
              'Legitimate businesses don\'t ask for remote access to your computer or phone.',
              'If a deal or prize seems too good to be true, it almost certainly is.',
              'Verify unexpected offers by contacting the company directly using their official website number.',
              'Protect your SSN, bank credentials, and 2FA passwords — never share them unsolicited.',
              'Talk to a trusted person or family member before making any large or unexpected payment.',
            ].map((rule, i) => (
              <div key={i} className="flex items-start gap-3 p-4 bg-slate-100 dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="w-7 h-7 rounded-full bg-brand-500/20 flex items-center justify-center flex-shrink-0 text-brand-500 font-bold text-sm mt-0.5">{i + 1}</span>
                <p className="text-base text-slate-800 dark:text-slate-200 leading-relaxed">{rule}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Streamer Callout Card */}
        <div className="card p-6 sm:p-8 mb-16 border-brand-500/30 bg-brand-50/30 dark:bg-brand-950/20 shadow-lg">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-brand-500/20 flex items-center justify-center flex-shrink-0">
              <MonitorPlay className="w-7 h-7 text-brand-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Are you a Content Creator or Livestreamer?</h2>
              <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                Streamers face unique cybersecurity threats including fake game launchers, Discord token grabbers, fake sponsorships, and live extortion. View our dedicated Livestreaming Safety & Security Field Guide to harden your channel.
              </p>
            </div>
          </div>
          <Link
            to="/stream-safety"
            className="inline-flex items-center gap-2.5 px-6 py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-base rounded-xl transition-colors shadow-md"
          >
            <MonitorPlay className="w-5 h-5" />
            View Creator Field Guide
          </Link>
        </div>

        {/* Sheriff Calling Card */}
        <div className="card p-6 sm:p-8 mb-16 border-blue-500/30 bg-blue-50/30 dark:bg-blue-950/10 shadow-lg">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <PhoneCall className="w-7 h-7 text-blue-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Think You're Being Scammed? Call Your Local Sheriff</h2>
              <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                If you suspect you are being targeted — even if you haven't sent money yet — contact your local sheriff's office non-emergency line. They can advise you, document the attempt, and help prevent further contact. You do not need to wait until money is lost.
              </p>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-4 mb-6">
            {[
              { step: '1', title: 'Don\'t hang up or delete anything', desc: 'Save texts, emails, and voicemails as evidence before reporting.' },
              { step: '2', title: 'Call the non-emergency line', desc: 'Not 911 — use the non-emergency number for your county sheriff or local police.' },
              { step: '3', title: 'Report to the FTC too', desc: 'Filing at ReportFraud.ftc.gov creates a federal record and helps investigators track patterns.' },
            ].map(item => (
              <div key={item.step} className="bg-slate-50 dark:bg-slate-900/80 rounded-xl p-4 border border-blue-200 dark:border-blue-900/40">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center mb-3">
                  <span className="text-blue-600 dark:text-blue-400 font-bold text-base">{item.step}</span>
                </div>
                <p className="font-bold text-slate-900 dark:text-white text-base mb-1">{item.title}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
          <a
            href="https://search.brave.com/search?q=local+sheriff+non-emergency+phone+number+near+me"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base rounded-xl transition-colors shadow-md"
          >
            <Search className="w-5 h-5" />
            Find Your Local Sheriff Non-Emergency Number
          </a>
        </div>

        {/* Emergency Resources */}
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mb-6 flex items-center gap-3">
            <ExternalLink className="w-7 h-7 text-brand-500" />
            Emergency Resources
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {EMERGENCY_RESOURCES.map(r => (
              <a
                key={r.label}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="card p-5 hover:border-brand-500/50 transition-all group flex flex-col justify-between"
              >
                <div>
                  <p className="font-bold text-slate-900 dark:text-white text-base group-hover:text-brand-500 transition-colors mb-1.5">{r.label}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{r.desc}</p>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-400 mt-4" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const GIFT_CARD_THUMBNAILS = [
  { src: '/images/Amazon_Gift_Cards.jpg', label: 'Amazon', idx: 1 },
  { src: '/images/steam-gc.png', label: 'Steam', idx: 2 },
  { src: '/images/Greendot_Moneypak.jpg', label: 'Green Dot', idx: 3 },
];

function GiftCardSection({ onGallery }: { onZoom: (src: string, caption: string) => void; onGallery: (index?: number) => void }) {
  const COMMON_CARDS = [
    { name: 'Apple / Amazon / Google Play', note: 'Tech support, IRS, and prize scams' },
    { name: 'Visa / Mastercard / Amex prepaid', note: 'Untraceable like cash — accepted everywhere' },
    { name: 'Green Dot MoneyPak', note: 'Government impersonation scams' },
    { name: 'Steam / Walmart / Target', note: 'Broad availability, no ID required to buy' },
  ];

  return (
    <div className="card p-6 h-full flex flex-col bg-slate-900/90 text-slate-100 border border-slate-800 shadow-xl">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0 border border-red-500/30">
          <AlertTriangle className="w-5 h-5 text-red-500" />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white leading-tight">Gift Cards</h2>
          <p className="text-xs sm:text-sm text-slate-400">Instant, irreversible, untraceable</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 flex-1">
        <div className="flex flex-col gap-3">
          <div
            className="relative group cursor-pointer rounded-xl overflow-hidden border border-slate-700 hover:border-brand-500/80 bg-slate-950 transition-all duration-200 flex-1 min-h-[180px]"
            onClick={() => onGallery(0)}
          >
            <img
              src="/images/Gift_Card_Rack.jpg"
              alt="Gift card rack in store"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 absolute inset-0"
            />
            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/50 transition-all duration-300" />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3">
              <div className="flex items-center gap-2 text-white">
                <ZoomIn className="w-4 h-4 text-brand-400 flex-shrink-0" />
                <p className="text-xs sm:text-sm font-bold leading-tight">View {GIFT_CARD_GALLERY.length} Card Types</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {GIFT_CARD_THUMBNAILS.map(thumb => (
              <button
                key={thumb.src}
                onClick={() => onGallery(thumb.idx)}
                className="relative group aspect-square rounded-lg overflow-hidden border border-slate-800 hover:border-brand-500 transition-all duration-200 bg-slate-950"
              >
                <img src={thumb.src} alt={thumb.label} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-all duration-200" />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                  <p className="text-white text-[10px] font-semibold truncate">{thumb.label}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col justify-between">
          <div>
            <p className="text-sm text-slate-300 mb-4 leading-relaxed">
              No legitimate agency or business will ever ask you to pay with a gift card. If someone does — it is a scam, no exceptions.
            </p>
            <div className="space-y-2">
              {COMMON_CARDS.map((card, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-brand-500 mt-1.5 flex-shrink-0" />
                  <p className="text-xs sm:text-sm text-slate-300 leading-snug">
                    <span className="font-bold text-white">{card.name}</span>
                    {' '} — {card.note}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 bg-red-500/10 border border-red-500/30 rounded-xl p-3.5">
        <p className="text-xs sm:text-sm font-bold text-red-400 mb-1">The Golden Rule</p>
        <p className="text-xs sm:text-sm text-red-300 leading-relaxed">
          Anyone asking you to buy gift cards and read the numbers over the phone is scamming you. Always.
        </p>
      </div>
    </div>
  );
}

function BitcoinATMSection({ onZoom }: { onZoom: (src: string, caption: string) => void }) {
  const points = [
    'Payments are irreversible — once sent, funds are gone permanently',
    'ATMs charge 5% to 20% fees on top of the financial loss itself',
    'Found in gas stations and liquor stores, not banks',
    'Sending from a mobile wallet app is equally dangerous',
    'Scammers provide a QR code or wallet address for you to scan',
  ];
  return (
    <div className="card p-6 h-full flex flex-col bg-slate-900/90 text-slate-100 border border-slate-800 shadow-xl">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center flex-shrink-0 border border-yellow-500/30">
          <Bitcoin className="w-5 h-5 text-yellow-400" />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white leading-tight">Bitcoin ATMs & Cryptocurrency</h2>
          <p className="text-xs sm:text-sm text-slate-400">Found in gas stations and convenience stores</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 flex-1">
        <ClickableImage
          src="/images/Bitcoin_ATM.jpeg"
          caption="Bitcoin ATM machine — found in convenience stores and gas stations."
          onZoom={onZoom}
          fill
          label="Bitcoin ATM Machine"
        />
        <div className="flex flex-col justify-between">
          <div>
            <p className="text-sm text-slate-300 mb-4 leading-relaxed">
              Scammers direct victims to physical Bitcoin kiosks or ask them to send crypto from wallet apps. Both are equally irreversible.
            </p>
            <ul className="space-y-2">
              {points.map((p, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-yellow-400 mt-1.5 flex-shrink-0" />
                  <p className="text-xs sm:text-sm text-slate-300 leading-snug">{p}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-5 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3.5">
        <p className="text-xs sm:text-sm font-bold text-yellow-400 mb-1">If Directed to a Bitcoin ATM</p>
        <p className="text-xs sm:text-sm text-yellow-300 leading-relaxed">
          Stop. Walk away. Call a trusted family member or the FTC at 1-877-382-4357 before taking any step.
        </p>
      </div>
    </div>
  );
}

function ClickableImage({ src, caption, onZoom, fill = false, objectFit = 'cover', label }: { src: string; caption: string; onZoom: (src: string, caption: string) => void; fill?: boolean; objectFit?: 'cover' | 'contain'; label?: string }) {
  const displayLabel = label ?? caption.split(' — ')[0];
  return (
    <div
      className={`relative group cursor-pointer rounded-xl overflow-hidden border border-slate-800 hover:border-brand-500/80 bg-slate-950 transition-all duration-200 ${fill ? 'h-full flex flex-col' : ''}`}
      onClick={() => onZoom(src, caption)}
    >
      <div className={`relative overflow-hidden ${fill ? 'flex-1 min-h-[180px]' : 'h-64'}`}>
        <img src={src} alt={caption} className={`w-full h-full ${objectFit === 'contain' ? 'object-contain object-top' : 'object-cover'} transition-transform duration-300 group-hover:scale-105`} />
        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-all duration-300" />
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3">
        <div className="flex items-center gap-2 text-white">
          <ZoomIn className="w-4 h-4 text-brand-400 flex-shrink-0" />
          <p className="text-xs sm:text-sm font-bold leading-tight line-clamp-1">{displayLabel}</p>
        </div>
      </div>
    </div>
  );
}

function QuickStatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className="card p-6 text-center bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-brand-500/40 transition-all shadow-md">
      <Icon className={`w-8 h-8 ${color} mx-auto mb-3`} />
      <div className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white mb-1">{value}</div>
      <div className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  );
}

type ScamType = typeof SCAM_TYPES[0] & { images?: Array<{ src: string; caption: string; objectFit?: 'cover' | 'contain' }> };

function ScamTypeCard({ scam, isExpanded, onToggle, onZoom }: { scam: ScamType; isExpanded: boolean; onToggle: () => void; onZoom: (src: string, caption: string) => void }) {
  const Icon = scam.icon;
  const hasImages = scam.images && scam.images.length > 0;
  return (
    <div className={`card overflow-hidden transition-all duration-300 border ${isExpanded ? 'border-brand-500/50 shadow-lg' : 'border-slate-200 dark:border-slate-800'}`}>
      <button
        onClick={onToggle}
        className="w-full p-5 sm:p-6 flex items-center gap-4 text-left hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
      >
        <div className={`w-12 h-12 rounded-2xl ${scam.bg} flex items-center justify-center flex-shrink-0 border border-slate-200 dark:border-slate-800`}>
          <Icon className={`w-6 h-6 ${scam.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-slate-900 dark:text-white text-lg sm:text-xl mb-1">{scam.title}</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-1">{scam.summary}</p>
        </div>
        {isExpanded ? <ChevronUp className="w-6 h-6 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-6 h-6 text-slate-400 flex-shrink-0" />}
      </button>

      {isExpanded && (
        <div className="px-5 sm:px-6 pb-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
          <div className={`grid ${hasImages ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-6 pt-5 items-stretch`}>
            <div>
              <h4 className="font-bold text-red-600 dark:text-red-400 text-base mb-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" /> Warning Signs
              </h4>
              <ul className="space-y-2.5">
                {scam.warningsSigns.map((sign, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-snug">
                    <span className="w-2 h-2 rounded-full bg-red-500 mt-2 flex-shrink-0" />{sign}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col justify-between">
              <div>
                <h4 className="font-bold text-green-600 dark:text-green-400 text-base mb-3 flex items-center gap-2">
                  <Shield className="w-5 h-5" /> What To Do
                </h4>
                <ul className="space-y-2.5 mb-6">
                  {scam.whatToDo.map((action, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-snug">
                      <span className="w-2 h-2 rounded-full bg-green-500 mt-2 flex-shrink-0" />{action}
                    </li>
                  ))}
                </ul>
              </div>
              <a href={scam.resource.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm sm:text-base font-bold text-brand-500 hover:underline">
                <ExternalLink className="w-4 h-4" />{scam.resource.label}
              </a>
            </div>
            {hasImages && (
              <div className="flex flex-col gap-3 h-full">
                <h4 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                  <ZoomIn className="w-4 h-4 text-brand-500" /> Real Scam Evidence
                </h4>
                <div className="flex flex-col gap-3 flex-1 h-full">
                  <div className="h-full">
                    <ClickableImage src={scam.images![0].src} caption={scam.images![0].caption} onZoom={onZoom} fill objectFit={scam.images![0].objectFit} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
