import React, { useState, useEffect } from 'react';
import { 
  Search, Phone, Shield, ExternalLink,
  Loader2, Banknote, Hourglass, ServerCrash, ShieldAlert, Mail, 
  Network, Globe, ChevronDown, ChevronUp, AlertTriangle, Check,
  X, Info
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import CommunityScamDatabaseSearch from '../components/CommunityScamDatabaseSearch';

// ============================================================================
// 1. UNIFIED PHONE NUMBER MATCHING CODE (isRecordMatch)
// ============================================================================

/**
 * Universally matches any phone number input against threat database records.
 * Supports all user formats:
 * - (555) 123-4567
 * - 555-123-4567
 * - 5551234567
 * - 15551234567
 * - +1 (555) 123-4567
 * - +234 813 816 1886
 * - +254... / +27... / International
 * 
 * Strictly matches full 10-digit North American telephone numbers (Area Code + Prefix + Line)
 * to prevent false positives from sharing 7-digit substrings across different area codes.
 */
export function isRecordMatch(record: Record<string, unknown>, targetInput: string): boolean {
  if (!record || !targetInput) return false;
  const rawTarget = String(targetInput).trim();
  const cleanTarget = rawTarget.replace(/\D/g, '');
  if (!cleanTarget || cleanTarget.length < 7) return false;

  // 10-digit North American core
  let target10 = cleanTarget;
  if (cleanTarget.length === 11 && cleanTarget.startsWith('1')) {
    target10 = cleanTarget.slice(1);
  }

  // Collect all potential digit variants from the record
  const candidateDigits: string[] = [];
  const addVal = (val: unknown) => {
    if (!val) return;
    const d = String(val).replace(/\D/g, '');
    if (d && !candidateDigits.includes(d)) candidateDigits.push(d);
  };

  addVal(record.phone_digits);
  addVal(record.clean_phone);
  addVal(record.cleanPhone);
  addVal(record.phone_number);
  addVal(record.phone);
  addVal(record.alt_phone);

  if (Array.isArray(record.alt_numbers)) {
    for (const alt of record.alt_numbers) {
      if (typeof alt === 'string') {
        addVal(alt);
      } else if (alt && typeof alt === 'object' && alt !== null) {
        const altObj = alt as Record<string, unknown>;
        addVal(altObj.digits);
        addVal(altObj.phone);
      }
    }
  }

  for (const cDigits of candidateDigits) {
    if (!cDigits) continue;

    // 1. Exact raw digits match
    if (cDigits === cleanTarget) return true;

    let c10 = cDigits;
    if (cDigits.length === 11 && cDigits.startsWith('1')) {
      c10 = cDigits.slice(1);
    }

    // 2. Full 10-digit North American Match (Area code + Exchange + Number)
    if (target10.length === 10 && c10.length === 10) {
      if (target10 === c10) return true;
    }

    // 3. 11-digit vs 10-digit North American Match
    if (target10.length === 10) {
      if (cDigits === `1${target10}` || cDigits === target10) return true;
    }
    if (c10.length === 10) {
      if (cleanTarget === `1${c10}` || cleanTarget === c10) return true;
    }

    // 4. International prefix match (Nigeria: 234 vs local 0..., Kenya: 254 vs local 0..., etc.)
    if (cleanTarget.startsWith('234') && cDigits.startsWith('0') && cDigits.slice(1) === cleanTarget.slice(3)) {
      return true;
    }
    if (cDigits.startsWith('234') && cleanTarget.startsWith('0') && cleanTarget.slice(1) === cDigits.slice(3)) {
      return true;
    }
    if (cleanTarget.startsWith('254') && cDigits.startsWith('0') && cDigits.slice(1) === cleanTarget.slice(3)) {
      return true;
    }
    if (cDigits.startsWith('254') && cleanTarget.startsWith('0') && cleanTarget.slice(1) === cDigits.slice(3)) {
      return true;
    }

    // 5. Full international match
    if (cleanTarget.length >= 10 && cDigits.length >= 10 && cleanTarget === cDigits) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// 2. HELPER UTILITIES & STATS
// ============================================================================

export type ImpactStats = {
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
export function getSimulatedStats(baseStats: ImpactStats): ImpactStats {
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

export function formatPhoneDisplay(raw: string): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.startsWith('234') && digits.length >= 10) {
    return `+234 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  if (digits.startsWith('254') && digits.length >= 10) {
    return `+254 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  return raw.startsWith('+') ? raw : (digits.length > 10 ? `+${digits}` : digits);
}

export function normalizeInput(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  return digits;
}

export function formatTyping(value: string): string {
  if (value.startsWith('+')) {
    return value;
  }
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 11)}`;
  }
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

export type SearchResult = {
  found: boolean;
  reports: Array<{ id: string; category: string; description: string; incident_date: string; source: string; source_url?: string }>;
  trackerEntries: Array<{ id: string; source_name: string; source_url: string; report_date: string; category?: string; description?: string }>;
};

// Custom hook for count up animation effect
export function useCountUp(end: number, duration: number = 2000) {
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

// Resilient API Client Helper for the 4 Advanced Tools
async function fetchToolData(tool: 'phone' | 'email' | 'ip' | 'scrape', query: string) {
  const configuredFetcher = (import.meta.env.VITE_FETCHER_URL || '').replace(/\/+$/, '');
  const baseUrl = configuredFetcher || '';

  // Target endpoints supporting /api/tools, /api/<tool>, and /api/scam-tools/<tool>
  const targets = [
    { url: `${baseUrl}/api/tools`, body: { tool, query } },
    { url: `${baseUrl}/api/${tool}`, body: tool === 'phone' ? { phone: query } : tool === 'email' ? { email: query } : tool === 'ip' ? { ip_address: query } : { url: query } },
    { url: `${baseUrl}/api/scam-tools/${tool === 'scrape' ? 'domain' : tool}`, body: tool === 'phone' ? { phone: query } : tool === 'email' ? { email: query } : tool === 'ip' ? { ip: query } : { domain: query } }
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
    } catch (e: unknown) {
      lastError = e instanceof Error ? e.message : 'Network connection failed';
    }
  }

  throw new Error(lastError);
}

// ============================================================================
// 3. MAIN HOMEPAGE COMPONENT
// ============================================================================

export interface HomePageProps {
  onNavigateToTracker?: (searchQuery?: string) => void;
  onNavigateToReport?: (prefilledPhone?: string) => void;
}

export default function HomePage({ onNavigateToTracker, onNavigateToReport }: HomePageProps) {
  const [activeTool, setActiveTool] = useState<'phone' | 'email' | 'ip' | 'scrape' | null>(null);

  // Phone Tool State
  const [phoneToolInput, setPhoneToolInput] = useState('');
  const [phoneToolLoading, setPhoneToolLoading] = useState(false);
  const [phoneToolResult, setPhoneToolResult] = useState<Record<string, any> | null>(null);

  // Email Tool State
  const [emailToolInput, setEmailToolInput] = useState('');
  const [emailToolLoading, setEmailToolLoading] = useState(false);
  const [emailToolResult, setEmailToolResult] = useState<Record<string, any> | null>(null);

  // IP Tool State
  const [ipToolInput, setIpToolInput] = useState('');
  const [ipToolLoading, setIpToolLoading] = useState(false);
  const [ipToolResult, setIpToolResult] = useState<Record<string, any> | null>(null);

  // Scrape Tool State
  const [scrapeToolInput, setScrapeToolInput] = useState('');
  const [scrapeToolLoading, setScrapeToolLoading] = useState(false);
  const [scrapeToolResult, setScrapeToolResult] = useState<Record<string, any> | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  const [impactStats, setImpactStats] = useState<ImpactStats | null>(null);

  // Banner dismiss state
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);

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

  // Load Supabase Client & Impact Stats
  useEffect(() => {
    async function initSupabase() {
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const config = await res.json();
          if (config.supabaseUrl && config.supabaseKey) {
            const sb = createClient(config.supabaseUrl, config.supabaseKey);

            const { data } = await sb
              .from('impact_statistics')
              .select('money_saved, scammer_hours_wasted, resources_shutdown, last_updated')
              .order('last_updated', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (data) {
              setImpactStats(data as ImpactStats);
            }
          }
        }
      } catch (e) {
        console.warn('Failed to fetch impact stats or config', e);
      }
    }

    initSupabase();
  }, []);

  const handlePhoneToolSearch = async (e?: React.FormEvent, overridePhone?: string) => {
    if (e) e.preventDefault();
    const query = (overridePhone || phoneToolInput).trim();
    if (!query) return;

    setPhoneToolLoading(true);
    setPhoneToolResult(null);
    try {
      const data = await fetchToolData('phone', query);
      setPhoneToolResult(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to verify phone number';
      setPhoneToolResult({ error: msg });
    } finally {
      setPhoneToolLoading(false);
    }
  };

  const handleEmailToolSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailToolInput.trim()) return;

    setEmailToolLoading(true);
    setEmailToolResult(null);
    try {
      const data = await fetchToolData('email', emailToolInput.trim());
      setEmailToolResult(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to scan email';
      setEmailToolResult({ error: msg });
    } finally {
      setEmailToolLoading(false);
    }
  };

  const handleIpToolSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIpToolLoading(true);
    setIpToolResult(null);
    try {
      const data = await fetchToolData('ip', ipToolInput.trim() || 'auto');
      setIpToolResult(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to analyze IP address';
      setIpToolResult({ error: msg });
    } finally {
      setIpToolLoading(false);
    }
  };

  const handleScrapeToolSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scrapeToolInput.trim()) return;

    setScrapeToolLoading(true);
    setScrapeToolResult(null);
    try {
      const data = await fetchToolData('scrape', scrapeToolInput.trim());
      setScrapeToolResult(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to scrape webpage';
      setScrapeToolResult({ error: msg });
    } finally {
      setScrapeToolLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Welcome Banner */}
      {!isBannerDismissed && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-900 dark:text-amber-200 px-4 py-3 text-center relative flex items-center justify-center">
          <div className="flex items-center gap-2 max-w-4xl mx-auto text-xs sm:text-sm font-medium">
            <Info className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              Welcome to Cyberscam Watchdog Network! We are a 501(c)(3) Non-Profit dedicated to ending scams through education.
            </span>
          </div>
          <button
            onClick={() => setIsBannerDismissed(true)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200 transition"
            title="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative pt-20 pb-24 overflow-hidden border-b border-slate-200 dark:border-slate-800">
        <div className="absolute inset-0 bg-gradient-to-br from-white to-slate-100 dark:from-slate-900 dark:to-slate-950" />
        <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-amber-500/10 to-transparent" />

        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-black mb-6 text-slate-900 dark:text-white leading-tight tracking-tight">
            Cyberscam Workshops
          </h1>

          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 mb-10 max-w-2xl mx-auto">
            We provide free cybersecurity workshops. A nominal fee of $15 per person covers supplies and simple expenses.
          </p>

          <div className="flex flex-col items-center justify-center mb-12">
            <button
              onClick={() => onNavigateToTracker && onNavigateToTracker()}
              className="px-8 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-lg shadow-lg shadow-amber-500/20 mb-4 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              Work With Us
            </button>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              You can also email us directly at{' '}
              <a href="mailto:outreach@endscams.org" className="text-amber-500 hover:underline">
                outreach@endscams.org
              </a>
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm font-medium text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-emerald-500" /> Verified Protection
            </span>
            <span className="flex items-center gap-2">
              <Network className="w-4 h-4 text-amber-500" /> Global Intelligence
            </span>
            <span className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-500" /> Community Driven
            </span>
          </div>
        </div>
      </section>

      {/* Database Search Section */}
      <section id="tools" className="py-20 bg-[#070b14] border-b border-slate-900">
        <CommunityScamDatabaseSearch
          onNavigateToTracker={onNavigateToTracker}
          onNavigateToReport={onNavigateToReport}
          onNavigateToHome={() => {
            const toolsEl = document.getElementById('tools');
            if (toolsEl) toolsEl.scrollIntoView({ behavior: 'smooth' });
          }}
        />
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
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-6">
                <Hourglass className="w-8 h-8 text-amber-500" />
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
                  className={`p-5 rounded-2xl text-left transition-all duration-200 border cursor-pointer ${
                    isSelected 
                      ? 'border-amber-500 bg-white dark:bg-slate-900 shadow-lg ring-2 ring-amber-500/20' 
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-amber-500/40 hover:shadow-md'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors ${
                    isSelected ? 'bg-amber-500 text-slate-950' : 'bg-amber-500/10 text-amber-500'
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
            <div className="mt-8 bg-white dark:bg-slate-900 rounded-2xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-xl animate-in fade-in">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
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
                  className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-4 py-3 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none text-slate-900 dark:text-white text-sm"
                />
                <button
                  type="submit"
                  disabled={phoneToolLoading || !phoneToolInput.trim()}
                  className="px-6 py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 disabled:opacity-50 cursor-pointer shadow-md transition-all"
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
                            <Shield className="w-3.5 h-3.5 text-amber-500" /> Line Status & Validity
                          </p>
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Valid Number:</span>
                              <span className={`font-semibold ${phoneToolResult.is_valid || phoneToolResult.valid ? 'text-emerald-500' : 'text-red-500'}`}>
                                {phoneToolResult.is_valid || phoneToolResult.valid ? 'Active / Valid' : 'Invalid'}
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
            <div className="mt-8 bg-white dark:bg-slate-900 rounded-2xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-xl animate-in fade-in">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
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
                  className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-4 py-3 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none text-slate-900 dark:text-white text-sm"
                />
                <button
                  type="submit"
                  disabled={emailToolLoading || !emailToolInput.trim()}
                  className="px-6 py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 disabled:opacity-50 cursor-pointer shadow-md transition-all"
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
            <div className="mt-8 bg-white dark:bg-slate-900 rounded-2xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-xl animate-in fade-in">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
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
                  className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-4 py-3 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none text-slate-900 dark:text-white text-sm"
                />
                <button
                  type="submit"
                  disabled={ipToolLoading}
                  className="px-6 py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 disabled:opacity-50 cursor-pointer shadow-md transition-all"
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
                        <span className="font-mono font-bold text-slate-900 dark:text-white">{ipToolResult.ip_address || ipToolResult.data?.ip_address || ipToolResult.ip || 'Detected'}</span>
                      </div>
                      <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                        <span className="text-slate-500 block">Location:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {[ipToolResult.city, ipToolResult.region, ipToolResult.country].filter(Boolean).join(', ') || 'Global'}
                        </span>
                      </div>
                      <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                        <span className="text-slate-500 block">Network / ISP:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{ipToolResult.connection?.isp_name || ipToolResult.isp || 'Broadband'}</span>
                      </div>
                      <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                        <span className="text-slate-500 block">VPN / Tor Flag:</span>
                        <span className={`font-semibold ${ipToolResult.security?.is_vpn || ipToolResult.is_vpn ? 'text-amber-500' : 'text-emerald-500'}`}>
                          {ipToolResult.security?.is_vpn || ipToolResult.is_vpn ? 'VPN Detected' : 'Residential / Clean'}
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
            <div className="mt-8 bg-white dark:bg-slate-900 rounded-2xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-xl animate-in fade-in">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
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
                  className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-4 py-3 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none text-slate-900 dark:text-white text-sm"
                />
                <button
                  type="submit"
                  disabled={scrapeToolLoading || !scrapeToolInput.trim()}
                  className="px-6 py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 disabled:opacity-50 cursor-pointer shadow-md transition-all"
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
                        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-amber-500 transition-colors cursor-pointer"
                      >
                        {showRawJson ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        {showRawJson ? 'Hide Raw Inspection Output' : 'View Raw Inspection Output'}
                      </button>

                      {showRawJson && (
                        <pre className="p-4 bg-slate-900 text-slate-200 rounded-xl overflow-x-auto max-h-80 font-mono text-[11px]">
                          {typeof scrapeToolResult === 'string' ? (scrapeToolResult as string).substring(0, 4000) : JSON.stringify(scrapeToolResult, null, 2).substring(0, 4000)}
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
          <button
            onClick={() => onNavigateToReport && onNavigateToReport()}
            className="inline-flex items-center gap-2 text-lg px-8 py-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            <ShieldAlert className="w-5 h-5" />
            Report a Scam Now
          </button>
        </div>
      </section>
    </div>
  );
}

// Subcomponent: ReportCard
export function ReportCard({ label, date, description, sourceName, sourceUrl }: { label: string; date: string; description: string; sourceName: string; sourceUrl?: string | null }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 mb-2 text-left shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold px-2 py-0.5 bg-amber-500/10 text-amber-500 rounded">{label}</span>
        <span className="text-xs text-slate-400">{date}</span>
      </div>
      {description && <p className="text-sm text-slate-700 dark:text-slate-300 mb-2 line-clamp-2">{description}</p>}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">Source: {sourceName}</span>
        {sourceUrl && (
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-amber-500 hover:underline flex items-center gap-1">
            <ExternalLink className="w-3 h-3" />View Report
          </a>
        )}
      </div>
    </div>
  );
}
