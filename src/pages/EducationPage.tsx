import React, { useState } from 'react';
import { Link } from 'react-router';
import { BookOpen, AlertTriangle, Phone, Mail, ShoppingBag, Heart, Cpu, DollarSign, ChevronDown, ChevronUp, ExternalLink, Shield, Eye, Zap, UserX, Bitcoin, X, ZoomIn, TrendingUp, PhoneCall, Search, MonitorPlay } from 'lucide-react';
import { useFtcStats } from '../hooks/useFtcStats';
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
      'Text includes a link to a website  that site exists only to steal your data',
      'Asks you to "press 1" or call back a specific number',
    ],
    whatToDo: [
      'Hang up or delete the text  do not click any links',
      'Never call back numbers left in suspicious voicemails or texts',
      'Look up the agency\'s real number independently and call that instead',
      'Report to the FTC at ReportFraud.ftc.gov',
      'Register on the National Do Not Call Registry: donotcall.gov',
    ],
    resource: { label: 'FTC: Unwanted Calls', url: 'https://consumer.ftc.gov/articles/dealing-unwanted-calls' },
    images: [
      { src: '/images/Toll_Road_Scam_Text.png', caption: 'Real toll road scam text  fake "CA FasTrak Final Notice" from a spoofed number. The link goes to a fake site designed to steal your payment information. Legitimate toll agencies do not threaten license suspension via text.', objectFit: 'contain' as const },
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
      'Log in to the actual company website directly  never through email links',
      'Call the company\'s official support number found on their real website',
      'Report phishing emails to the company and to reportphishing@apwg.org',
      'Do not click links or call numbers in suspicious emails',
    ],
    resource: { label: 'FTC: Imposter Scams', url: 'https://consumer.ftc.gov/features/scam-alerts' },
    images: [
      { src: '/images/Invoice.png', caption: 'Fake PayPal billing invoice  note the fraudulent order ID, bitcoin purchase, and auto-debit threat. The toll-free number is a scammer line. Never call numbers listed in unsolicited invoices.' },
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
      'Any website mentioned in these texts or pop-ups is a data-harvesting trap  never visit or enter information',
    ],
    whatToDo: [
      'Close the browser tab or delete the text  do not call any number',
      'Never give anyone remote access to your computer unsolicited',
      'If in doubt, look up the company\'s official number and call them directly',
      'Report at ReportFraud.ftc.gov',
    ],
    resource: { label: 'FTC: Tech Support Scams', url: 'https://consumer.ftc.gov/articles/tech-support-scams' },
    images: [
      { src: '/images/Fake_Text.jpg', caption: 'Tech support scam texts  fake order confirmations from Norton, Apple Pay, and Amazon with callback numbers. Never call these numbers. Delete the messages immediately.', objectFit: 'contain' as const },
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
      'Real prizes never require upfront payment of any kind  full stop',
      'Never send money via PayPal, Zelle, CashApp, Apple Pay, wire, or gift cards',
      'Never generate or photograph a Walmart, CVS, or other store money barcode for anyone',
      'Real Publishers Clearing House winners are notified only by certified mail',
      'Report at ReportFraud.ftc.gov',
    ],
    resource: { label: 'FTC: Prize & Lottery Scams', url: 'https://consumer.ftc.gov/articles/prize-sweepstakes-lottery-scams' },
    images: [
      { src: '/images/Paypal_Request.png', caption: 'Fake PayPal money request  scammers send real PayPal requests labeled "Apple Inc." or any name. The legitimate PayPal interface makes it look real. Ignore and report.' },
      { src: '/images/Walmart_Barcode.jpeg', caption: 'Walmart Money Services barcode  scammers instruct victims to open this screen in-store and show the code to a cashier to deposit cash. Sharing this is the same as handing over cash. Never do it for a stranger.' },
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
      'Claims to be overseas  military, oil rig, doctor working abroad',
      'Always has a reason they can\'t video chat or meet in person',
      'Asks for money for travel, medical bills, or investment opportunities',
      'Profile photos look too perfect  may be stolen from another person',
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
      { src: '/images/Fake_Money_With_Candles.jpeg', caption: 'Staged ritual imagery with fake money and candles used in spellcaster ads  photos like these are specifically curated to appear authentic and build false trust with victims.' },
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
      'Limited payment options  only wire transfer, Zelle, or crypto',
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
  { label: 'FTC  Report Fraud', url: 'https://reportfraud.ftc.gov/', desc: 'File a consumer fraud complaint' },
  { label: 'FBI Internet Crime Complaint Center (IC3)', url: 'https://www.ic3.gov', desc: 'Report internet and cybercrime' },
  { label: 'Identity Theft.gov', url: 'https://www.identitytheft.gov', desc: 'Personalized recovery plan for identity theft' },
  { label: 'BBB Scam Tracker', url: 'https://www.bbb.org/scamtracker', desc: 'Report and look up scams' },
  { label: 'AARP Fraud Watch Network', url: 'https://www.aarp.org/money/scams-fraud/', desc: 'Resources and fraud helpline' },
  { label: 'National Elder Fraud Hotline', url: 'https://ovc.ojp.gov/program/stop-elder-fraud/introduction', desc: '1-833-FRAUD-11 for elder fraud reporting' },
];

const GIFT_CARD_GALLERY = [
  { src: '/images/Gift_Card_Rack.jpg', label: 'Gift Card Display Rack', caption: 'A full gift card display rack in a store  scammers send victims here to buy untraceable payment. If anyone tells you to go buy gift cards, stop and call a trusted person first.' },
  { src: '/images/Amazon_Gift_Cards.jpg', label: 'Amazon', caption: 'Amazon Gift Cards ($10$500)  scammers love these for their wide availability and instant redemption.' },
  { src: '/images/steam-gc.png', label: 'Steam', caption: 'Steam Gift Cards  often requested in online scams targeting gamers and younger adults. Easy for scammers to resell game codes.' },
  { src: '/images/Greendot_Moneypak.jpg', label: 'Green Dot / MoneyPak', caption: 'Green Dot reloadable cards and MoneyPak  the code on the back is all a scammer needs to drain it instantly. Frequently used in IRS, utility, and government impersonation scams.' },
  { src: '/images/Apple_Gift_Cards.jpg', label: 'Apple', caption: 'Apple Gift Cards  frequently demanded by tech support scammers impersonating Apple, the IRS, or Social Security.' },
  { src: '/images/Credit_Card_Gift_Cards.jpg', label: 'Visa / Amex / Mastercard', caption: 'Credit card-branded gift cards (Visa, American Express, Mastercard)  accepted everywhere and completely untraceable once used. Often sold at pharmacy and grocery checkout lanes.' },
  { src: '/images/Google_Play_Cards.jpg', label: 'Google Play', caption: 'Google Play Gift Cards  commonly used in prize scams, utility shutoff threats, and tech support fraud.' },
];

export default function EducationPage() {
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200 pt-8 pb-16 text-slate-700 dark:text-slate-300">
      <Banner
        variant="info"
        id="education_tip"
        dismissible
        message={<span><strong>Educational Tip:</strong> Stay vigilant! Knowledge is your best defense against scammers. Read the articles below to stay updated.</span>}
      />
      {gallery !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 animate-fade-in"
          onClick={closeGallery}
        >
          <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-white/60 text-sm">{gallery + 1} / {GIFT_CARD_GALLERY.length}</span>
              <button onClick={closeGallery} className="text-white/80 hover:text-white flex items-center gap-1 text-sm">
                <X className="w-5 h-5" /> Close
              </button>
            </div>
            <div className="relative">
              <img
                src={GIFT_CARD_GALLERY[gallery].src}
                alt={GIFT_CARD_GALLERY[gallery].label}
                className="w-full max-h-[60vh] object-contain rounded-xl shadow-2xl"
              />
              <button
                onClick={galleryPrev}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-slate-900 dark:text-white transition-all"
              >&#8249;</button>
              <button
                onClick={galleryNext}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-slate-900 dark:text-white transition-all"
              >&#8250;</button>
            </div>
            <p className="mt-3 text-center text-white/70 text-sm px-4">{GIFT_CARD_GALLERY[gallery].caption}</p>
            <div className="flex justify-center gap-2 mt-4 flex-wrap">
              {GIFT_CARD_GALLERY.map((card, i) => (
                <button
                  key={card.src}
                  onClick={() => setGallery(i)}
                  className={`relative w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${i === gallery ? 'border-brand-500 scale-110' : 'border-white/20 hover:border-white/50'}`}
                >
                  <img src={card.src} alt={card.label} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
            <p className="text-center text-white/50 text-xs mt-3">{GIFT_CARD_GALLERY[gallery].label}</p>
          </div>
        </div>
      )}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-fade-in"
          onClick={closeLightbox}
        >
          <div className="relative max-w-4xl w-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={closeLightbox}
              className="absolute -top-10 right-0 text-white/80 hover:text-white flex items-center gap-1 text-sm"
            >
              <X className="w-5 h-5" /> Close
            </button>
            <img src={lightbox.src} alt={lightbox.caption} className="w-full h-auto rounded-xl shadow-2xl max-h-[80vh] object-contain" />
            <p className="mt-3 text-center text-white/70 text-sm">{lightbox.caption}</p>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-14">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-500/10 mb-6">
            <BookOpen className="w-8 h-8 text-brand-500" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-4">Scam Education Center</h1>
          <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
            Knowledge is your best defense. Learn to recognize the most common scam tactics and protect yourself and your loved ones.
          </p>
        </div>

        <div className="mb-10 rounded-2xl border-2 border-amber-400/60 bg-amber-50 dark:bg-amber-950/30 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 shadow-sm">
          <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/50 border border-amber-300 dark:border-amber-700">
            <Phone className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="text-slate-900 dark:text-amber-100 font-semibold text-base leading-snug mb-1">
              If you believe something is a scam, feel free to call your local sheriff's non-emergency line to verify.
            </p>
            <p className="text-slate-600 dark:text-amber-300/80 text-sm">
              Deputies can help you confirm whether a call, text, or situation is legitimate — before you take any action.</p>
          </div>
          <a
            href="https://search.brave.com/search?q=local+sheriff+non-emergency+line+near+me"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-900 dark:text-white text-sm font-semibold transition-colors shadow-sm whitespace-nowrap"
          >
            <Search className="w-4 h-4" />
            Find the number
          </a>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-12">
          <QuickStatCard icon={Shield} label={`Americans lost to fraud in ${stats.report_year}`} value={stats.total_loss_short} color="text-red-500" />
          <QuickStatCard icon={AlertTriangle} label="Reports filed with FTC" value={stats.total_reports_short} color="text-yellow-500" />
          <QuickStatCard icon={UserX} label="Identity theft victims" value={stats.identity_theft_victims} color="text-blue-500" />
        </div>

        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Trending Payment Methods Used by Scammers</h2>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">These methods are preferred because they are irreversible and nearly impossible to trace once sent.</p>
          <div className="grid lg:grid-cols-2 gap-6">
            <GiftCardSection onZoom={openLightbox} onGallery={openGallery} />
            <BitcoinATMSection onZoom={openLightbox} />
          </div>
        </div>

        <div className="space-y-3 mb-14">
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

        <div className="card p-8 mb-12">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
            <Shield className="w-6 h-6 text-brand-500" />
            Universal Scam Prevention Rules
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">These rules apply to virtually every scam you'll encounter:</p>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              'Never pay with gift cards, wire transfers, Zelle, or cryptocurrency for unexpected requests.',
              'Government agencies NEVER contact you first by phone, text, or email demanding payment.',
              'If someone creates urgency ("act now!"), it\'s almost always a manipulation tactic.',
              'Legitimate businesses don\'t ask for remote access to your devices.',
              'If a deal seems too good to be true, it almost certainly is.',
              'Verify unexpected offers by contacting the company directly using their official number.',
              'Protect your SSN, bank account, and passwords  never share them unsolicited.',
              'Talk to a trusted person before making any large or unusual payment.',
            ].map((rule, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <span className="w-6 h-6 rounded-full bg-brand-500/20 flex items-center justify-center flex-shrink-0 text-brand-500 font-bold text-xs mt-0.5">{i + 1}</span>
                <p className="text-sm text-slate-700 dark:text-slate-300">{rule}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-8 mb-12 border-brand-500/30 bg-brand-50/30 dark:bg-brand-950/20">
          <div className="flex items-start gap-4 mb-5">
            <div className="w-12 h-12 rounded-xl bg-brand-500/20 flex items-center justify-center flex-shrink-0">
              <MonitorPlay className="w-6 h-6 text-brand-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Are you a Content Creator or Livestreamer?</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Streamers face unique threats including session hijacking, fake sponsorships, and live extortion. View our dedicated Livestreaming Safety & Security Field Guide to protect your channel and personal data.</p>
            </div>
          </div>
          <Link
            to="/stream-safety"
            className="inline-flex items-center gap-2.5 px-5 py-3 bg-brand-600 hover:bg-brand-700 text-slate-900 dark:text-white font-semibold text-sm rounded-xl transition-colors shadow-sm"
          >
            <MonitorPlay className="w-4 h-4" />
            View Creator Field Guide
          </Link>
        </div>

        <div className="card p-8 mb-12 border-blue-500/30 bg-blue-50/30 dark:bg-blue-950/10">
          <div className="flex items-start gap-4 mb-5">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <PhoneCall className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Think You're Being Scammed? Call Your Local Sheriff</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                If you suspect you're being targeted — even if you haven't sent money yet — contact your local sheriff's office non-emergency line. They can advise you, document the attempt, and help prevent further contact. You do not need to wait until money is lost.</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-4 mb-5">
            {[
              { step: '1', title: 'Don\'t hang up or delete anything', desc: 'Save texts, emails, and voicemails as evidence before reporting.' },
              { step: '2', title: 'Call the non-emergency line', desc: 'Not 911  use the non-emergency number for your county sheriff or local police.' },
              { step: '3', title: 'Report to the FTC too', desc: 'Filing at ReportFraud.ftc.gov creates a federal record and helps investigators track patterns.' },
            ].map(item => (
              <div key={item.step} className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 border border-blue-100 dark:border-blue-900/30">
                <div className="w-7 h-7 rounded-full bg-blue-500/15 flex items-center justify-center mb-3">
                  <span className="text-blue-600 dark:text-blue-400 font-bold text-sm">{item.step}</span>
                </div>
                <p className="font-semibold text-slate-900 dark:text-white text-sm mb-1">{item.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{item.desc}</p>
              </div>
            ))}
          </div>
          <a
            href="https://search.brave.com/search?q=local+sheriff+non-emergency+phone+number+near+me"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-slate-900 dark:text-white font-semibold text-sm rounded-xl transition-colors shadow-sm"
          >
            <Search className="w-4 h-4" />
            Find Your Local Sheriff Non-Emergency Number
          </a>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">
            Opens a Brave Search for your local sheriff non-emergency contact information.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
            <ExternalLink className="w-6 h-6 text-brand-500" />
            Emergency Resources
          </h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {EMERGENCY_RESOURCES.map(r => (
              <a
                key={r.label}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="card p-4 hover:border-brand-500/50 transition-all group"
              >
                <p className="font-semibold text-slate-900 dark:text-white text-sm group-hover:text-brand-500 transition-colors mb-1">{r.label}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{r.desc}</p>
                <ExternalLink className="w-3 h-3 text-slate-400 mt-2" />
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
    { name: 'Visa / Mastercard / Amex prepaid', note: 'Untraceable like cash  accepted everywhere' },
    { name: 'Green Dot MoneyPak', note: 'Government impersonation scams' },
    { name: 'Steam / Walmart / Target', note: 'Broad availability, no ID required to buy' },
  ];

  return (
    <div className="card p-5 h-full flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-4 h-4 text-red-500" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">Gift Cards</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Instant, irreversible, untraceable</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 flex-1">
        <div className="flex flex-col gap-3">
          <div
            className="relative group cursor-pointer rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 hover:border-brand-500/60 bg-slate-100 dark:bg-slate-800 transition-all duration-200 flex-1"
            style={{ minHeight: '160px' }}
            onClick={() => onGallery(0)}
          >
            <img
              src="/images/Gift_Card_Rack.jpg"
              alt="Gift card rack in store"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 absolute inset-0"
            />
            <div className="absolute inset-0 bg-black/25 group-hover:bg-black/45 transition-all duration-300" />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3">
              <div className="flex items-center gap-1.5 text-slate-900 dark:text-white">
                <ZoomIn className="w-3.5 h-3.5 flex-shrink-0" />
                <p className="text-xs font-bold leading-tight">View {GIFT_CARD_GALLERY.length} types</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {GIFT_CARD_THUMBNAILS.map(thumb => (
              <button
                key={thumb.src}
                onClick={() => onGallery(thumb.idx)}
                className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 hover:border-brand-500/60 transition-all duration-200 bg-slate-100 dark:bg-slate-800"
              >
                <img src={thumb.src} alt={thumb.label} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/30 transition-all duration-200" />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-1 py-1">
                  <p className="text-slate-900 dark:text-white text-[9px] font-semibold leading-tight truncate">{thumb.label}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col justify-between">
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
              No legitimate agency or business will ever ask you to pay with a gift card. If someone does — it is a scam, no exceptions.</p>
            <div className="space-y-1.5">
              {COMMON_CARDS.map((card, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-1.5 flex-shrink-0" />
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{card.name}</span>
                    {' '} {card.note}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg p-3">
        <p className="text-xs font-bold text-red-600 dark:text-red-400 mb-0.5">The Golden Rule</p>
        <p className="text-xs text-red-600 dark:text-red-400">
          Anyone asking you to buy gift cards and read the numbers over the phone is scamming you. Always.
        </p>
      </div>
    </div>
  );
}

function BitcoinATMSection({ onZoom }: { onZoom: (src: string, caption: string) => void }) {
  const points = [
    'Payments are irreversible  once sent, gone permanently',
    'ATMs charge 520% fees on top of the loss itself',
    'Found in liquor stores and gas stations, not banks',
    'Sending from a wallet app is equally dangerous',
    'Scammers provide a QR code or wallet address to scan',
  ];
  return (
    <div className="card p-5 h-full flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
          <Bitcoin className="w-4 h-4 text-yellow-500" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">Bitcoin ATMs &amp; Cryptocurrency</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Found in gas stations and liquor stores</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 flex-1">
        <ClickableImage
          src="/images/Bitcoin_ATM.jpeg"
          caption="Bitcoin ATM"
          onZoom={onZoom}
          fill
          label="Bitcoin ATM"
        />
        <div className="flex flex-col justify-between">
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
              Scammers direct victims to ATMs or ask them to send crypto from any wallet. Both are equally dangerous — and irreversible.</p>
            <ul className="space-y-1.5">
              {points.map((p, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 mt-1.5 flex-shrink-0" />
                  <p className="text-xs text-slate-600 dark:text-slate-400">{p}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-4 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-900/50 rounded-lg p-3">
        <p className="text-xs font-bold text-yellow-700 dark:text-yellow-400 mb-0.5">If directed to a Bitcoin ATM</p>
        <p className="text-xs text-yellow-700 dark:text-yellow-400">
          Stop. Walk away. Call a trusted family member or the FTC at 1-877-382-4357 before doing anything.
        </p>
      </div>
    </div>
  );
}

function ClickableImage({ src, caption, onZoom, fill = false, objectFit = 'cover', label }: { src: string; caption: string; onZoom: (src: string, caption: string) => void; fill?: boolean; objectFit?: 'cover' | 'contain'; label?: string }) {
  const displayLabel = label ?? caption.split('  ')[0];
  return (
    <div
      className={`relative group cursor-pointer rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 hover:border-brand-500/60 bg-slate-100 dark:bg-slate-900 transition-all duration-200 ${fill ? 'h-full flex flex-col' : ''}`}
      onClick={() => onZoom(src, caption)}
    >
      <div className={`relative overflow-hidden ${fill ? 'flex-1 min-h-0' : 'h-52'}`}>
        <img src={src} alt={caption} className={`w-full h-full ${objectFit === 'contain' ? 'object-contain object-top' : 'object-cover'} transition-transform duration-300 group-hover:scale-105`} />
        <div className="absolute inset-0 bg-black/10 group-hover:bg-black/35 transition-all duration-300" />
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/75 via-black/40 to-transparent p-3">
        <div className="flex items-center gap-1.5 text-slate-900 dark:text-white">
          <ZoomIn className="w-4 h-4 flex-shrink-0" />
          <p className="text-xs font-semibold leading-tight line-clamp-1">{displayLabel}</p>
        </div>
      </div>
    </div>
  );
}

function QuickStatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className="card p-5 text-center bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-brand-500/30 transition-all">
      <Icon className={`w-7 h-7 ${color} mx-auto mb-2`} />
      <div className="text-2xl font-black text-slate-900 dark:text-white">{value}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{label}</div>
    </div>
  );
}

type ScamType = typeof SCAM_TYPES[0] & { images?: Array<{ src: string; caption: string; objectFit?: 'cover' | 'contain' }> };

function ScamTypeCard({ scam, isExpanded, onToggle, onZoom }: { scam: ScamType; isExpanded: boolean; onToggle: () => void; onZoom: (src: string, caption: string) => void }) {
  const Icon = scam.icon;
  const hasImages = scam.images && scam.images.length > 0;
  return (
    <div className={`card overflow-hidden transition-all duration-300 ${isExpanded ? 'border-brand-500/30' : ''}`}>
      <button
        onClick={onToggle}
        className="w-full p-5 flex items-center gap-4 text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
      >
        <div className={`w-10 h-10 rounded-xl ${scam.bg} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-5 h-5 ${scam.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-slate-900 dark:text-white">{scam.title}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1">{scam.summary}</p>
        </div>
        {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />}
      </button>

      {isExpanded && (
        <div className="px-5 pb-5 border-t border-slate-200 dark:border-slate-800">
          <div className={`grid ${hasImages ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-6 pt-4 items-stretch`}>
            <div>
              <h4 className="font-bold text-red-500 dark:text-red-400 text-sm mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />Warning Signs
              </h4>
              <ul className="space-y-2">
                {scam.warningsSigns.map((sign, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 flex-shrink-0" />{sign}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col justify-between">
              <div>
                <h4 className="font-bold text-green-600 dark:text-green-400 text-sm mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4" />What To Do
                </h4>
                <ul className="space-y-2 mb-4">
                  {scam.whatToDo.map((action, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 flex-shrink-0" />{action}
                    </li>
                  ))}
                </ul>
              </div>
              <a href={scam.resource.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-brand-500 hover:underline">
                <ExternalLink className="w-4 h-4" />{scam.resource.label}
              </a>
            </div>
            {hasImages && (
              <div className="flex flex-col gap-3 h-full">
                <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm">Real Examples</h4>
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
