import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ExternalLink, Phone, Calendar, Tag, AlertTriangle, Loader2, Paperclip, PhoneOff, PhoneCall } from 'lucide-react';
import { supabase, formatPhoneDisplay, isFakeNumber } from '../lib/supabase';

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

const SOURCES = [
  {
    name: 'US Gov Data — FCC/FTC Sheet',
    url: 'https://docs.google.com/spreadsheets/d/1wA8LivoY-tYG1gLI4BtX06SLARiiS83a',
    category: 'Government Data',
  },
  {
    name: 'Google Search — WhatsApp / Spellcaster / Crypto Recovery',
    url: 'https://www.google.com/search?q=%22whatsapp%22+%22scam%22',
    category: 'Social Media / WhatsApp Scam',
  },
  {
    name: 'BBB Scam Tracker — PayPal',
    url: 'https://www.bbb.org/scamtracker/lookupscam?q=all%3Dpaypal%26from%3D0',
    category: 'Invoice / Imposter Scam',
  },
  {
    name: 'BBB Scam Tracker — Emergency',
    url: 'https://www.bbb.org/scamtracker/lookupscam?q=all%3Demergency%26from%3D0',
    category: 'Emergency Scam',
  },
  {
    name: 'BBB Scam Tracker — Million',
    url: 'https://www.bbb.org/scamtracker/lookupscam?q=all%3Dmillion%26from%3D0',
    category: 'Lottery / Prize Scam',
  },
];

const CATEGORIES = [
  'All',
  'Invoice / Imposter Scam',
  'Emergency Scam',
  'Lottery / Prize Scam',
  'Government Impersonation',
  'Spiritual / Spellcaster Scam',
  'Crypto Recovery Scam',
  'User Report',
  'Number Down',
];

function mergeAndSort(existing: CombinedEntry[], incoming: CombinedEntry[]): CombinedEntry[] {
  const seen = new Map<string, CombinedEntry>();
  for (const e of existing) seen.set(e.id, e);
  for (const e of incoming) seen.set(e.id, e);

  // Enforce a strict 31-day cutoff and de-dup by digits (keep newest report).
  const cutoffMs = Date.now() - 31 * 86400_000;
  const byDigits = new Map<string, CombinedEntry>();
  for (const entry of seen.values()) {
    if (isFakeNumber(entry.digits)) continue;
    const t = new Date(entry.date).getTime();
    if (isNaN(t) || t < cutoffMs) continue;
    const prev = byDigits.get(entry.digits);
    if (!prev || prev.date < entry.date) byDigits.set(entry.digits, entry);
  }

  return Array.from(byDigits.values())
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export default function TrackerPage() {
  const [entries, setEntries] = useState<CombinedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [category, setCategory] = useState('All');
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
      const [trackerRes, reportsRes] = await Promise.all([
        supabase
          .from('tracker_entries')
          .select('id,phone_number,phone_digits,source_name,source_url,report_date,category,description,created_at,reported_down')
          .gt('expires_at', new Date().toISOString())
          .order('report_date', { ascending: false })
          .limit(200),
        supabase
          .from('scam_reports')
          .select('id,phone_number,phone_digits,category,description,incident_date,source,source_url,file_url,created_at')
          .gt('expires_at', new Date().toISOString())
          .order('incident_date', { ascending: false })
          .limit(200),
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
      const fetcherBase = (import.meta.env.VITE_FETCHER_URL as string | undefined) || '';
      if (!fetcherBase) throw new Error('VITE_FETCHER_URL not set');
      const res = await fetch(`${fetcherBase.replace(/\/$/, '')}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        if (json.inserted) setNewCount(json.inserted);
      }
    } catch (e) {
      console.warn('refresh failed', e);
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
        prev.map(e => e.id === entry.id ? { ...e, reportedDown: !entry.reportedDown } : e)
      );
    } finally {
      setTogglingId(null);
    }
  };

  const filtered = (() => {
    if (category === 'Number Down') return entries.filter(e => e.reportedDown);
    if (category === 'User Report') return entries.filter(e => e.type === 'user' && !e.reportedDown);
    if (category === 'All') return entries.filter(e => !e.reportedDown);
    return entries.filter(e => e.category === category && !e.reportedDown);
  })();

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 pt-20 pb-16">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2">Scam Phone Tracker</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                Real non-toll-free scam numbers from verified sources. Retained for 31 days, auto-refreshed twice daily (6am &amp; 1pm PST).
                {lastUpdated && <span> Last updated: {lastUpdated.toLocaleTimeString()}</span>}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5 self-start md:self-auto">
              <button
                onClick={handleReload}
                disabled={reloading}
                className="btn-primary flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${reloading ? 'animate-spin' : ''}`} />
                {reloading ? 'Checking for new numbers...' : 'Check for New Numbers'}
              </button>
              {reloading && (
                <p className="text-xs text-slate-400 dark:text-slate-500 text-right">
                  Existing numbers stay visible while we search...
                </p>
              )}
              {!reloading && newCount > 0 && (
                <p className="text-xs text-green-500 font-semibold text-right">
                  {newCount} new number{newCount !== 1 ? 's' : ''} added
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  cat === 'Number Down'
                    ? category === cat
                      ? 'bg-slate-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'
                    : category === cat
                      ? 'bg-brand-500 text-slate-900 font-bold shadow-sm'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'
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

          {category === 'Number Down' && (
            <div className="card p-4 mb-6 bg-slate-900/80 border-slate-800 backdrop-blur-md border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                These numbers have been community-reported as no longer active. Click <strong>Number Still Up</strong> on any entry to restore it to the main list.
              </p>
            </div>
          )}

          <div className="card p-4 mb-6 bg-slate-900/80 border-slate-800 backdrop-blur-md">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 font-semibold">Active Source References</p>
            <div className="flex flex-wrap gap-2">
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

        {loading ? (
          <div className="text-center py-20">
            <Loader2 className="w-10 h-10 text-brand-500 mx-auto mb-4 animate-spin" />
            <p className="text-slate-500 dark:text-slate-400">Loading scam tracker data...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 card p-10">
            <AlertTriangle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              {category === 'Number Down' ? 'No numbers reported down' : 'No entries yet'}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
              {category === 'Number Down'
                ? 'When a number is flagged as no longer active, it will appear here.'
                : 'The database is empty. Reports submitted via the form and data fetched from external sources will appear here.'}
            </p>
            {category !== 'Number Down' && (
              <div className="space-y-3 text-sm text-slate-400 dark:text-slate-500">
                <p className="font-semibold text-slate-600 dark:text-slate-300">Check these sources directly:</p>
                {SOURCES.slice(0, 4).map(s => (
                  <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 text-brand-500 hover:underline">
                    <ExternalLink className="w-4 h-4" />{s.name}
                  </a>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{filtered.length} entries found</p>
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
    'Invoice / Imposter Scam': 'text-orange-500 bg-orange-500/10',
    'Emergency Scam': 'text-red-500 bg-red-500/10',
    'Lottery / Prize Scam': 'text-yellow-500 bg-yellow-500/10',
    'Government Impersonation': 'text-blue-500 bg-blue-500/10',
    'Spiritual / Spellcaster Scam': 'text-teal-500 bg-teal-500/10',
    'Crypto Recovery Scam': 'text-cyan-500 bg-cyan-500/10',
  };
  const colorClass = categoryColors[entry.category] || 'text-slate-500 bg-slate-1000/10';

  return (
    <div className={`card p-5 bg-slate-900/80 border border-slate-800 backdrop-blur-md hover:border-brand-500/50 hover:shadow-[0_0_15px_rgba(34,211,238,0.2)] transition-all duration-200 group ${entry.reportedDown ? 'opacity-75 border-slate-800' : ''}`}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-lg">
              <Phone className="w-4 h-4 text-brand-500" />
              {entry.phone}
            </div>
            <span className={`text-xs px-2 py-1 rounded font-semibold ${colorClass}`}>{entry.category}</span>
            {entry.type === 'user' && (
              <span className="text-xs px-2 py-1 rounded font-semibold text-green-500 bg-green-500/10">Community Report</span>
            )}
            {entry.reportedDown && (
              <span className="text-xs px-2 py-1 rounded font-semibold text-slate-500 bg-slate-500/10 flex items-center gap-1">
                <PhoneOff className="w-3 h-3" />
                Number Down
              </span>
            )}
          </div>

          {entry.description && (
            <div className="text-sm text-slate-600 dark:text-slate-400 mb-3 space-y-1">
              {entry.description.split(/\s+\|\s+/).slice(0, 4).map((chunk, i) => {
                const [labelRaw, ...rest] = chunk.split(/:\s*/);
                const hasLabel = rest.length > 0 && labelRaw.length < 30;
                return (
                  <div key={i} className="leading-snug">
                    {hasLabel ? (
                      <>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{labelRaw}:</span>{' '}
                        <span>{rest.join(': ')}</span>
                      </>
                    ) : (
                      <span>{chunk}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 dark:text-slate-500">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Report date: {entry.date}
            </span>
            <span className="flex items-center gap-1">
              <Tag className="w-3 h-3" />
              {entry.sourceName}
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
              <ExternalLink className="w-4 h-4" />
              View Report
            </a>
          )}
          {entry.fileUrl && (
            <a
              href={entry.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-lg text-sm font-semibold transition-all"
            >
              <Paperclip className="w-4 h-4" />
              Uploaded Resource
            </a>
          )}
          {entry.type === 'tracker' && (
            showingDown ? (
              <button
                onClick={() => onToggleDown(entry)}
                disabled={toggling}
                className="flex items-center gap-2 px-4 py-2 bg-green-500/10 hover:bg-green-500/20 text-green-600 dark:text-green-400 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
              >
                {toggling ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <PhoneCall className="w-4 h-4" />
                )}
                Number Still Up
              </button>
            ) : (
              <button
                onClick={() => onToggleDown(entry)}
                disabled={toggling}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
              >
                {toggling ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <PhoneOff className="w-4 h-4" />
                )}
                Report Number Down
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
