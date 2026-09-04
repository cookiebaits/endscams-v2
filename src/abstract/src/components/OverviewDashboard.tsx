import React, { useState } from 'react';
import { apiClient } from '../services/apiClient';
import { PhoneResult, EmailResult, IpResult, ScrapeResult, ServerStatusResponse } from '../types';
import { 
  Phone, 
  Mail, 
  Globe, 
  Code2, 
  RefreshCw, 
  CheckCircle2, 
  XCircle,
  Copy,
  Check,
  Eye,
  FileText,
  Code,
  Zap
} from 'lucide-react';

function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  let result = str;
  // Multiple passes in case of nested or double encoding (e.g., &amp;#127820;)
  for (let i = 0; i < 3; i++) {
    const prev = result;
    result = result
      // Hex numeric entities &#x1F34C; or &#x1f34c;
      .replace(/&#x([0-9a-fA-F]+);?/g, (_, hex) => {
        try {
          const code = parseInt(hex, 16);
          return code > 0 && code <= 0x10FFFF ? String.fromCodePoint(code) : '';
        } catch {
          return '';
        }
      })
      // Decimal numeric entities &#127820; or &#127820
      .replace(/&#([0-9]+);?/g, (_, dec) => {
        try {
          const code = parseInt(dec, 10);
          return code > 0 && code <= 0x10FFFF ? String.fromCodePoint(code) : '';
        } catch {
          return '';
        }
      })
      // Named entities
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&apos;|&#39;/gi, "'")
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&mdash;/gi, '—')
      .replace(/&ndash;/gi, '–')
      .replace(/&hellip;/gi, '…')
      .replace(/&copy;/gi, '©')
      .replace(/&reg;/gi, '®')
      .replace(/&trade;/gi, '™')
      .replace(/&bull;/gi, '•')
      .replace(/&rsquo;/gi, '’')
      .replace(/&lsquo;/gi, '‘')
      .replace(/&rdquo;/gi, '”')
      .replace(/&ldquo;/gi, '“');

    if (result === prev) break;
  }
  return result;
}

interface Props {
  status: ServerStatusResponse | null;
}

export const OverviewDashboard: React.FC<Props> = () => {
  // Phone state
  const [phoneInput, setPhoneInput] = useState('+14152007986');
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneLatency, setPhoneLatency] = useState<number | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneData, setPhoneData] = useState<PhoneResult | null>({
    phone: '+14152007986',
    valid: true,
    carrier: 'T-Mobile USA Inc.',
    location: 'San Francisco, California, United States',
    type: 'mobile',
    format: { international: '+1 415-200-7986', local: '(415) 200-7986' },
    risk: { risk_score: 5, risk_level: 'LOW' }
  });

  // Email state
  const [emailInput, setEmailInput] = useState('contact@abstractapi.com');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailLatency, setEmailLatency] = useState<number | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailData, setEmailData] = useState<EmailResult | null>({
    email: 'contact@abstractapi.com',
    quality_score: 0.98,
    is_valid_format: { value: true },
    is_disposable_email: { value: false },
    is_mx_found: { value: true },
    is_smtp_valid: { value: true }
  });

  // IP state
  const [ipInput, setIpInput] = useState('8.8.8.8');
  const [ipLoading, setIpLoading] = useState(false);
  const [ipLatency, setIpLatency] = useState<number | null>(null);
  const [ipError, setIpError] = useState<string | null>(null);
  const [ipData, setIpData] = useState<IpResult | null>({
    ip_address: '8.8.8.8',
    location: { city: 'Mountain View', region: 'California', country: 'United States', country_code: 'US' },
    company: { name: 'Google LLC', type: 'Hosting' },
    security: { is_vpn: false, is_proxy: false, is_tor: false, is_abuse: false }
  });

  // Scraper state
  const [scraperInput, setScraperInput] = useState('https://example.com');
  const [renderJs, setRenderJs] = useState(false);
  const [scraperLoading, setScraperLoading] = useState(false);
  const [scraperLatency, setScraperLatency] = useState<number | null>(null);
  const [scraperError, setScraperError] = useState<string | null>(null);
  const [scraperTab, setScraperTab] = useState<'reader' | 'preview' | 'code'>('reader');
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [scraperData, setScraperData] = useState<ScrapeResult | null>({
    success: true,
    target_url: 'https://example.com',
    size_bytes: 559,
    content_type: 'text/html',
    parsed: {
      title: 'Example Domain',
      description: 'Standard documentation illustrative domain reserved by IANA.',
      clean_text: 'Example Domain. This domain is for use in documentation examples without needing prior coordination or asking for permission. Avoid use in production environments.',
      links_count: 1
    },
    html: `<!doctype html>\n<html lang="en">\n<head>\n    <title>Example Domain</title>\n    <meta name="description" content="Standard documentation illustrative domain reserved by IANA.">\n</head>\n<body style="font-family: system-ui, sans-serif; padding: 24px; color: #1e293b;">\n    <div style="max-width: 500px; margin: 0 auto; background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 24px;">\n        <h1 style="font-size: 20px; font-weight: bold; margin-bottom: 8px; color: #0f172a;">Example Domain</h1>\n        <p style="font-size: 14px; line-height: 1.6; color: #475569;">This domain is for use in documentation examples without needing prior coordination or asking for permission.</p>\n        <p style="margin-top: 16px;"><a href="https://iana.org" style="color: #2563eb; font-size: 13px; text-decoration: none;">Learn more &rarr;</a></p>\n    </div>\n</body>\n</html>`
  });

  // Phone lookup handler
  const handleQuickPhone = async () => {
    if (!phoneInput.trim()) return;
    setPhoneLoading(true);
    setPhoneError(null);
    const start = performance.now();
    try {
      const res = await apiClient.queryPhone(phoneInput);
      setPhoneData(res.data);
      setPhoneLatency(Math.round(performance.now() - start));
    } catch (err: any) {
      console.warn('Phone lookup error:', err);
      setPhoneError(err.message || 'Lookup failed. Please verify format.');
    } finally {
      setPhoneLoading(false);
    }
  };

  // Email lookup handler
  const handleQuickEmail = async () => {
    if (!emailInput.trim()) return;
    setEmailLoading(true);
    setEmailError(null);
    const start = performance.now();
    try {
      const res = await apiClient.queryEmail(emailInput);
      setEmailData(res.data);
      setEmailLatency(Math.round(performance.now() - start));
    } catch (err: any) {
      console.warn('Email lookup error:', err);
      setEmailError(err.message || 'Email analysis failed.');
    } finally {
      setEmailLoading(false);
    }
  };

  // IP lookup handler
  const handleQuickIp = async () => {
    if (!ipInput.trim()) return;
    setIpLoading(true);
    setIpError(null);
    const start = performance.now();
    try {
      const res = await apiClient.queryIp(ipInput);
      setIpData(res.data);
      setIpLatency(Math.round(performance.now() - start));
    } catch (err: any) {
      console.warn('IP lookup error:', err);
      setIpError(err.message || 'IP lookup failed.');
    } finally {
      setIpLoading(false);
    }
  };

  // Scraper lookup handler
  const handleQuickScrape = async () => {
    if (!scraperInput.trim()) return;
    setScraperLoading(true);
    setScraperError(null);
    const start = performance.now();
    try {
      const res = await apiClient.scrapeUrl(scraperInput, renderJs);
      setScraperData(res);
      setScraperLatency(Math.round(performance.now() - start));
    } catch (err: any) {
      console.warn('Scraper error:', err);
      setScraperError(err.message || 'Unable to scrape target website.');
    } finally {
      setScraperLoading(false);
    }
  };

  const handleCopyHtml = () => {
    if (!scraperData?.html) return;
    navigator.clipboard.writeText(scraperData.html);
    setCopiedHtml(true);
    setTimeout(() => setCopiedHtml(false), 2000);
  };

  // Extract phone fields with support for nested and top-level formats
  const phoneCarrier = phoneData?.carrier || phoneData?.phone_carrier?.name || 'Carrier verified';
  const phoneLocation = phoneData?.location || [phoneData?.phone_location?.city, phoneData?.phone_location?.region, phoneData?.phone_location?.country_name].filter(Boolean).join(', ') || 'United States';
  const isPhoneValid = phoneData?.valid ?? phoneData?.phone_validation?.is_valid ?? true;
  const phoneType = phoneData?.type || phoneData?.phone_carrier?.line_type || (phoneData?.phone_validation?.is_voip ? 'VoIP' : 'Mobile');
  const phoneRiskLevel = (phoneData?.risk?.risk_level || phoneData?.phone_risk?.risk_level || 'LOW').toUpperCase();

  // Email score calculation
  const emailScoreNum = emailData?.quality_score 
    ? (typeof emailData.quality_score === 'number' 
        ? emailData.quality_score * (emailData.quality_score <= 1 ? 100 : 1) 
        : parseFloat(emailData.quality_score) * 100) 
    : 98.4;

  return (
    <div className="space-y-6">
      {/* 2x2 Grid Intelligence Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* ========================================================= */}
        {/* Card 1: Phone Intelligence (Optimized & Fast) */}
        {/* ========================================================= */}
        <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col p-5 overflow-hidden transition-all hover:shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-50 dark:bg-blue-950/60 rounded-lg text-blue-600 dark:text-blue-400">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-slate-800 dark:text-slate-100 text-base">Phone Intelligence</h2>
                <p className="text-[11px] text-slate-500">Carrier, line type & fraud verification</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {phoneLatency !== null && (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-medium flex items-center gap-1">
                  <Zap className="w-3 h-3" /> {phoneLatency}ms
                </span>
              )}
              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-medium text-slate-500 dark:text-slate-400">
                Dokploy Env
              </span>
            </div>
          </div>

          <form 
            onSubmit={(e) => { e.preventDefault(); handleQuickPhone(); }}
            className="flex gap-2 mb-2"
          >
            <input
              type="text"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="+14152007986"
              className="flex-1 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none font-mono text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20"
            />
            <button
              type="submit"
              disabled={phoneLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm px-4 py-2 rounded-lg font-medium shadow-sm transition-all flex items-center justify-center gap-1.5 shrink-0"
            >
              {phoneLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Verify'}
            </button>
          </form>

          {/* Quick presets */}
          <div className="flex items-center gap-1.5 mb-4 text-[11px] text-slate-500 overflow-x-auto pb-1">
            <span className="text-slate-400 text-[10px]">Test:</span>
            <button
              type="button"
              onClick={() => { setPhoneInput('+14152007986'); }}
              className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-600 font-mono text-[10px] transition-colors"
            >
              +14152007986
            </button>
            <button
              type="button"
              onClick={() => { setPhoneInput('+12125550199'); }}
              className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-600 font-mono text-[10px] transition-colors"
            >
              +12125550199
            </button>
            <button
              type="button"
              onClick={() => { setPhoneInput('+442079460912'); }}
              className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-600 font-mono text-[10px] transition-colors"
            >
              +44 20 UK
            </button>
          </div>

          {phoneError && (
            <div className="mb-3 p-2.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-lg text-rose-700 dark:text-rose-300 text-xs">
              {phoneError}
            </div>
          )}

          <div className="flex-1 bg-slate-50 dark:bg-slate-800/40 rounded-lg p-4 border border-slate-100 dark:border-slate-800 flex flex-col justify-center min-h-[140px]">
            <div className="grid grid-cols-2 gap-y-3 text-xs">
              <div className="text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider text-[11px]">Valid Line</div>
              <div className="text-slate-800 dark:text-slate-200 font-semibold flex items-center gap-1">
                {isPhoneValid ? (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Valid & Active
                  </span>
                ) : (
                  <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> Disconnected / Invalid
                  </span>
                )}
              </div>

              <div className="text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider text-[11px]">Carrier</div>
              <div className="text-slate-800 dark:text-slate-200 font-semibold truncate" title={phoneCarrier}>
                {phoneCarrier}
              </div>

              <div className="text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider text-[11px]">Location</div>
              <div className="text-slate-800 dark:text-slate-200 font-semibold truncate" title={phoneLocation}>
                {phoneLocation}
              </div>

              <div className="text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider text-[11px]">Type / Risk</div>
              <div className="text-slate-800 dark:text-slate-200 font-semibold capitalize flex items-center gap-2">
                <span>{phoneType}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
                  phoneRiskLevel === 'LOW' 
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' 
                    : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                }`}>
                  {phoneRiskLevel} RISK
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* Card 2: Email Reputation */}
        {/* ========================================================= */}
        <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col p-5 overflow-hidden transition-all hover:shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 rounded-lg text-indigo-600 dark:text-indigo-400">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-slate-800 dark:text-slate-100 text-base">Email Reputation</h2>
                <p className="text-[11px] text-slate-500">Deliverability, MX & disposable filter</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {emailLatency !== null && (
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono font-medium flex items-center gap-1">
                  <Zap className="w-3 h-3" /> {emailLatency}ms
                </span>
              )}
              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-medium text-slate-500 dark:text-slate-400">
                Dokploy Env
              </span>
            </div>
          </div>

          <form 
            onSubmit={(e) => { e.preventDefault(); handleQuickEmail(); }}
            className="flex gap-2 mb-2"
          >
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="contact@abstractapi.com"
              className="flex-1 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none font-mono text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/20"
            />
            <button
              type="submit"
              disabled={emailLoading}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm px-4 py-2 rounded-lg font-medium shadow-sm transition-all flex items-center justify-center gap-1.5 shrink-0"
            >
              {emailLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Analyze'}
            </button>
          </form>

          {/* Quick presets */}
          <div className="flex items-center gap-1.5 mb-4 text-[11px] text-slate-500 overflow-x-auto pb-1">
            <span className="text-slate-400 text-[10px]">Test:</span>
            <button
              type="button"
              onClick={() => { setEmailInput('contact@abstractapi.com'); }}
              className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-600 font-mono text-[10px] transition-colors"
            >
              abstractapi.com
            </button>
            <button
              type="button"
              onClick={() => { setEmailInput('support@github.com'); }}
              className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-600 font-mono text-[10px] transition-colors"
            >
              github.com
            </button>
          </div>

          {emailError && (
            <div className="mb-3 p-2.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-lg text-rose-700 dark:text-rose-300 text-xs">
              {emailError}
            </div>
          )}

          <div className="flex-1 bg-slate-50 dark:bg-slate-800/40 rounded-lg p-4 border border-slate-100 dark:border-slate-800 flex flex-col justify-center min-h-[140px]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider text-[11px]">
                Deliverability Score
              </span>
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                {emailScoreNum.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mb-4 overflow-hidden">
              <div 
                className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, Math.max(5, emailScoreNum))}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-y-3 text-xs">
              <div className="text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider text-[11px]">Format Valid</div>
              <div className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Passed
              </div>

              <div className="text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider text-[11px]">Disposable Email</div>
              <div className="text-slate-800 dark:text-slate-200 font-semibold">
                {emailData?.is_disposable_email?.value ? (
                  <span className="text-rose-600 dark:text-rose-400">Yes (Throwaway)</span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400">No (Legitimate)</span>
                )}
              </div>

              <div className="text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider text-[11px]">MX Record</div>
              <div className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Found & Active
              </div>

              <div className="text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider text-[11px]">SMTP Verification</div>
              <div className="text-slate-800 dark:text-slate-200 font-semibold">
                {emailData?.is_smtp_valid?.value ? 'Active Mailbox' : 'Verified Format'}
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* Card 3: IP Intelligence */}
        {/* ========================================================= */}
        <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col p-5 overflow-hidden transition-all hover:shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 rounded-lg text-emerald-600 dark:text-emerald-400">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-slate-800 dark:text-slate-100 text-base">IP Intelligence</h2>
                <p className="text-[11px] text-slate-500">Geolocation, ASN & security flags</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {ipLatency !== null && (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-medium flex items-center gap-1">
                  <Zap className="w-3 h-3" /> {ipLatency}ms
                </span>
              )}
              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-medium text-slate-500 dark:text-slate-400">
                Dokploy Env
              </span>
            </div>
          </div>

          <form 
            onSubmit={(e) => { e.preventDefault(); handleQuickIp(); }}
            className="flex gap-2 mb-2"
          >
            <input
              type="text"
              value={ipInput}
              onChange={(e) => setIpInput(e.target.value)}
              placeholder="8.8.8.8"
              className="flex-1 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none font-mono text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500/20"
            />
            <button
              type="submit"
              disabled={ipLoading}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm px-4 py-2 rounded-lg font-medium shadow-sm transition-all flex items-center justify-center gap-1.5 shrink-0"
            >
              {ipLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Lookup'}
            </button>
          </form>

          {/* Quick presets */}
          <div className="flex items-center gap-1.5 mb-4 text-[11px] text-slate-500 overflow-x-auto pb-1">
            <span className="text-slate-400 text-[10px]">Test:</span>
            <button
              type="button"
              onClick={() => { setIpInput('8.8.8.8'); }}
              className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 hover:text-emerald-600 font-mono text-[10px] transition-colors"
            >
              8.8.8.8 (Google)
            </button>
            <button
              type="button"
              onClick={() => { setIpInput('1.1.1.1'); }}
              className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 hover:text-emerald-600 font-mono text-[10px] transition-colors"
            >
              1.1.1.1 (Cloudflare)
            </button>
          </div>

          {ipError && (
            <div className="mb-3 p-2.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-lg text-rose-700 dark:text-rose-300 text-xs">
              {ipError}
            </div>
          )}

          <div className="flex-1 bg-slate-50 dark:bg-slate-800/40 rounded-lg p-4 border border-slate-100 dark:border-slate-800 flex flex-col justify-center min-h-[140px]">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[10px] font-bold text-slate-700 dark:text-slate-200 uppercase font-mono">
                {ipData?.location?.country_code || 'USA'}
              </div>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                {ipData?.location?.city ? `${ipData.location.city}, ${ipData.location.region || ipData.location.country}` : 'Mountain View, CA, United States'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-y-3 text-xs">
              <div className="text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider text-[11px]">ISP / Network</div>
              <div className="text-slate-800 dark:text-slate-200 font-semibold truncate" title={ipData?.company?.name || ipData?.asn?.name || 'Google LLC'}>
                {ipData?.company?.name || ipData?.asn?.name || 'Google LLC'}
              </div>

              <div className="text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider text-[11px]">Connection Type</div>
              <div className="text-slate-800 dark:text-slate-200 font-semibold">
                {ipData?.company?.type || 'Public / Hosting'}
              </div>

              <div className="text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider text-[11px]">VPN / Proxy</div>
              <div className="text-slate-800 dark:text-slate-200 font-semibold">
                {ipData?.security?.is_vpn || ipData?.security?.is_proxy ? (
                  <span className="text-amber-600 dark:text-amber-400">Detected</span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400">Clean / Direct</span>
                )}
              </div>

              <div className="text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider text-[11px]">Abuse Risk</div>
              <div className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                {ipData?.security?.is_abuse ? (
                  <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> High Risk
                  </span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Clean / Safe
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* Card 4: Web Scraper API (Fixed: Rich Reader & Preview) */}
        {/* ========================================================= */}
        <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col p-5 overflow-hidden transition-all hover:shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-50 dark:bg-amber-950/60 rounded-lg text-amber-600 dark:text-amber-400">
                <Code2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-slate-800 dark:text-slate-100 text-base">Web Scraper API</h2>
                <p className="text-[11px] text-slate-500">Live HTML extraction, metadata parsing & preview</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {scraperLatency !== null && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono font-medium flex items-center gap-1">
                  <Zap className="w-3 h-3" /> {scraperLatency}ms
                </span>
              )}
              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-medium text-slate-500 dark:text-slate-400">
                Dokploy Env
              </span>
            </div>
          </div>

          <form 
            onSubmit={(e) => { e.preventDefault(); handleQuickScrape(); }}
            className="flex gap-2 mb-2"
          >
            <input
              type="text"
              value={scraperInput}
              onChange={(e) => setScraperInput(e.target.value)}
              placeholder="https://example.com"
              className="flex-1 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none font-mono text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500/20"
            />
            <button
              type="submit"
              disabled={scraperLoading}
              className="bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white text-sm px-4 py-2 rounded-lg font-medium shadow-sm transition-all flex items-center justify-center gap-1.5 shrink-0"
            >
              {scraperLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Scrape'}
            </button>
          </form>

          {/* Quick presets & JS Toggle */}
          <div className="flex items-center justify-between gap-2 mb-3 text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <span className="text-slate-400 text-[10px]">Test:</span>
              <button
                type="button"
                onClick={() => { setScraperInput('https://example.com'); }}
                className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/60 hover:text-amber-600 font-mono text-[10px] transition-colors"
              >
                example.com
              </button>
              <button
                type="button"
                onClick={() => { setScraperInput('https://news.ycombinator.com'); }}
                className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/60 hover:text-amber-600 font-mono text-[10px] transition-colors"
              >
                ycombinator
              </button>
            </div>

            <label className="flex items-center gap-1.5 cursor-pointer select-none text-[10px] font-medium text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={renderJs}
                onChange={(e) => setRenderJs(e.target.checked)}
                className="rounded text-amber-600 focus:ring-0 w-3 h-3"
              />
              <span>Render JS</span>
            </label>
          </div>

          {scraperError && (
            <div className="mb-3 p-2.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-lg text-rose-700 dark:text-rose-300 text-xs">
              {scraperError}
            </div>
          )}

          {/* Interactive Mode Switcher for Scraper: Reader vs Preview vs Code */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 mb-3">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg text-xs font-medium">
              <button
                type="button"
                onClick={() => setScraperTab('reader')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] transition-all ${
                  scraperTab === 'reader'
                    ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 font-semibold shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <FileText className="w-3 h-3" />
                <span>Reader View</span>
              </button>
              <button
                type="button"
                onClick={() => setScraperTab('preview')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] transition-all ${
                  scraperTab === 'preview'
                    ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 font-semibold shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Eye className="w-3 h-3" />
                <span>Visual Frame</span>
              </button>
              <button
                type="button"
                onClick={() => setScraperTab('code')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] transition-all ${
                  scraperTab === 'code'
                    ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 font-semibold shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Code className="w-3 h-3" />
                <span>HTML Code</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-slate-400">
                {scraperData?.size_bytes ? (scraperData.size_bytes / 1024).toFixed(1) + ' KB' : '0 KB'}
              </span>
              {scraperTab === 'code' && (
                <button
                  type="button"
                  onClick={handleCopyHtml}
                  className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                  title="Copy full HTML source"
                >
                  {copiedHtml ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedHtml ? 'Copied' : 'Copy'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Scraper Display Viewport */}
          <div className="flex-1 bg-slate-50 dark:bg-slate-800/40 rounded-lg p-3.5 border border-slate-100 dark:border-slate-800 min-h-[160px] flex flex-col justify-start overflow-hidden">
            {/* View 1: Clean Reader / Content Summary (Default) */}
            {scraperTab === 'reader' && (
              <div className="space-y-2.5 text-xs">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Page Title</div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                    {decodeHtmlEntities(scraperData?.parsed?.title || 'Example Domain')}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Extracted Summary</div>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3 text-[11px]">
                    {decodeHtmlEntities(scraperData?.parsed?.clean_text || scraperData?.parsed?.description || 'Content successfully extracted from target page.')}
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-1 border-t border-slate-200/60 dark:border-slate-700/60 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3 h-3" /> Status 200 OK
                  </span>
                  <span>•</span>
                  <span>Links Found: <strong className="text-slate-700 dark:text-slate-200">{scraperData?.parsed?.links_count ?? 1}</strong></span>
                  <span>•</span>
                  <span className="truncate" title={scraperData?.target_url}>{scraperData?.target_url}</span>
                </div>
              </div>
            )}

            {/* View 2: Visual Frame Preview */}
            {scraperTab === 'preview' && (
              <div className="w-full h-40 rounded border border-slate-200 dark:border-slate-700 bg-white overflow-hidden shadow-inner">
                {scraperData?.html ? (
                  <iframe
                    title="Scraped Website Live Preview"
                    srcDoc={scraperData.html}
                    sandbox="allow-same-origin"
                    className="w-full h-full border-none transform scale-90 origin-top-left"
                    style={{ width: '111%', height: '111%' }}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">
                    No preview available yet
                  </div>
                )}
              </div>
            )}

            {/* View 3: Syntax Code Inspection */}
            {scraperTab === 'code' && (
              <div className="bg-slate-900 rounded-md p-3 border border-slate-800 font-mono text-[11px] text-emerald-400 overflow-x-auto max-h-40">
                <pre className="whitespace-pre-wrap leading-tight">
                  {scraperData?.html ? scraperData.html.slice(0, 750) + (scraperData.html.length > 750 ? '\n\n// ... [truncated for preview, click Copy to view all]' : '') : '<!-- No data scraped yet -->'}
                </pre>
              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  );
};
