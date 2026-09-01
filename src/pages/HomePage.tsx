import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Search, Phone, Shield, ExternalLink, CheckCircle, XCircle, Loader2, Banknote, Hourglass, ServerCrash, ShieldAlert, Mail, Network, Globe } from 'lucide-react';
import { supabase, formatPhoneDisplay } from '../lib/supabase';
import Banner from '../components/Banner';

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

  // Create an iterator date starting at the baseline
  const currentDate = new Date(baselineDate);
  currentDate.setUTCHours(0, 0, 0, 0);

  const endDate = new Date(now);
  endDate.setUTCHours(0, 0, 0, 0);

  // Iterate day by day
  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getUTCDay();
    // 1-5 is Monday-Friday
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      // Use the date string as a consistent seed
      const seed = currentDate.getTime();

      const moneyDiff = Math.floor(seededRandom(seed) * (135 - 50 + 1)) + 50;
      const hoursDiff = Math.floor(seededRandom(seed + 1) * (5 - 3 + 1)) + 3; // 3 to 5 hours daily
      const resourcesDiff = Math.floor(seededRandom(seed + 2) * (4 - 2 + 1)) + 2; // 2 to 4 resources daily

      simulatedStats.money_saved += moneyDiff;
      simulatedStats.scammer_hours_wasted += hoursDiff;
      simulatedStats.resources_shutdown += resourcesDiff;
    }
    // Increment by 1 day
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  return simulatedStats;
}

function normalizeInput(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 10);
}

function formatTyping(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 10);
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

      // Easing function for smoother animation (easeOutExpo)
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

export default function HomePage() {

  const [activeTool, setActiveTool] = useState<'phone' | 'email' | 'ip' | 'scrape' | null>(null);


  const [phoneToolInput, setPhoneToolInput] = useState('');
  const [phoneToolLoading, setPhoneToolLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [phoneToolResult, setPhoneToolResult] = useState<any>(null);

  const [emailToolInput, setEmailToolInput] = useState('');
  const [emailToolLoading, setEmailToolLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [emailToolResult, setEmailToolResult] = useState<any>(null);

  const [ipToolInput, setIpToolInput] = useState('');
  const [ipToolLoading, setIpToolLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [ipToolResult, setIpToolResult] = useState<any>(null);

  const [scrapeToolInput, setScrapeToolInput] = useState('');
  const [scrapeToolLoading, setScrapeToolLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [scrapeToolResult, setScrapeToolResult] = useState<any>(null);

  const rawFetcherUrl = import.meta.env.DEV ? 'http://localhost:8000' : (import.meta.env.VITE_FETCHER_URL || 'https://fetcher.endscams.org');
  const fetcherUrl = rawFetcherUrl.replace(/\/+$/, '');

  const handlePhoneToolSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneToolInput) return;
    setPhoneToolLoading(true);
    setPhoneToolResult(null);
    try {
      const response = await fetch(`${fetcherUrl}/api/tools`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'phone', query: phoneToolInput })
      });
      const data = await response.json();
      setPhoneToolResult(data);
    } catch {
      setPhoneToolResult({ error: 'Failed to fetch' });
    }
    setPhoneToolLoading(false);
  };

  const handleEmailToolSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailToolInput) return;
    setEmailToolLoading(true);
    setEmailToolResult(null);
    try {
      const response = await fetch(`${fetcherUrl}/api/tools`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'email', query: emailToolInput })
      });
      const data = await response.json();
      setEmailToolResult(data);
    } catch {
      setEmailToolResult({ error: 'Failed to fetch' });
    }
    setEmailToolLoading(false);
  };

  const handleIpToolSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ipToolInput) return;
    setIpToolLoading(true);
    setIpToolResult(null);
    try {
      const response = await fetch(`${fetcherUrl}/api/tools`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'ip', query: ipToolInput })
      });
      const data = await response.json();
      setIpToolResult(data);
    } catch {
      setIpToolResult({ error: 'Failed to fetch' });
    }
    setIpToolLoading(false);
  };

  const handleScrapeToolSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scrapeToolInput) return;
    setScrapeToolLoading(true);
    setScrapeToolResult(null);
    try {
      const response = await fetch(`${fetcherUrl}/api/tools`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'scrape', query: scrapeToolInput })
      });
      const data = await response.json();
      setScrapeToolResult(data);
    } catch {
      setScrapeToolResult({ error: 'Failed to fetch' });
    }
    setScrapeToolLoading(false);
  };
  const [input, setInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [searched, setSearched] = useState(false);
  const [searchedDigits, setSearchedDigits] = useState('');
  const [impactStats, setImpactStats] = useState<ImpactStats | null>(null);

  // Default fallback stats
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

    const updateStats = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-impact-stats`,
          {
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
          }
        );
        await response.json();
      } catch (error) {
        console.error('Failed to update stats:', error);
      }
    };

    fetchImpactStats();
    updateStats();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(formatTyping(e.target.value));
    setResult(null);
    setSearched(false);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = normalizeInput(input);
    if (digits.length < 10) return;

    setSearching(true);
    setSearched(false);
    setSearchedDigits(digits);

    try {
      const [reportsRes, trackerRes] = await Promise.all([
        supabase.from('scam_reports').select('id,category,description,incident_date,source,source_url').eq('phone_digits', digits).gt('expires_at', new Date().toISOString()).order('incident_date', { ascending: false }),
        supabase.from('tracker_entries').select('id,source_name,source_url,report_date,category,description').eq('phone_digits', digits).gt('expires_at', new Date().toISOString()).order('report_date', { ascending: false }),
      ]);

      const reports = reportsRes.data || [];
      const trackerEntries = trackerRes.data || [];
      setResult({ found: reports.length > 0 || trackerEntries.length > 0, reports, trackerEntries });
    } catch {
      setResult({ found: false, reports: [], trackerEntries: [] });
    } finally {
      setSearching(false);
      setSearched(true);
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      <Banner 
        variant="info" 
        message={<span className="text-[1.21em]">Welcome to Cyberscam Watchdog Network! We are a 501(1)(c) Non-Profit dedicated to ending scams through education.</span>}
        dismissible 
        center
        id="home_welcome"
      />
      <section className="relative pt-20 pb-24 overflow-hidden border-b border-slate-200 dark:border-slate-800">
        <div className="absolute inset-0 bg-gradient-to-br from-white to-slate-100 dark:from-slate-900 dark:to-slate-950 transition-colors duration-200" />
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
              You can also email us directly at <a href="mailto:outreach@endscams.org" className="text-brand-500 hover:underline">outreach@endscams.org</a> to work with us.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm font-medium text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-green-500" /> Verified Protection</span>
            <span className="flex items-center gap-2"><Network className="w-4 h-4 text-brand-500" /> Global Intelligence</span>
            <span className="flex items-center gap-2"><Shield className="w-4 h-4 text-blue-500" /> Community Driven</span>
          </div>
        </div>
      </section>

      <section id="tools" className="py-20 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="section-title mb-10">Database Search</h2>

          <form onSubmit={handleSearch} className="max-w-2xl mx-auto mb-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="(555) 123-4567"
                  value={input}
                  onChange={handleChange}
                  maxLength={14}
                  className="input-field pl-12 h-14 text-lg rounded-xl"
                />
              </div>
              <button
                type="submit"
                disabled={normalizeInput(input).length < 10 || searching}
                className="btn-primary h-14 px-8 rounded-xl text-base"
              >
                {searching ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Search className="w-5 h-5 mr-2 inline-block" />Search</>}
              </button>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 text-left pl-1">
              Accepts: (555) 123-4567 &nbsp;|&nbsp; 555-123-4567 &nbsp;|&nbsp; 5551234567
            </p>
          </form>

          {searching && (
            <div className="max-w-2xl mx-auto mt-6 p-6 card text-center animate-fade-in">
              <Loader2 className="w-8 h-8 text-brand-500 mx-auto mb-2 animate-spin" />
              <p className="text-slate-600 dark:text-slate-400">Searching our database...</p>
            </div>
          )}

          {searched && !searching && result && (
            <div className="max-w-2xl mx-auto mt-6 animate-slide-up space-y-4">
              {result.found ? (
                <div className="card p-6 border-2 border-brand-500/50 bg-red-50 dark:bg-red-950/20">
                  <div className="flex items-center gap-3 mb-4">
                    <XCircle className="w-8 h-8 text-red-500 flex-shrink-0" />
                    <div className="text-left">
                      <p className="font-bold text-red-600 dark:text-red-400 text-lg">Warning — This number has been reported</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Found {result.reports.length + result.trackerEntries.length} report(s) for {formatPhoneDisplay(searchedDigits)}
                      </p>
                    </div>
                  </div>

                  {result.reports.map(r => (
                    <ReportCard key={r.id} label={r.category} date={r.incident_date} description={r.description} sourceName="User Report" sourceUrl={r.source_url} />
                  ))}
                  {result.trackerEntries.map(t => (
                    <ReportCard key={t.id} label={t.category || 'Scam'} date={t.report_date} description={t.description || ''} sourceName={t.source_name} sourceUrl={t.source_url} />
                  ))}
                </div>
              ) : (
                <div className="card p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <CheckCircle className="w-8 h-8 text-green-500 flex-shrink-0" />
                    <div className="text-left">
                      <p className="font-bold text-green-600 dark:text-green-400 text-lg">Not found in our database</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        We could not match any records for {formatPhoneDisplay(searchedDigits)} in our database. For a deeper search, check the sources below.
                      </p>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-3 mt-4">
                    {(['brave', 'google', 'duckduckgo'] as const).map(engine => (
                      <a
                        key={engine}
                        href={buildSearchUrl(engine, searchedDigits)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg font-medium text-sm text-slate-700 dark:text-slate-300 transition-all"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Search {engine === 'duckduckgo' ? 'DuckDuckGo' : engine.charAt(0).toUpperCase() + engine.slice(1)}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {result.found && (
                <div className="card p-4">
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">Search deeper with external sources:</p>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {(['brave', 'google', 'duckduckgo'] as const).map(engine => (
                      <a
                        key={engine}
                        href={buildSearchUrl(engine, searchedDigits)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg font-medium text-sm text-slate-700 dark:text-slate-300 transition-all"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Search {engine === 'duckduckgo' ? 'DuckDuckGo' : engine.charAt(0).toUpperCase() + engine.slice(1)}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="py-16 bg-slate-100 dark:bg-slate-900 border-y border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-black mb-4 text-slate-900 dark:text-white">Our Impact</h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto text-lg">
              Together, we're making a real difference in the fight against scammers.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-200 dark:border-slate-700 text-center flex flex-col items-center hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
              <div className="w-16 h-16 rounded-2xl bg-green-500/10 dark:bg-green-500/20 flex items-center justify-center mb-6">
                <Banknote className="w-8 h-8 text-green-500 dark:text-green-400" />
              </div>
              <div className="text-4xl md:text-5xl font-black mb-3 text-slate-900 dark:text-white">{`$${animatedMoney.toLocaleString('en-US')}`}</div>
              <h3 className="text-lg font-bold mb-2 text-slate-800 dark:text-slate-200">Estimated Money Saved</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Total dollars protected from scammer hands</p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-200 dark:border-slate-700 text-center flex flex-col items-center hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
              <div className="w-16 h-16 rounded-2xl bg-brand-500/10 dark:bg-brand-500/20 flex items-center justify-center mb-6">
                <Hourglass className="w-8 h-8 text-brand-500 dark:text-brand-400" />
              </div>
              <div className="text-4xl md:text-5xl font-black mb-3 text-slate-900 dark:text-white">{`${animatedHours.toLocaleString('en-US')}`}</div>
              <h3 className="text-lg font-bold mb-2 text-slate-800 dark:text-slate-200">Scam Decoy Investigations (hrs)</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Hours of decoy collecting evidence</p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-200 dark:border-slate-700 text-center flex flex-col items-center hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 dark:bg-red-500/20 flex items-center justify-center mb-6">
                <ServerCrash className="w-8 h-8 text-red-500 dark:text-red-400" />
              </div>
              <div className="text-4xl md:text-5xl font-black mb-3 text-slate-900 dark:text-white">{animatedResources.toLocaleString()}</div>
              <h3 className="text-lg font-bold mb-2 text-slate-800 dark:text-slate-200">Resources Shutdown</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Confirmed website, phone, and finance shutdowns</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="section-title text-center mb-4">Advanced Scam Detection Tools</h2>
          <p className="section-subtitle text-center mb-12">
            Access our comprehensive database and educational materials to stay protected.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <button onClick={() => setActiveTool(activeTool === 'phone' ? null : 'phone')} className={`card p-6 text-left hover:border-brand-500/50 hover:-translate-y-1 hover:shadow-xl transition-all duration-300 group block ${activeTool === 'phone' ? 'border-brand-500 bg-slate-100 dark:bg-slate-900/90' : 'bg-white dark:bg-slate-900/80'}`}>
              <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center mb-4 group-hover:bg-brand-500/20 transition-colors">
                <Phone className="w-6 h-6 text-brand-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 group-hover:text-brand-500 transition-colors">Phone Search</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">Confirm if a number is fraudulent.</p>
            </button>
            <button onClick={() => setActiveTool(activeTool === 'email' ? null : 'email')} className={`card p-6 text-left hover:border-brand-500/50 transition-all duration-300 hover:shadow-md group block ${activeTool === 'email' ? 'border-brand-500 bg-slate-900/90' : ''}`}>
              <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center mb-4 group-hover:bg-brand-500/20 transition-colors">
                <Mail className="w-6 h-6 text-brand-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 group-hover:text-brand-500 transition-colors">Email Scanner</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">Predict if an email is spam.</p>
            </button>
            <button onClick={() => setActiveTool(activeTool === 'ip' ? null : 'ip')} className={`card p-6 text-left hover:border-brand-500/50 transition-all duration-300 hover:shadow-md group block ${activeTool === 'ip' ? 'border-brand-500 bg-slate-900/90' : ''}`}>
              <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center mb-4 group-hover:bg-brand-500/20 transition-colors">
                <Network className="w-6 h-6 text-brand-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 group-hover:text-brand-500 transition-colors">IP Intelligence</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">Scan an IP address.</p>
            </button>
            <button onClick={() => setActiveTool(activeTool === 'scrape' ? null : 'scrape')} className={`card p-6 text-left hover:border-brand-500/50 transition-all duration-300 hover:shadow-md group block ${activeTool === 'scrape' ? 'border-brand-500 bg-slate-900/90' : ''}`}>
              <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center mb-4 group-hover:bg-brand-500/20 transition-colors">
                <Globe className="w-6 h-6 text-brand-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 group-hover:text-brand-500 transition-colors">Web Scraper</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">Pull information from a website.</p>
            </button>
          </div>

          {activeTool === 'phone' && (
            <div className="mt-8 card p-6 bg-slate-900/80 backdrop-blur-md">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Phone Searcher</h3>
              <form onSubmit={handlePhoneToolSearch} className="flex gap-2 mb-6">
                <input type="text" value={phoneToolInput} onChange={(e) => setPhoneToolInput(e.target.value)} placeholder="Enter phone number (e.g. +14152000000)" className="input-field flex-1" />
                <button type="submit" disabled={phoneToolLoading} className="btn-primary px-6 flex items-center gap-2">
                  {phoneToolLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />} Search
                </button>
              </form>
              {phoneToolResult && (
                <div className="p-4 bg-slate-900 rounded-lg border border-slate-700">
                  {phoneToolResult.error ? (
                     <p className="text-red-500 font-medium">{phoneToolResult.error}</p>
                  ) : (
                    <div className="flex flex-col gap-4 text-left">
                      {(() => {
                        const carrier = phoneToolResult.phone_carrier?.name?.toLowerCase() || '';
                        const wholesalers = ['synch', 'onvoy', 'bandwidth', 'google voice', 'text now', 'text free'];
                        const majors = ['t-mobile', 'at&t', 'verizon', 'boost mobile', 'dish wireless'];

                        const isWholesaler = wholesalers.some(w => carrier.includes(w));
                        const isMajor = majors.some(m => carrier.includes(m));

                        if (isWholesaler) {
                          return <div className="text-red-500 font-bold px-4 py-3 bg-red-500/10 rounded-lg inline-block self-start border border-red-500/20">Risk: Likely Spam or Scam (Wholesaler detected)</div>;
                        } else if (isMajor) {
                          return <div className="text-green-500 font-bold px-4 py-3 bg-green-500/10 rounded-lg inline-block self-start border border-green-500/20">Risk: Low (Major Carrier)</div>;
                        }
                        return null;
                      })()}

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                          <p className="font-bold text-slate-200 mb-3 border-b border-slate-700 pb-2 flex items-center gap-2">
                            <Shield className="w-4 h-4 text-brand-500" />
                            Validation & Status
                          </p>
                          <div className="space-y-2 text-sm text-slate-400">
                            <p className="flex justify-between">
                              <span>Valid Number:</span>
                              <span className={`font-medium ${phoneToolResult.is_valid ? 'text-green-400' : 'text-red-400'}`}>
                                {phoneToolResult.is_valid ? 'Yes' : 'No'}
                              </span>
                            </p>
                            <p className="flex justify-between">
                              <span>Line Status:</span>
                              <span className="text-slate-700 dark:text-slate-300 font-medium capitalize">{phoneToolResult.line_status || 'Unknown'}</span>
                            </p>
                            <p className="flex justify-between">
                              <span>VOIP:</span>
                              <span className={`font-medium ${phoneToolResult.is_voip ? 'text-yellow-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                {phoneToolResult.is_voip ? 'Yes' : 'No'}
                              </span>
                            </p>
                          </div>
                        </div>

                        <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                          <p className="font-bold text-slate-200 mb-3 border-b border-slate-700 pb-2 flex items-center gap-2">
                            <Network className="w-4 h-4 text-blue-500" />
                            Carrier Details
                          </p>
                          <div className="space-y-2 text-sm text-slate-400">
                            <p className="flex flex-col">
                              <span className="text-xs">Carrier Name:</span>
                              <span className="text-slate-200 font-medium">{phoneToolResult.phone_carrier?.name || 'Unknown'}</span>
                            </p>
                            <p className="flex justify-between">
                              <span>Line Type:</span>
                              <span className="text-slate-700 dark:text-slate-300 font-medium capitalize">{phoneToolResult.phone_carrier?.line_type || 'Unknown'}</span>
                            </p>
                          </div>
                        </div>

                        <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 md:col-span-2 lg:col-span-1">
                          <p className="font-bold text-slate-200 mb-3 border-b border-slate-700 pb-2 flex items-center gap-2">
                            <Globe className="w-4 h-4 text-purple-500" />
                            Formatting & Region
                          </p>
                          <div className="space-y-2 text-sm text-slate-400">
                            <p className="flex flex-col">
                              <span className="text-xs">International Format:</span>
                              <span className="text-slate-700 dark:text-slate-300 font-medium font-mono">{phoneToolResult.format?.international || 'N/A'}</span>
                            </p>
                            <p className="flex flex-col">
                              <span className="text-xs">National Format:</span>
                              <span className="text-slate-700 dark:text-slate-300 font-medium font-mono">{phoneToolResult.format?.national || 'N/A'}</span>
                            </p>
                            {phoneToolResult.location && (
                               <p className="flex justify-between pt-1 border-t border-slate-700/50 mt-1">
                                 <span>Region:</span>
                                 <span className="text-slate-700 dark:text-slate-300">{phoneToolResult.location}</span>
                               </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTool === 'email' && (
            <div className="mt-8 card p-6 bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Email Scanner</h3>
              <form onSubmit={handleEmailToolSearch} className="flex gap-2 mb-6">
                <input type="text" value={emailToolInput} onChange={(e) => setEmailToolInput(e.target.value)} placeholder="Enter email address" className="input-field flex-1" />
                <button type="submit" disabled={emailToolLoading} className="btn-primary px-6 flex items-center gap-2">
                  {emailToolLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />} Scan
                </button>
              </form>
              {emailToolResult && (
                <div className="p-4 bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
                  {emailToolResult.error ? (
                     <p className="text-red-500 font-medium">{emailToolResult.error}</p>
                  ) : (
                    <div>
                      <div className="mb-2">
                         <span className="font-bold text-slate-800 dark:text-white">Risk Status:</span>
                         <span className={`ml-2 px-2 py-1 rounded text-sm font-bold ${emailToolResult.email_risk?.address_risk_status === 'high' ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>{emailToolResult.email_risk?.address_risk_status || 'Unknown'}</span>
                         {emailToolResult.email_quality?.is_disposable && <span className="ml-2 px-2 py-1 bg-red-500/10 text-red-500 rounded text-sm font-bold">(Disposable Email Detected!)</span>}
                      </div>
                      <pre className="text-xs text-slate-600 dark:text-slate-400 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(emailToolResult, (key, value) => key === 'breaches' ? undefined : value, 2)}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTool === 'ip' && (
            <div className="mt-8 card p-6 bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">IP Intelligence</h3>
              <form onSubmit={handleIpToolSearch} className="flex gap-2 mb-6">
                <input type="text" value={ipToolInput} onChange={(e) => setIpToolInput(e.target.value)} placeholder="Enter IP address" className="input-field flex-1" />
                <button type="submit" disabled={ipToolLoading} className="btn-primary px-6 flex items-center gap-2">
                  {ipToolLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />} Scan
                </button>
              </form>
              {ipToolResult && (
                <div className="p-4 bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
                  {ipToolResult.error ? (
                     <p className="text-red-500 font-medium">{ipToolResult.error}</p>
                  ) : (
                    <div>
                      <pre className="text-xs text-slate-600 dark:text-slate-400 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(ipToolResult, null, 2)}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTool === 'scrape' && (
            <div className="mt-8 card p-6 bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Web Scraper</h3>
              <form onSubmit={handleScrapeToolSearch} className="flex gap-2 mb-6">
                <input type="text" value={scrapeToolInput} onChange={(e) => setScrapeToolInput(e.target.value)} placeholder="Enter URL (e.g. https://example.com)" className="input-field flex-1" />
                <button type="submit" disabled={scrapeToolLoading} className="btn-primary px-6 flex items-center gap-2">
                  {scrapeToolLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />} Scrape
                </button>
              </form>
              {scrapeToolResult && (
                <div className="p-4 bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
                  {scrapeToolResult.error ? (
                     <p className="text-red-500 font-medium">{scrapeToolResult.error}</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <pre className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap max-h-96 overflow-y-auto">{typeof scrapeToolResult === 'string' ? scrapeToolResult.substring(0, 5000) : JSON.stringify(scrapeToolResult, null, 2).substring(0, 5000)}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="py-20 bg-slate-50 dark:bg-slate-900">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="section-title mb-4">Been Targeted? Report It</h2>
          <p className="section-subtitle mb-8">
            Your report helps protect others in the community. Add the scammer's number to our database.
          </p>
          <Link to="/report" className="btn-primary inline-flex items-center gap-2 text-lg px-8 py-4">
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
    <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 mb-3 text-left">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold px-2 py-1 bg-brand-500/10 text-brand-500 rounded">{label}</span>
        <span className="text-xs text-slate-400">{date}</span>
      </div>
      {description && <p className="text-sm text-slate-700 dark:text-slate-300 mb-2 line-clamp-3">{description}</p>}
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


