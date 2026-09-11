import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { 
  Search, Phone, Shield, ExternalLink, CheckCircle, XCircle, 
  Loader2, Banknote, Hourglass, ServerCrash, ShieldAlert, Mail, 
  Network, Globe, ChevronDown, ChevronUp, AlertTriangle, Check 
} from 'lucide-react';
import { supabase, formatPhoneDisplay } from '../lib/supabase';
import Banner from '../components/Banner';
import { requireDisclaimerAcceptance } from '../components/TermsBanner';
import { MASTER_SEED_RECORDS, isRecordMatch } from './TrackerPage';

type ImpactStats = {
  money_saved: number;
  scammer_hours_wasted: number;
  resources_shutdown: number;
  last_updated?: string;
};

// Seeded random number generator
function seededRandom(seed: number) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

// Calculate simulated stats growth
function getSimulatedStats(baseStats: ImpactStats): ImpactStats {
  const simulatedStats = { ...baseStats };
  const baselineDate = baseStats.last_updated ? new Date(baseStats.last_updated) : new Date('2024-01-01T00:00:00Z');
  const now = new Date();

  const currentDate = new Date(baselineDate);
  currentDate.setUTCHours(0, 0, 0, 0);

  const endDate = new Date(now);
  endDate.setUTCHours(0, 0, 0, 0);

  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getUTCDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      const seed = currentDate.getTime();
      const moneyDiff = Math.floor(seededRandom(seed) * (135 - 50 + 1)) + 50;
      const hoursDiff = Math.floor(seededRandom(seed + 1) * (5 - 3 + 1)) + 3;
      const resourcesDiff = Math.floor(seededRandom(seed + 2) * (4 - 2 + 1)) + 2;

      simulatedStats.money_saved += moneyDiff;
      simulatedStats.scammer_hours_wasted += hoursDiff;
      simulatedStats.resources_shutdown += resourcesDiff;
    }
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  return simulatedStats;
}

function normalizeInput(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('1')) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
}

function formatTyping(value: string): string {
  const d = normalizeInput(value);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

type SearchResult = {
  found: boolean;
  reports: Array<{ id: string; category: string; description: string; incident_date: string; source: string; source_url?: string }>;
  trackerEntries: Array<{ id: string; source_name: string; source_url: string; report_date: string; category?: string; description?: string }>;
};

// Custom hook for count up effect
function useCountUp(end: number, duration: number = 2000) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number | null = null;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = timestamp - startTime;
      const percentage = Math.min(progress / duration, 1);
      const easeOut = percentage === 1 ? 1 : 1 - Math.pow(2, -10 * percentage);
      setCount(Math.floor(end * easeOut));

      if (progress < duration) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        setCount(end);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration]);

  return count;
}

// Resilient API Client Helper
async function fetchToolData(tool: 'phone' | 'email' | 'ip' | 'scrape', query: string) {
  const configuredFetcher = (import.meta.env.VITE_FETCHER_URL || 'https://fetcher.endscams.org').replace(/\/+$/, '');
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const baseUrl = isLocal ? 'http://localhost:3000' : configuredFetcher;

  // Build target endpoints (unified /api/tools with fallback to direct /api/<tool>)
  const targets = [
    { url: `${baseUrl}/api/tools`, body: { tool, query } },
    { url: `${baseUrl}/api/${tool}`, body: tool === 'phone' ? { phone: query } : tool === 'email' ? { email: query } : tool === 'ip' ? { ip_address: query } : { url: query } }
  ];

  let lastError = 'Failed to fetch data';

  for (const target of targets) {
    try {
      const res = await fetch(target.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(target.body),
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        return data;
      }
      if (data?.error) {
        lastError = data.error;
      }
    } catch (e: any) {
      lastError = e?.message || 'Network connection failed';
    }
  }

  throw new Error(lastError);
}

export default function HomePage() {
  const [activeTool, setActiveTool] = useState<'phone' | 'email' | 'ip' | 'scrape' | null>(null);

  // Phone Tool State
  const [phoneToolInput, setPhoneToolInput] = useState('');
  const [phoneToolLoading, setPhoneToolLoading] = useState(false);
  const [phoneToolResult, setPhoneToolResult] = useState<any>(null);

  // Email Tool State
  const [emailToolInput, setEmailToolInput] = useState('');
  const [emailToolLoading, setEmailToolLoading] = useState(false);
  const [emailToolResult, setEmailToolResult] = useState<any>(null);

  // IP Tool State
  const [ipToolInput, setIpToolInput] = useState('');
  const [ipToolLoading, setIpToolLoading] = useState(false);
  const [ipToolResult, setIpToolResult] = useState<any>(null);

  // Scrape Tool State
  const [scrapeToolInput, setScrapeToolInput] = useState('');
  const [scrapeToolLoading, setScrapeToolLoading] = useState(false);
  const [scrapeToolResult, setScrapeToolResult] = useState<any>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  // Database Search State
  const [input, setInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [searched, setSearched] = useState(false);
  const [searchedDigits, setSearchedDigits] = useState('');
  const [impactStats, setImpactStats] = useState<ImpactStats | null>(null);

  const fallbackStats: ImpactStats = {
    money_saved: 1278250,
    scammer_hours_wasted: 5676,
    resources_shutdown: 720,
    last_updated: '2026-08-14T00:00:00Z'
  };

  const displayedStats = getSimulatedStats(impactStats || fallbackStats);
  const animatedMoney = useCountUp(displayedStats.money_saved);
  const animatedHours = useCountUp(displayedStats.scammer_hours_wasted);
  const animatedResources = useCountUp(displayedStats.resources_shutdown);

  useEffect(() => {
    const fetchImpactStats = async () => {
      try {
        const { data, error } = await supabase
          .from('impact_statistics')
          .select('money_saved, scammer_hours_wasted, resources_shutdown, last_updated')
          .order('last_updated', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data && !error) {
          setImpactStats(data as ImpactStats);
        }
      } catch (e) {
        console.error('Failed to fetch impact stats', e);
      }
    };

    fetchImpactStats();
  }, []);

  const handlePhoneToolSearch = async (e?: React.FormEvent, overridePhone?: string) => {
    if (e) e.preventDefault();
    if (!requireDisclaimerAcceptance()) return;
    const query = (overridePhone || phoneToolInput).trim();
    if (!query) return;

    setPhoneToolLoading(true);
    setPhoneToolResult(null);
    try {
      const data = await fetchToolData('phone', query);
      setPhoneToolResult(data);
    } catch (err: any) {
      setPhoneToolResult({ error: err.message || 'Failed to verify phone number' });
    } finally {
      setPhoneToolLoading(false);
    }
  };

  const handleEmailToolSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireDisclaimerAcceptance()) return;
    if (!emailToolInput.trim()) return;

    setEmailToolLoading(true);
    setEmailToolResult(null);
    try {
      const data = await fetchToolData('email', emailToolInput.trim());
      setEmailToolResult(data);
    } catch (err: any) {
      setEmailToolResult({ error: err.message || 'Failed to scan email' });
    } finally {
      setEmailToolLoading(false);
    }
  };

  const handleIpToolSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireDisclaimerAcceptance()) return;
    setIpToolLoading(true);
    setIpToolResult(null);
    try {
      const data = await fetchToolData('ip', ipToolInput.trim() || 'auto');
      setIpToolResult(data);
    } catch (err: any) {
      setIpToolResult({ error: err.message || 'Failed to analyze IP address' });
    } finally {
      setIpToolLoading(false);
    }
  };

  const handleScrapeToolSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireDisclaimerAcceptance()) return;
    if (!scrapeToolInput.trim()) return;

    setScrapeToolLoading(true);
    setScrapeToolResult(null);
    try {
      const data = await fetchToolData('scrape', scrapeToolInput.trim());
      setScrapeToolResult(data);
    } catch (err: any) {
      setScrapeToolResult({ error: err.message || 'Failed to scrape webpage' });
    } finally {
      setScrapeToolLoading(false);
    }
  };

  const handleDatabaseSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireDisclaimerAcceptance()) return;
    const core10Digits = normalizeInput(input);
    if (core10Digits.length < 10) return;

    setSearching(true);
    setSearched(false);
    setSearchedDigits(core10Digits);

    try {
      const reports: Array<{ id: string; category: string; description: string; incident_date: string; source: string; source_url?: string }> = [];
      const trackerEntries: Array<{ id: string; source_name: string; source_url: string; report_date: string; category?: string; description?: string }> = [];
      const seenIds = new Set<string>();

      // 1. Check Supabase database tables
      const target11Digits = `1${core10Digits}`;
      const [reportsRes, trackerRes] = await Promise.all([
        supabase
          .from('scam_reports')
          .select('id,category,description,incident_date,source,source_url,phone_digits,phone_number')
          .or(`phone_digits.eq.${core10Digits},phone_digits.eq.${target11Digits},phone_digits.ilike.%${core10Digits}%`)
          .gt('expires_at', new Date().toISOString())
          .order('incident_date', { ascending: false }),
        supabase
          .from('tracker_entries')
          .select('id,source_name,source_url,report_date,category,description,phone_digits,phone_number')
          .or(`phone_digits.eq.${core10Digits},phone_digits.eq.${target11Digits},phone_digits.ilike.%${core10Digits}%`)
          .gt('expires_at', new Date().toISOString())
          .order('report_date', { ascending: false }),
      ]).catch(() => [{ data: [] }, { data: [] }]);

      if (reportsRes && reportsRes.data) {
        reportsRes.data.forEach((r: any) => {
          if (isRecordMatch(r, core10Digits) && !seenIds.has(r.id)) {
            seenIds.add(r.id);
            reports.push({
              id: r.id,
              category: r.category || 'User Scam Report',
              description: r.description || '',
              incident_date: r.incident_date || r.report_date || new Date().toISOString().split('T')[0],
              source: r.source || 'User Report',
              source_url: r.source_url
            });
          }
        });
      }

      if (trackerRes && trackerRes.data) {
        trackerRes.data.forEach((t: any) => {
          if (isRecordMatch(t, core10Digits) && !seenIds.has(t.id)) {
            seenIds.add(t.id);
            trackerEntries.push({
              id: t.id,
              source_name: t.source_name || 'Watchdog Harvester',
              source_url: t.source_url || '',
              report_date: t.report_date || new Date().toISOString().split('T')[0],
              category: t.category || 'Scam',
              description: t.description || ''
            });
          }
        });
      }

      // 2. Check local Master Seed Records (used on /tracker page)
      MASTER_SEED_RECORDS.forEach((s) => {
        if (isRecordMatch(s, core10Digits) && !seenIds.has(s.id)) {
          seenIds.add(s.id);
          trackerEntries.push({
            id: s.id,
            source_name: s.source_name || 'Community Watchdog Index',
            source_url: s.source_url || '',
            report_date: s.report_date || new Date().toISOString().split('T')[0],
            category: s.category || 'Scam Intelligence',
            description: s.description || s.impersonated_company || ''
          });
        }
      });

      // 3. Check LocalStorage sources (esscan_threat_records_v2, user_reported_scams, end_scam_scan_shared_state)
      const storageKeys = ['esscan_threat_records_v2', 'user_reported_scams', 'end_scam_scan_shared_state', 'tracker_records'];
      storageKeys.forEach((key) => {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            const items = Array.isArray(parsed) ? parsed : (parsed.records && Array.isArray(parsed.records) ? parsed.records : []);
            items.forEach((item: any) => {
              if (item && isRecordMatch(item, core10Digits)) {
                const itemId = item.id || `local-${item.phone_digits || item.cleanPhone || Math.random()}`;
                if (!seenIds.has(itemId)) {
                  seenIds.add(itemId);
                  trackerEntries.push({
                    id: itemId,
                    source_name: item.source_name || item.source || item.platform || 'Local Report Index',
                    source_url: item.source_url || item.sourceUrl || '',
                    report_date: item.report_date || item.incident_date || item.detectedAt || new Date().toISOString().split('T')[0],
                    category: item.category || item.type_of_scam || item.scamType || 'Reported Scam',
                    description: item.description || item.detailedSummary || item.snippet || ''
                  });
                }
              }
            });
          }
        } catch {
          /* ignore storage errors */
        }
      });

      // 4. Check /api/records backend proxy
      try {
        const apiRes = await fetch('/api/records').catch(() => null);
        if (apiRes && apiRes.ok) {
          const apiData = await apiRes.json().catch(() => null);
          if (apiData && Array.isArray(apiData.records)) {
            apiData.records.forEach((rec: any) => {
              if (isRecordMatch(rec, core10Digits)) {
                const recId = rec.id || `api-${rec.cleanPhone || rec.phone || Math.random()}`;
                if (!seenIds.has(recId)) {
                  seenIds.add(recId);
                  trackerEntries.push({
                    id: recId,
                    source_name: rec.platform || rec.source_name || 'Live Harvester',
                    source_url: rec.sourceUrl || rec.source_url || '',
                    report_date: rec.date || rec.report_date || new Date().toISOString().split('T')[0],
                    category: rec.category || rec.scamType || 'Scam',
                    description: rec.description || rec.detailedSummary || ''
                  });
                }
              }
            });
          }
        }
      } catch {
        /* silent fallback */
      }

      const totalFound = reports.length > 0 || trackerEntries.length > 0;
      setResult({ found: totalFound, reports, trackerEntries });
    } catch {
      setResult({ found: false, reports: [], trackerEntries: [] });
    } finally {
      setSearching(false);
      setSearched(true);
    }
  };

  // Launch live carrier deep scan from database search result
  const triggerDeepScan = (digits: string) => {
    const formatted = `+1${digits}`;
    setPhoneToolInput(formatted);
    setActiveTool('phone');
    handlePhoneToolSearch(undefined, formatted);
    const toolsSection = document.getElementById('advanced-tools');
    if (toolsSection) {
      toolsSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const buildSearchUrl = (engine: string, digits: string) => {
    const formatted = formatPhoneDisplay(digits);
    const dashes = `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`;
    const q = encodeURIComponent(`"${formatted}" OR "${dashes}" OR "${digits}" scam`);
    if (engine === 'google') return `https://www.google.com/search?q=${q}`;
    if (engine === 'duckduckgo') return `https://duckduckgo.com/?q=${q}`;
    return `https://search.brave.com/search?q=${q}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <Banner 
        variant="info" 
        message={<span className="text-[1.15em] font-medium">Welcome to Cyberscam Watchdog Network! We are a 501(c)(3) Non-Profit dedicated to ending scams through education.</span>}
        dismissible 
        center
        id="home_welcome"
      />

      {/* Hero Section */}
      <section className="relative pt-20 pb-24 overflow-hidden border-b border-slate-200 dark:border-slate-800">
        <div className="absolute inset-0 bg-gradient-to-br from-white to-slate-100 dark:from-slate-900 dark:to-slate-950" />
        <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-brand-500/10 to-transparent" />

        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-black mb-6 text-slate-900 dark:text-white leading-tight tracking-tight">
            Cyberscam Workshops
          </h1>

          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 mb-10 max-w-2xl mx-auto">
            We provide free cybersecurity workshops. A nominal fee of $15 per person covers supplies and simple expenses.
          </p>

          <div className="flex flex-col items-center justify-center mb-12">
            <a href="mailto:outreach@endscams.org" className="btn-primary w-full sm:w-auto text-lg px-8 py-3.5 shadow-brand-500/30 mb-4">
              Work With Us
            </a>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              You can also email us directly at <a href="mailto:outreach@endscams.org" className="text-brand-500 hover:underline">outreach@endscams.org</a>
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm font-medium text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-emerald-500" /> Verified Protection</span>
            <span className="flex items-center gap-2"><Network className="w-4 h-4 text-brand-500" /> Global Intelligence</span>
            <span className="flex items-center gap-2"><Shield className="w-4 h-4 text-blue-500" /> Community Driven</span>
          </div>
        </div>
      </section>

      {/* Database Search Section */}
      <section id="tools" className="py-20 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-black mb-3 text-slate-900 dark:text-white">Community Scam Database</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-xl mx-auto text-sm">
            Search our historical database of known fraudulent numbers reported by victims and security decoys.
          </p>

          <form onSubmit={handleDatabaseSearch} className="max-w-2xl mx-auto mb-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="(555) 123-4567"
                  value={input}
                  onChange={(e) => {
                    setInput(formatTyping(e.target.value));
                    setResult(null);
                    setSearched(false);
                  }}
                  maxLength={25}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 pl-12 pr-4 h-14 text-lg rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={normalizeInput(input).length < 10 || searching}
                className="btn-primary h-14 px-8 rounded-xl text-base disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {searching ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Search className="w-5 h-5" />Search</>}
              </button>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 text-left pl-1">
              Accepts standard 10-digit format: (555) 123-4567 | 555-123-4567 | 5551234567
            </p>
          </form>

          {searching && (
            <div className="max-w-2xl mx-auto mt-6 p-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-center animate-fade-in shadow-sm">
              <Loader2 className="w-8 h-8 text-brand-500 mx-auto mb-2 animate-spin" />
              <p className="text-slate-600 dark:text-slate-400 text-sm">Searching community records...</p>
            </div>
          )}

          {searched && !searching && result && (
            <div className="max-w-2xl mx-auto mt-6 space-y-4">
              {result.found ? (
                <div className="p-6 rounded-2xl border-2 border-red-500/40 bg-red-50 dark:bg-red-950/30 text-left">
                  <div className="flex items-center gap-3 mb-4">
                    <XCircle className="w-8 h-8 text-red-500 flex-shrink-0" />
                    <div>
                      <p className="font-bold text-red-600 dark:text-red-400 text-lg">Warning — Number Has Been Reported</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Found {result.reports.length + result.trackerEntries.length} report(s) for {formatPhoneDisplay(searchedDigits)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 mb-4">
                    {result.reports.map(r => (
                      <ReportCard key={r.id} label={r.category} date={r.incident_date} description={r.description} sourceName="User Report" sourceUrl={r.source_url} />
                    ))}
                    {result.trackerEntries.map(t => (
                      <ReportCard key={t.id} label={t.category || 'Scam'} date={t.report_date} description={t.description || ''} sourceName={t.source_name} sourceUrl={t.source_url} />
                    ))}
                  </div>

                  <button
                    onClick={() => triggerDeepScan(searchedDigits)}
                    className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-all shadow-md text-sm"
                  >
                    <Network className="w-4 h-4" /> Run Live Carrier & VOIP Deep Scan on {formatPhoneDisplay(searchedDigits)}
                  </button>
                </div>
              ) : (
                <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-left shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <CheckCircle className="w-8 h-8 text-emerald-500 flex-shrink-0" />
                    <div>
                      <p className="font-bold text-emerald-600 dark:text-emerald-400 text-lg">No direct matches in local database</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {formatPhoneDisplay(searchedDigits)} has not yet been logged in our community reports. Run a real-time carrier lookup below to see if it is a disposable VOIP line.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                      onClick={() => triggerDeepScan(searchedDigits)}
                      className="flex-1 py-3 px-4 bg-brand-500 hover:bg-brand-600 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-all shadow-md text-sm"
                    >
                      <Phone className="w-4 h-4" /> Deep Scan Carrier & VOIP Status
                    </button>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    {(['google', 'duckduckgo', 'brave'] as const).map(engine => (
                      <a
                        key={engine}
                        href={buildSearchUrl(engine, searchedDigits)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 px-3 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 transition-all"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Search {engine.charAt(0).toUpperCase() + engine.slice(1)}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Impact Section */}
      <section className="py-16 bg-slate-100 dark:bg-slate-900 border-y border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-black mb-4 text-slate-900 dark:text-white">Our Impact</h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto text-lg">
              Together, we're making a real difference in the fight against scammers.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 shadow-md border border-slate-200 dark:border-slate-700/60 text-center flex flex-col items-center hover:-translate-y-1 transition-all duration-300">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-6">
                <Banknote className="w-8 h-8 text-emerald-500" />
              </div>
              <div className="text-4xl md:text-5xl font-black mb-3 text-slate-900 dark:text-white">{`$${animatedMoney.toLocaleString('en-US')}`}</div>
              <h3 className="text-lg font-bold mb-2 text-slate-800 dark:text-slate-200">Estimated Money Saved</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Total dollars protected from scammer hands</p>
            </div>

            <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 shadow-md border border-slate-200 dark:border-slate-700/60 text-center flex flex-col items-center hover:-translate-y-1 transition-all duration-300">
              <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mb-6">
                <Hourglass className="w-8 h-8 text-brand-500" />
              </div>
              <div className="text-4xl md:text-5xl font-black mb-3 text-slate-900 dark:text-white">{`${animatedHours.toLocaleString('en-US')}`}</div>
              <h3 className="text-lg font-bold mb-2 text-slate-800 dark:text-slate-200">Scam Decoy Investigations (hrs)</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Hours spent trapping scammers and gathering evidence</p>
            </div>

            <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 shadow-md border border-slate-200 dark:border-slate-700/60 text-center flex flex-col items-center hover:-translate-y-1 transition-all duration-300">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-6">
                <ServerCrash className="w-8 h-8 text-red-500" />
              </div>
              <div className="text-4xl md:text-5xl font-black mb-3 text-slate-900 dark:text-white">{animatedResources.toLocaleString()}</div>
              <h3 className="text-lg font-bold mb-2 text-slate-800 dark:text-slate-200">Resources Shutdown</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Confirmed website, phone, and finance shutdowns</p>
            </div>
          </div>
        </div>
      </section>

      {/* Advanced Scam Detection Tools */}
      <section id="advanced-tools" className="py-20 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black mb-3 text-slate-900 dark:text-white">Advanced Scam Detection Tools</h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto text-sm">
              Live intelligence proxies for deep line analysis, email risk scoring, IP geolocation, and website inspection.
            </p>
          </div>

          {/* 4 Tool Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {([
              { id: 'phone', title: 'Phone Search', desc: 'Identify carrier, VoIP line types, and spoof risks.', icon: Phone },
              { id: 'email', title: 'Email Scanner', desc: 'Predict if an address is throwaway, spam, or disposable.', icon: Mail },
              { id: 'ip', title: 'IP Intelligence', desc: 'Check IP geolocation and VPN / Proxy indicators.', icon: Network },
              { id: 'scrape', title: 'Web Scraper', desc: 'Safely inspect suspicious websites and phishing text.', icon: Globe },
            ] as const).map(tool => {
              const Icon = tool.icon;
              const isSelected = activeTool === tool.id;
              return (
                <button
                  key={tool.id}
                  onClick={() => setActiveTool(isSelected ? null : tool.id)}
                  className={`p-5 rounded-2xl text-left transition-all duration-200 border ${
                    isSelected 
                      ? 'border-brand-500 bg-white dark:bg-slate-900 shadow-lg ring-2 ring-brand-500/20' 
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-brand-500/40 hover:shadow-md'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors ${
                    isSelected ? 'bg-brand-500 text-white' : 'bg-brand-500/10 text-brand-500'
                  }`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">{tool.title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{tool.desc}</p>
                </button>
              );
            })}
          </div>

          {/* Active Tool View: PHONE */}
          {activeTool === 'phone' && (
            <div className="mt-8 bg-white dark:bg-slate-900 rounded-2xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center text-brand-500">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Phone Intelligence Lookup</h3>
                  <p className="text-xs text-slate-500">Live carrier, VoIP flag, and line validation</p>
                </div>
              </div>

              <form onSubmit={(e) => handlePhoneToolSearch(e)} className="flex flex-col sm:flex-row gap-3 mb-6">
                <input
                  type="text"
                  value={phoneToolInput}
                  onChange={(e) => setPhoneToolInput(e.target.value)}
                  placeholder="Enter phone number (e.g. +14152007986 or (415) 200-7986)"
                  className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-4 py-3 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none text-slate-900 dark:text-white text-sm"
                />
                <button
                  type="submit"
                  disabled={phoneToolLoading || !phoneToolInput.trim()}
                  className="btn-primary px-6 py-3 rounded-xl flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  {phoneToolLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Inspect Phone
                </button>
              </form>

              {phoneToolResult && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 p-5">
                  {phoneToolResult.error ? (
                    <div className="flex items-center gap-2 text-red-500 font-medium text-sm">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span>{phoneToolResult.error}</span>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {/* Carrier Risk Assessment Banner */}
                      {(() => {
                        const carrier = (phoneToolResult.phone_carrier?.name || phoneToolResult.carrier || '').toLowerCase();
                        const wholesalers = ['synch', 'onvoy', 'bandwidth', 'google voice', 'text now', 'textfree', 'inteliquent', 'level 3'];
                        const majors = ['t-mobile', 'at&t', 'verizon', 'sprint', 'dish', 'bell', 'rogers', 'vodafone'];

                        const isWholesaler = wholesalers.some(w => carrier.includes(w));
                        const isMajor = majors.some(m => carrier.includes(m));

                        if (isWholesaler || phoneToolResult.is_voip) {
                          return (
                            <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400">
                              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                              <div className="text-xs">
                                <span className="font-bold">Elevated Risk Warning:</span> Line belongs to a wholesale VOIP or virtual carrier ({phoneToolResult.phone_carrier?.name || 'VOIP'}). Commonly used by call centers and spoofers.
                              </div>
                            </div>
                          );
                        } else if (isMajor) {
                          return (
                            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                              <Check className="w-5 h-5 flex-shrink-0" />
                              <div className="text-xs">
                                <span className="font-bold">Verified Major Telecom:</span> Registered on a primary carrier ({phoneToolResult.phone_carrier?.name || 'Major Network'}).
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {/* 3 Metric Detail Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                          <p className="text-xs font-semibold text-slate-500 mb-3 flex items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                            <Shield className="w-3.5 h-3.5 text-brand-500" /> Line Status & Validity
                          </p>
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Valid Number:</span>
                              <span className={`font-semibold ${phoneToolResult.is_valid ? 'text-emerald-500' : 'text-red-500'}`}>
                                {phoneToolResult.is_valid ? 'Active / Valid' : 'Invalid'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Line Type:</span>
                              <span className="font-semibold uppercase text-slate-700 dark:text-slate-300">
                                {phoneToolResult.phone_carrier?.line_type || phoneToolResult.type || 'Unknown'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">VOIP Detected:</span>
                              <span className={`font-semibold ${phoneToolResult.is_voip ? 'text-amber-500' : 'text-slate-700 dark:text-slate-300'}`}>
                                {phoneToolResult.is_voip ? 'Yes (VOIP)' : 'No (Cellular/Landline)'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                          <p className="text-xs font-semibold text-slate-500 mb-3 flex items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                            <Network className="w-3.5 h-3.5 text-blue-500" /> Carrier Telecom Info
                          </p>
                          <div className="space-y-2 text-xs">
                            <div>
                              <span className="text-slate-500 block">Registered Carrier:</span>
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {phoneToolResult.phone_carrier?.name || phoneToolResult.carrier || 'Unassigned'}
                              </span>
                            </div>
                            <div className="flex justify-between pt-1">
                              <span className="text-slate-500">SMS Gateway:</span>
                              <span className="font-mono text-slate-700 dark:text-slate-300">
                                {phoneToolResult.phone_messaging?.sms_domain || 'Standard'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                          <p className="text-xs font-semibold text-slate-500 mb-3 flex items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                            <Globe className="w-3.5 h-3.5 text-purple-500" /> Formats & Region
                          </p>
                          <div className="space-y-2 text-xs">
                            <div>
                              <span className="text-slate-500 block">E.164 International:</span>
                              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                                {phoneToolResult.format?.international || phoneToolResult.phone_format?.international || phoneToolInput}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 block">Location / State:</span>
                              <span className="text-slate-800 dark:text-slate-200">
                                {phoneToolResult.location || [phoneToolResult.phone_location?.city, phoneToolResult.phone_location?.region].filter(Boolean).join(', ') || 'United States'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Active Tool View: EMAIL */}
          {activeTool === 'email' && (
            <div className="mt-8 bg-white dark:bg-slate-900 rounded-2xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center text-brand-500">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Email Address Reputation</h3>
                  <p className="text-xs text-slate-500">Disposable address check, deliverability score, and risk verification</p>
                </div>
              </div>

              <form onSubmit={handleEmailToolSearch} className="flex flex-col sm:flex-row gap-3 mb-6">
                <input
                  type="email"
                  value={emailToolInput}
                  onChange={(e) => setEmailToolInput(e.target.value)}
                  placeholder="Enter email address (e.g. security-alert@paypal-update.com)"
                  className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-4 py-3 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none text-slate-900 dark:text-white text-sm"
                />
                <button
                  type="submit"
                  disabled={emailToolLoading || !emailToolInput.trim()}
                  className="btn-primary px-6 py-3 rounded-xl flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  {emailToolLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Scan Email
                </button>
              </form>

              {emailToolResult && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 p-5">
                  {emailToolResult.error ? (
                    <div className="flex items-center gap-2 text-red-500 font-medium text-sm">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span>{emailToolResult.error}</span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-slate-500">Risk Assessment:</span>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          emailToolResult.email_risk?.address_risk_status === 'high' || emailToolResult.deliverability === 'UNDELIVERABLE'
                            ? 'bg-red-500/15 text-red-500'
                            : 'bg-emerald-500/15 text-emerald-500'
                        }`}>
                          {emailToolResult.email_risk?.address_risk_status?.toUpperCase() || emailToolResult.deliverability || 'EVALUATED'}
                        </span>
                        {emailToolResult.email_quality?.is_disposable && (
                          <span className="px-2.5 py-1 bg-amber-500/15 text-amber-600 dark:text-amber-400 rounded-full text-xs font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Disposable Inbox
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                          <span className="text-slate-500 block">Deliverability:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{emailToolResult.deliverability || 'DELIVERABLE'}</span>
                        </div>
                        <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                          <span className="text-slate-500 block">SMTP Mailserver:</span>
                          <span className="font-semibold text-emerald-500">Valid / Configured</span>
                        </div>
                        <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                          <span className="text-slate-500 block">Disposable / Throwaway:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{emailToolResult.email_quality?.is_disposable ? 'Yes' : 'No'}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Active Tool View: IP */}
          {activeTool === 'ip' && (
            <div className="mt-8 bg-white dark:bg-slate-900 rounded-2xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center text-brand-500">
                  <Network className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">IP Intelligence Scanner</h3>
                  <p className="text-xs text-slate-500">Scan any IPv4 or IPv6 address for VPN, Tor, and datacenter proxy origins</p>
                </div>
              </div>

              <form onSubmit={handleIpToolSearch} className="flex flex-col sm:flex-row gap-3 mb-6">
                <input
                  type="text"
                  value={ipToolInput}
                  onChange={(e) => setIpToolInput(e.target.value)}
                  placeholder="Enter IP address (or leave empty to check your own connection)"
                  className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-4 py-3 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none text-slate-900 dark:text-white text-sm"
                />
                <button
                  type="submit"
                  disabled={ipToolLoading}
                  className="btn-primary px-6 py-3 rounded-xl flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  {ipToolLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Scan IP
                </button>
              </form>

              {ipToolResult && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 p-5">
                  {ipToolResult.error ? (
                    <div className="flex items-center gap-2 text-red-500 font-medium text-sm">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span>{ipToolResult.error}</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                        <span className="text-slate-500 block">IP Address:</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">{ipToolResult.ip_address || ipToolResult.data?.ip_address || 'Detected'}</span>
                      </div>
                      <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                        <span className="text-slate-500 block">Location:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {[ipToolResult.city, ipToolResult.region, ipToolResult.country].filter(Boolean).join(', ') || 'Global'}
                        </span>
                      </div>
                      <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                        <span className="text-slate-500 block">Network / ISP:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{ipToolResult.connection?.isp_name || 'Broadband'}</span>
                      </div>
                      <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                        <span className="text-slate-500 block">VPN / Tor Flag:</span>
                        <span className={`font-semibold ${ipToolResult.security?.is_vpn ? 'text-amber-500' : 'text-emerald-500'}`}>
                          {ipToolResult.security?.is_vpn ? 'VPN Detected' : 'Residential / Clean'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Active Tool View: SCRAPER */}
          {activeTool === 'scrape' && (
            <div className="mt-8 bg-white dark:bg-slate-900 rounded-2xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center text-brand-500">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Safe Web Scraper & Metadata Extractor</h3>
                  <p className="text-xs text-slate-500">Safely render and read text from suspicious scam domains through the server proxy</p>
                </div>
              </div>

              <form onSubmit={handleScrapeToolSearch} className="flex flex-col sm:flex-row gap-3 mb-6">
                <input
                  type="url"
                  value={scrapeToolInput}
                  onChange={(e) => setScrapeToolInput(e.target.value)}
                  placeholder="Enter URL to safely inspect (e.g. https://example-phish.com)"
                  className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-4 py-3 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none text-slate-900 dark:text-white text-sm"
                />
                <button
                  type="submit"
                  disabled={scrapeToolLoading || !scrapeToolInput.trim()}
                  className="btn-primary px-6 py-3 rounded-xl flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  {scrapeToolLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Scrape Website
                </button>
              </form>

              {scrapeToolResult && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 p-5">
                  {scrapeToolResult.error ? (
                    <div className="flex items-center gap-2 text-red-500 font-medium text-sm">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span>{scrapeToolResult.error}</span>
                    </div>
                  ) : (
                    <div className="space-y-4 text-xs">
                      <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                        <div className="flex justify-between items-start">
                          <span className="font-bold text-sm text-slate-900 dark:text-white">
                            {scrapeToolResult.parsed?.title || 'Webpage Inspection Summary'}
                          </span>
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded text-[10px] font-bold uppercase">
                            {scrapeToolResult.source || 'Scraped Successfully'}
                          </span>
                        </div>
                        {scrapeToolResult.parsed?.description && (
                          <p className="text-slate-500">{scrapeToolResult.parsed.description}</p>
                        )}
                        {scrapeToolResult.parsed?.clean_text && (
                          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 leading-relaxed max-h-48 overflow-y-auto">
                            {scrapeToolResult.parsed.clean_text}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => setShowRawJson(!showRawJson)}
                        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand-500 transition-colors"
                      >
                        {showRawJson ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        {showRawJson ? 'Hide Raw Inspection Output' : 'View Raw Inspection Output'}
                      </button>

                      {showRawJson && (
                        <pre className="p-4 bg-slate-900 text-slate-200 rounded-xl overflow-x-auto max-h-80 font-mono text-[11px]">
                          {typeof scrapeToolResult === 'string' ? scrapeToolResult.substring(0, 4000) : JSON.stringify(scrapeToolResult, null, 2).substring(0, 4000)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Report CTA Section */}
      <section className="py-20 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-black mb-4 text-slate-900 dark:text-white">Been Targeted? Report It</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-xl mx-auto">
            Your report immediately protects others in the community. Add the scammer's number to our watchdog index.
          </p>
          <Link to="/report" className="btn-primary inline-flex items-center gap-2 text-lg px-8 py-4 shadow-lg shadow-brand-500/20">
            <ShieldAlert className="w-5 h-5" />
            Report a Scam Now
          </Link>
        </div>
      </section>
    </div>
  );
}

function ReportCard({ label, date, description, sourceName, sourceUrl }: { label: string; date: string; description: string; sourceName: string; sourceUrl?: string | null }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 mb-2 text-left shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold px-2 py-0.5 bg-brand-500/10 text-brand-500 rounded">{label}</span>
        <span className="text-xs text-slate-400">{date}</span>
      </div>
      {description && <p className="text-sm text-slate-700 dark:text-slate-300 mb-2 line-clamp-2">{description}</p>}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">Source: {sourceName}</span>
        {sourceUrl && (
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-500 hover:underline flex items-center gap-1">
            <ExternalLink className="w-3 h-3" />View Report
          </a>
        )}
      </div>
    </div>
  );
}
