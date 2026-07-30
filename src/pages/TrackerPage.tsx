import React, { useState, useEffect, useCallback } from 'react';
import { 
  RefreshCw, ExternalLink, Phone, Calendar, Tag, AlertTriangle, 
  Loader2, Paperclip, PhoneOff, PhoneCall, Search, Clock, ShieldAlert 
} from 'lucide-react';
import { supabase, formatPhoneDisplay, isValidScamNumber } from '../lib/supabase';

type Entry = {
  id: string;
  phone_number: string;
  phone_digits: string;
  source_name: string;
  source_url: string;
  report_date: string;
  category?: string;
  description?: string;
  created_at: string;
  reported_down: boolean;
  expires_at?: string;
};

type UserReport = {
  id: string;
  phone_number: string;
  phone_digits: string;
  category: string;
  description: string;
  incident_date: string;
  source: string;
  source_url?: string;
  file_url?: string;
  created_at: string;
  expires_at?: string;
};

type CombinedEntry = {
  id: string;
  phone: string;
  digits: string;
  sourceName: string;
  sourceUrl?: string;
  fileUrl?: string;
  date: string;
  category: string;
  description: string;
  type: 'tracker' | 'user';
  reportedDown: boolean;
};

// Target Sources based on your search queries and sites
const SOURCES = [
  {
    name: 'Facebook — Spellcaster Scams',
    url: 'https://www.google.com/search?q=site:facebook.com+%22spellcaster%22+%22Whatsapp%22',
    category: 'Spiritual / Spellcaster Scam',
  },
  {
    name: 'Facebook — Illuminati Scams',
    url: 'https://www.google.com/search?q=site:facebook.com+%22illuminati%22+%22Whatsapp%22',
    category: 'Illuminati Scam',
  },
  {
    name: 'Instagram — Spellcaster Scams',
    url: 'https://www.google.com/search?q=site:instagram.com+%22spellcaster%22+%22Whatsapp%22',
    category: 'Spiritual / Spellcaster Scam',
  },
  {
    name: 'Guestbook — Spell / Whatsapp Scams',
    url: 'https://www.google.com/search?q=inurl:%22guestbook%22+spell+whatsapp',
    category: 'Guestbook Scam',
  },
  {
    name: 'Facebook — BTC Recovery Scams',
    url: 'https://www.google.com/search?q=site:facebook.com+%22btc+recovery%22+%22Whatsapp%22',
    category: 'Crypto Recovery Scam',
  },
  {
    name: 'Instagram — BTC Recovery Scams',
    url: 'https://www.google.com/search?q=site:instagram.com+%22btc+recovery%22+%22Whatsapp%22',
    category: 'Crypto Recovery Scam',
  },
  {
    name: 'Amazon / Book Publisher Scams',
    url: 'https://www.google.com/search?q=%22book+publisher%22+%22amazon%22+%22chat%22',
    category: 'Book Publisher Scam',
  },
  {
    name: 'PetScams.com — Puppy Scammer List',
    url: 'https://petscams.com/category/puppy-scammer-list/',
    category: 'Puppy / Pet Scam',
  },
];

const CATEGORIES = [
  'All',
  'Spiritual / Spellcaster Scam',
  'Illuminati Scam',
  'Crypto Recovery Scam',
  'Guestbook Scam',
  'Book Publisher Scam',
  'Puppy / Pet Scam',
  'User Report',
  'Number Down',
];

// Combine, clean, and filter entries (strictly removing items > 31 days old, toll-free, or fake)
function mergeAndSort(existing: CombinedEntry[], incoming: CombinedEntry[]): CombinedEntry[] {
  const seen = new Map<string, CombinedEntry>();
  for (const e of existing) seen.set(e.id, e);
  for (const e of incoming) seen.set(e.id, e);

  // Auto-delete cutoff: 31 days maximum retention
  const thirtyOneDaysAgoMs = Date.now() - 31 * 24 * 60 * 60 * 1000;
  const byDigits = new Map<string, CombinedEntry>();

  for (const entry of seen.values()) {
    // 1. Filter fake and toll-free numbers
    if (!isValidScamNumber(entry.digits)) continue;

    // 2. Strict 31-day auto-expiry cutoff
    const entryTime = new Date(entry.date).getTime();
    if (isNaN(entryTime) || entryTime < thirtyOneDaysAgoMs) continue;

    // 3. Deduplicate by phone digits (keep newest report date)
    const prev = byDigits.get(entry.digits);
    if (!prev || prev.date < entry.date) {
      byDigits.set(entry.digits, entry);
    }
  }

  return Array.from(byDigits.values()).sort((a, b) => (a.date < b.date ? 1 : -1));
}

export default function TrackerPage() {
  const [entries, setEntries] = useState<CombinedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [category, setCategory] = useState('All');
  const [lastDaysFilter, setLastDaysFilter] = useState<boolean>(false); // 7 days filter toggle
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Dynamically load Google Custom Search Engine script (f1607690d599b42e8)
  useEffect(() => {
    const scriptId = 'google-cse-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://cse.google.com/cse.js?cx=f1607690d599b42e8';
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  const buildEntries = (trackerData: Entry[], reportData: UserReport[]): CombinedEntry[] => {
    const trackerItems: CombinedEntry[] = trackerData.map((e: Entry) => ({
      id: e.id,
      phone: formatPhoneDisplay(e.phone_digits),
      digits: e.phone_digits,
      sourceName: e.source_name,
      sourceUrl: e.source_url,
      date: e.report_date,
      category: e.category || 'Unknown',
      description: e.description || '',
      type: 'tracker',
      reportedDown: e.reported_down ?? false,
    }));

    const userItems: CombinedEntry[] = reportData.map((e: UserReport) => ({
      id: e.id,
      phone: formatPhoneDisplay(e.phone_digits),
      digits: e.phone_digits,
      sourceName: 'User Report — EndScams.org',
      sourceUrl: e.source_url,
      fileUrl: e.file_url,
      date: e.incident_date,
      category: e.category,
      description: e.description,
      type: 'user',
      reportedDown: false,
    }));

    return [...trackerItems, ...userItems];
  };

  const fetchData = useCallback(async () => {
    try {
      // 31-day ISO threshold to prevent loading expired numbers from Supabase
      const cutoffIso = new Date(Date.now() - 31 * 86400_000).toISOString();

      const [trackerRes, reportsRes] = await Promise.all([
        supabase
          .from('tracker_entries')
          .select('id,phone_number,phone_digits,source_name,source_url,report_date,category,description,created_at,reported_down')
          .gte('report_date', cutoffIso)
          .order('report_date', { ascending: false })
          .limit(300),
        supabase
          .from('scam_reports')
          .select('id,phone_number,phone_digits,category,description,incident_date,source,source_url,file_url,created_at')
          .gte('incident_date', cutoffIso)
          .order('incident_date', { ascending: false })
          .limit(300),
      ]);

      const incoming = buildEntries(trackerRes.data || [], reportsRes.data || []);
      setEntries(prev => mergeAndSort(prev, incoming));
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
      setReloading(false);
      setNewCount(0);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleReload = async () => {
    setReloading(true);
    setNewCount(0);
    try {
      const fetcherBase = (import.meta.env.VITE_FETCHER_URL as string | undefined) || 'https://fetcher.endscams.org';
      const res = await fetch(`${fetcherBase.replace(/\/$/, '')}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        if (json.inserted) setNewCount(json.inserted);
      }
    } catch (e) {
      console.warn('Refresh request issue:', e);
    }
    await fetchData();
  };

  const handleToggleDown = async (entry: CombinedEntry) => {
    if (entry.type !== 'tracker') return;
    setTogglingId(entry.id);
    try {
      await supabase
        .from('tracker_entries')
        .update({ reported_down: !entry.reportedDown })
        .eq('id', entry.id);
      setEntries(prev =>
        prev.map(e => (e.id === entry.id ? { ...e, reportedDown: !entry.reportedDown } : e))
      );
    } finally {
      setTogglingId(null);
    }
  };

  // Filter pipeline: Category + 7-Day Time Window
  const filtered = entries.filter(e => {
    // 7-day cutoff check
    if (lastDaysFilter) {
      const sevenDaysAgo = Date.now() - 7 * 86400_000;
      const entryTime = new Date(e.date).getTime();
      if (isNaN(entryTime) || entryTime < sevenDaysAgo) return false;
    }

    // Category filter
    if (category === 'Number Down') return e.reportedDown;
    if (e.reportedDown) return false; // Hide down numbers from other tabs

    if (category === 'User Report') return e.type === 'user';
    if (category === 'All') return true;

    return e.category === category;
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pt-20 pb-16">
      <div className="max-w-6xl mx-auto px-4">
        
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-2 flex items-center gap-3">
                <ShieldAlert className="w-9 h-9 text-brand-500" />
                Scam Phone Tracker
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Tracking WhatsApp, Spellcaster, Illuminati, Crypto Recovery, Pet, and Publisher scams.
                <span className="block mt-1 font-medium text-xs text-gray-400">
                  ⚡ Auto-deletes inputs older than 31 days. Toll-free and fake numbers excluded. Supports international country codes (+xx / +xxx).
                </span>
                {lastUpdated && <span className="text-brand-500 text-xs"> Last checked: {lastUpdated.toLocaleTimeString()}</span>}
              </p>
            </div>

            <div className="flex flex-col items-end gap-2 self-start md:self-auto">
              <button
                onClick={handleReload}
                disabled={reloading}
                className="btn-primary flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${reloading ? 'animate-spin' : ''}`} />
                {reloading ? 'Scanning sources...' : 'Refresh Scam Data'}
              </button>

              {!reloading && newCount > 0 && (
                <p className="text-xs text-green-500 font-semibold text-right">
                  +{newCount} new number{newCount !== 1 ? 's' : ''} added
                </p>
              )}
            </div>
          </div>

          {/* Embedded Google Programmable Search Box (Captcha Bypass) */}
          <div className="card p-4 mb-6 border-brand-500/20 bg-white dark:bg-gray-900">
            <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider flex items-center gap-1.5">
              <Search className="w-4 h-4 text-brand-500" /> Live Scammer Search (Captcha-Free Google CSE)
            </h3>
            <div className="gcse-search"></div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    cat === 'Number Down'
                      ? category === cat
                        ? 'bg-slate-600 text-white'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300'
                      : category === cat
                        ? 'bg-brand-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-300'
                  }`}
                >
                  {cat === 'Number Down' ? (
                    <span className="flex items-center gap-1">
                      <PhoneOff className="w-3 h-3" />
                      {cat}
                    </span>
                  ) : cat}
                </button>
              ))}
            </div>

            {/* 7-Day Quick Filter Toggle */}
            <button
              onClick={() => setLastDaysFilter(!lastDaysFilter)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                lastDaysFilter
                  ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                  : 'bg-transparent text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700 hover:border-amber-500'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              {lastDaysFilter ? 'Showing: Last 7 Days Only' : 'Filter Last 7 Days'}
            </button>
          </div>

          {/* Source Quick-Links */}
          <div className="card p-4 mb-6 bg-gray-50/50 dark:bg-gray-900/50">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-semibold">Tracked Search Parameters &amp; Sites</p>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {SOURCES.map(s => (
                <a
                  key={s.name}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-brand-500 hover:text-brand-600 hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  {s.name}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Results List */}
        {loading ? (
          <div className="text-center py-20">
            <Loader2 className="w-10 h-10 text-brand-500 mx-auto mb-4 animate-spin" />
            <p className="text-gray-500 dark:text-gray-400">Loading verified scam numbers...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 card p-10">
            <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No active scam numbers found</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
              {lastDaysFilter 
                ? 'No numbers match your filters from the last 7 days. Try disabling the 7-day filter.' 
                : 'No entry matched this selection or all matching numbers have expired after 31 days.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 mb-2">
              <span>Showing {filtered.length} active entry(ies)</span>
              <span>Numbers auto-expire 31 days after report</span>
            </div>
            {filtered.map(entry => (
              <TrackerEntryCard
                key={entry.id}
                entry={entry}
                onToggleDown={handleToggleDown}
                toggling={togglingId === entry.id}
                showingDown={category === 'Number Down'}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TrackerEntryCard({
  entry,
  onToggleDown,
  toggling,
  showingDown,
}: {
  entry: CombinedEntry;
  onToggleDown: (entry: CombinedEntry) => void;
  toggling: boolean;
  showingDown: boolean;
}) {
  const categoryColors: Record<string, string> = {
    'Spiritual / Spellcaster Scam': 'text-teal-500 bg-teal-500/10',
    'Illuminati Scam': 'text-purple-500 bg-purple-500/10',
    'Crypto Recovery Scam': 'text-cyan-500 bg-cyan-500/10',
    'Guestbook Scam': 'text-amber-500 bg-amber-500/10',
    'Book Publisher Scam': 'text-blue-500 bg-blue-500/10',
    'Puppy / Pet Scam': 'text-rose-500 bg-rose-500/10',
  };
  const colorClass = categoryColors[entry.category] || 'text-gray-500 bg-gray-500/10';

  return (
    <div className={`card p-5 hover:border-brand-500/30 transition-all duration-200 ${entry.reportedDown ? 'opacity-75 border-slate-300 dark:border-slate-700' : ''}`}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <div className="flex items-center gap-2 font-mono font-bold text-gray-900 dark:text-white text-lg">
              <Phone className="w-4 h-4 text-brand-500" />
              {entry.phone}
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-md font-semibold ${colorClass}`}>{entry.category}</span>
            {entry.type === 'user' && (
              <span className="text-xs px-2.5 py-1 rounded-md font-semibold text-green-500 bg-green-500/10">Community Report</span>
            )}
            {entry.reportedDown && (
              <span className="text-xs px-2.5 py-1 rounded-md font-semibold text-slate-500 bg-slate-500/10 flex items-center gap-1">
                <PhoneOff className="w-3 h-3" /> Number Down
              </span>
            )}
          </div>

          {entry.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 leading-relaxed">
              {entry.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Reported: {entry.date}
            </span>
            <span className="flex items-center gap-1">
              <Tag className="w-3 h-3" />
              {entry.sourceName}
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:items-end gap-2 flex-shrink-0">
          {entry.sourceUrl && (
            <a
              href={entry.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 bg-brand-500/10 hover:bg-brand-500/20 text-brand-500 rounded-lg text-xs font-semibold transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View Source
            </a>
          )}
          {entry.fileUrl && (
            <a
              href={entry.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg text-xs font-semibold transition-all"
            >
              <Paperclip className="w-3.5 h-3.5" />
              Evidence File
            </a>
          )}
          {entry.type === 'tracker' && (
            <button
              onClick={() => onToggleDown(entry)}
              disabled={toggling}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                showingDown
                  ? 'bg-green-500/10 hover:bg-green-500/20 text-green-600 dark:text-green-400'
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-400'
              }`}
            >
              {toggling ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : showingDown ? (
                <PhoneCall className="w-3.5 h-3.5" />
              ) : (
                <PhoneOff className="w-3.5 h-3.5" />
              )}
              {showingDown ? 'Number Still Active' : 'Report Down'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
