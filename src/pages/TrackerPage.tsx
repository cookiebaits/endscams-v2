export default function TrackerPage() {
  return (
    <div className="min-h-screen bg-slate-950 pt-[165px] flex flex-col">
      <iframe
        src="https://esscan.ai.studio"
        className="w-full border-0"
        style={{ minHeight: '2000px', height: '100%' }}
        scrolling="no"
        title="End Scam Scan"
        allow="microphone; camera; display-capture; clipboard-read; clipboard-write"
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
      />
import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ExternalLink, Phone, Calendar, Tag, AlertTriangle, Loader2, Paperclip, PhoneOff, PhoneCall, Clock } from 'lucide-react';
import { supabase, formatPhoneDisplay, isValidScamNumber, normalizePhone } from '../lib/supabase';

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

const SERP_API_KEY = '372a90ce358f16044b8ced93722ad1b20b10a46d892f3116a90481b0273f2805';

const SEARCH_TARGETS = [
  { name: 'Facebook — Spellcaster Scams', query: 'site:facebook.com "spellcaster" "Whatsapp"', category: 'Spiritual / Spellcaster Scam' },
  { name: 'Facebook — Illuminati Scams', query: 'site:facebook.com "illuminati" "Whatsapp"', category: 'Spiritual / Spellcaster Scam' },
  { name: 'Instagram — Spellcaster Scams', query: 'site:instagram.com "spellcaster" "Whatsapp"', category: 'Spiritual / Spellcaster Scam' },
  { name: 'Guestbook Scams', query: 'inurl:"guestbook" spell whatsapp', category: 'Spiritual / Spellcaster Scam' },
  { name: 'Facebook — BTC Recovery Scams', query: 'site:facebook.com "btc recovery" "Whatsapp"', category: 'Crypto Recovery Scam' },
  { name: 'Instagram — BTC Recovery Scams', query: 'site:instagram.com "btc recovery" "Whatsapp"', category: 'Crypto Recovery Scam' },
  { name: 'Amazon — Book Publisher Scams', query: '"book publisher" "amazon" "chat"', category: 'Publisher Scam' },
  { name: 'PetScams — Puppy Scammer List', query: 'site:petscams.com/category/puppy-scammer-list/', category: 'Pet / Puppy Scam' },
];

const CATEGORIES = [
  'All',
  'Spiritual / Spellcaster Scam',
  'Crypto Recovery Scam',
  'Publisher Scam',
  'Pet / Puppy Scam',
  'Invoice / Imposter Scam',
  'User Report',
  'Number Down',
];

type TimeFilter = '7days' | '31days';

function extractPhoneNumbers(text: string): string[] {
  const regex = /(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{4}/g;
  const matches = text.match(regex) || [];
  return matches.map(m => normalizePhone(m)).filter(d => d.length >= 8);
}

function mergeAndSort(existing: CombinedEntry[], incoming: CombinedEntry[]): CombinedEntry[] {
  const seen = new Map<string, CombinedEntry>();
  for (const e of existing) seen.set(e.id, e);
  for (const e of incoming) seen.set(e.id, e);

  const cutoff31Days = Date.now() - 31 * 86400_000;
  const byDigits = new Map<string, CombinedEntry>();

  for (const entry of seen.values()) {
    if (!isValidScamNumber(entry.digits)) continue;
    const entryTime = new Date(entry.date).getTime();
    if (isNaN(entryTime) || entryTime < cutoff31Days) continue;

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
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('7days');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

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
      const cutoffIso = new Date(Date.now() - 31 * 86400_000).toISOString();

      await supabase.from('tracker_entries').delete().lt('report_date', cutoffIso);
      await supabase.from('scam_reports').delete().lt('incident_date', cutoffIso);

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
    let addedTrackerCount = 0;

    try {
      for (const target of SEARCH_TARGETS) {
        const serpUrl = `/serpapi/search.json?engine=google&q=${encodeURIComponent(target.query)}&api_key=${SERP_API_KEY}`;
        
        const response = await fetch(serpUrl);
        if (!response.ok) continue;
        
        const data = await response.json();
        const organicResults = data.organic_results || [];

        for (const resItem of organicResults) {
          const snippetText = `${resItem.title || ''} ${resItem.snippet || ''}`;
          const phoneDigitsList = extractPhoneNumbers(snippetText);

          for (const digits of phoneDigitsList) {
            if (!isValidScamNumber(digits)) continue;

            const formattedPhone = formatPhoneDisplay(digits);
            const todayStr = new Date().toISOString().split('T')[0];

            const { data: existing } = await supabase
              .from('tracker_entries')
              .select('id')
              .eq('phone_digits', digits)
              .maybeSingle();

            if (!existing) {
              const { error } = await supabase.from('tracker_entries').insert({
                phone_number: formattedPhone,
                phone_digits: digits,
                source_name: target.name,
                source_url: resItem.link,
                report_date: todayStr,
                category: target.category,
                description: resItem.snippet || 'Scam phone listing detected via search parameters.',
                reported_down: false,
              });

              if (!error) {
                addedTrackerCount++;
              }
            }
          }
        }
      }

      setNewCount(addedTrackerCount);
    } catch (e) {
      console.warn('SERP API extraction encountered an error:', e);
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

  const filtered = entries.filter(e => {
    if (timeFilter === '7days') {
      const cutoff7Days = Date.now() - 7 * 86400_000;
      const t = new Date(e.date).getTime();
      if (isNaN(t) || t < cutoff7Days) return false;
    }

    if (category === 'Number Down') return e.reportedDown;
    if (category === 'User Report') return e.type === 'user' && !e.reportedDown;
    if (category === 'All') return !e.reportedDown;
    return e.category === category && !e.reportedDown;
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pt-20 pb-16">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-2">Scam Phone Tracker</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Live SERP tracking for verified international scam numbers. Auto-purged after 31 days.
                {lastUpdated && <span> Last checked: {lastUpdated.toLocaleTimeString()}</span>}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5 self-start md:self-auto">
              <button
                onClick={handleReload}
                disabled={reloading}
                className="btn-primary flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${reloading ? 'animate-spin' : ''}`} />
                {reloading ? 'Scanning via SERP API...' : 'Check for New Numbers'}
              </button>
              {!reloading && newCount > 0 && (
                <p className="text-xs text-green-500 font-semibold text-right">
                  {newCount} new number{newCount !== 1 ? 's' : ''} added
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4 bg-gray-200 dark:bg-gray-800 p-1 rounded-lg w-fit">
            <span className="text-xs font-semibold px-2 text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Timeframe:
            </span>
            <button
              onClick={() => setTimeFilter('7days')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                timeFilter === '7days' ? 'bg-brand-500 text-white shadow' : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Last 7 Days
            </button>
            <button
              onClick={() => setTimeFilter('31days')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                timeFilter === '31days' ? 'bg-brand-500 text-white shadow' : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Last 31 Days
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  cat === 'Number Down'
                    ? category === cat ? 'bg-slate-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600'
                    : category === cat ? 'bg-brand-500 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-600'
                }`}
              >
                {cat === 'Number Down' ? (
                  <span className="flex items-center gap-1">
                    <PhoneOff className="w-3 h-3" /> {cat}
                  </span>
                ) : (
                  cat
                )}
              </button>
            ))}
          </div>

          <div className="card p-4 mb-6">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-semibold">Active Search Queries & Sources</p>
            <div className="flex flex-wrap gap-2">
              {SEARCH_TARGETS.map(s => (
                <div
                  key={s.name}
                  className="inline-flex items-center gap-1 text-xs text-brand-500 bg-brand-500/5 px-2 py-1 rounded border border-brand-500/10"
                >
                  <Tag className="w-3 h-3" />
                  {s.name}
                </div>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <Loader2 className="w-10 h-10 text-brand-500 mx-auto mb-4 animate-spin" />
            <p className="text-gray-500 dark:text-gray-400">Loading scam tracker records...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 card p-10">
            <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No entries found</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              There are no reports matching the selected category for the {timeFilter === '7days' ? 'last 7 days' : 'last 31 days'}.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Showing {filtered.length} entries ({timeFilter === '7days' ? 'Last 7 Days' : 'Last 31 Days'})
            </p>
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
    'Crypto Recovery Scam': 'text-cyan-500 bg-cyan-500/10',
    'Publisher Scam': 'text-purple-500 bg-purple-500/10',
    'Pet / Puppy Scam': 'text-amber-500 bg-amber-500/10',
    'Invoice / Imposter Scam': 'text-orange-500 bg-orange-500/10',
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
            <span className={`text-xs px-2 py-1 rounded font-semibold ${colorClass}`}>{entry.category}</span>
            {entry.type === 'user' && (
              <span className="text-xs px-2 py-1 rounded font-semibold text-green-500 bg-green-500/10">Community Report</span>
            )}
            {entry.reportedDown && (
              <span className="text-xs px-2 py-1 rounded font-semibold text-slate-500 bg-slate-500/10 flex items-center gap-1">
                <PhoneOff className="w-3 h-3" /> Number Down
              </span>
            )}
          </div>

          {entry.description && (
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-3 space-y-1">
              <p>{entry.description}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Report date: {entry.date}
            </span>
            <span className="flex items-center gap-1">
              <Tag className="w-3 h-3" /> {entry.sourceName}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {entry.sourceUrl && (
            <a
              href={entry.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-brand-500/10 hover:bg-brand-500/20 text-brand-500 rounded-lg text-sm font-semibold transition-all"
            >
              <ExternalLink className="w-4 h-4" /> View Source
            </a>
          )}
          {entry.fileUrl && (
            <a
              href={entry.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg text-sm font-semibold transition-all"
            >
              <Paperclip className="w-4 h-4" /> Attachment
            </a>
          )}
          {entry.type === 'tracker' && (
            <button
              onClick={() => onToggleDown(entry)}
              disabled={toggling}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-gray-400 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
            >
              {toggling ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : showingDown ? (
                <PhoneCall className="w-4 h-4 text-green-500" />
              ) : (
                <PhoneOff className="w-4 h-4" />
              )}
              {showingDown ? 'Number Still Up' : 'Report Number Down'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
