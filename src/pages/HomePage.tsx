import { useState } from 'react';
import { Search, Shield, AlertTriangle, ExternalLink, Loader2, Radar, BookOpen, ArrowRight, TrendingUp } from 'lucide-react';
import { useFtcStats } from '../hooks/useFtcStats';
import { supabase, normalizePhone, formatPhoneDisplay } from '../lib/supabase';
import { Link } from 'react-router-dom';

function buildSearchUrl(engine: 'google' | 'bing' | 'brave', digits: string): string {
  const q = encodeURIComponent(`"${digits}"`);
  switch (engine) {
    case 'google': return `https://www.google.com/search?q=${q}`;
    case 'bing': return `https://www.bing.com/search?q=${q}`;
    case 'brave': return `https://search.brave.com/search?q=${q}`;
  }
}

export default function HomePage() {
  const { stats: impactStats } = useFtcStats();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<{
    searched: boolean;
    found: boolean;
    reports: { id: string; category: string; incident_date?: string; report_date?: string; description: string; source?: string; source_name?: string; source_url?: string; }[];
    trackerEntries: { id: string; category: string; incident_date?: string; report_date?: string; description: string; source?: string; source_name?: string; source_url?: string; }[];
    searchDigits: string;
  } | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = normalizePhone(phoneNumber);

    if (digits.length < 10) {
      alert('Please enter a valid 10-digit phone number');
      return;
    }

    setIsSearching(true);
    setResult(null);

    try {
      const [reportsRes, trackerRes] = await Promise.all([
        supabase.from('scam_reports').select('id,category,description,incident_date,source,source_url').eq('phone_digits', digits).gt('expires_at', new Date().toISOString()).order('incident_date', { ascending: false }),
        supabase.from('tracker_entries').select('id,source_name,source_url,report_date,category,description').eq('phone_digits', digits).gt('expires_at', new Date().toISOString()).order('report_date', { ascending: false }),
      ]);

      const reports = reportsRes.data || [];
      const trackerEntries = trackerRes.data || [];

      setResult({
        searched: true,
        found: reports.length > 0 || trackerEntries.length > 0,
        reports,
        trackerEntries,
        searchDigits: digits
      });
    } catch {
      setResult({
        searched: true,
        found: false,
        reports: [],
        trackerEntries: [],
        searchDigits: digits
      });
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black flex flex-col mt-8">
      {/* Hero Section - CrowdStrike Inspired */}
      <div className="bg-gradient-to-br from-black via-gray-900 to-corporate-900 text-white py-24 px-6 border-b border-brand-500 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-brand-500"></div>
        <div className="max-w-5xl mx-auto text-center flex flex-col items-center relative z-10">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight leading-tight">
            Secure Your Digital World: <br className="hidden md:block"/> Human + Intelligence
          </h1>
          <p className="text-lg md:text-xl text-gray-300 mb-8 max-w-2xl leading-relaxed">
            Everything you need to identify, track, and report phone scams—all in one community-driven platform. Protect yourself and others today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link to="/education" className="px-8 py-3 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded text-lg transition-colors shadow-lg">
              Get Educated Now
            </Link>
            <Link to="/report" className="px-8 py-3 bg-transparent border-2 border-white hover:border-gray-300 hover:text-gray-300 font-bold rounded text-lg transition-colors">
              Report a Scam
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content Area - 3 Column Layout */}
      <div className="max-w-7xl mx-auto w-full flex flex-col md:flex-row gap-6 p-4 md:p-8 -mt-8">

        {/* Left Column: Organization Identity & Partners */}
        <div className="w-full md:w-1/4 flex-shrink-0 flex flex-col gap-6">
          <div className="bg-white dark:bg-gray-900 rounded-sm shadow-xl border border-gray-200 dark:border-gray-800 p-6 flex flex-col items-center text-center relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-brand-500"></div>
             <img src="/cwn-logo.png" alt="Cyberscam Watchdog Network" className="w-auto h-24 object-contain mb-4 bg-transparent" />
             <h2 className="text-xl font-black text-gray-900 dark:text-white leading-tight mb-1 uppercase tracking-tight">
               Cyberscam Watchdog Network
             </h2>
             <p className="text-sm text-gray-500 dark:text-brand-500 mb-6 font-mono font-bold tracking-widest uppercase">EndScams.org</p>

             <div className="w-full pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-between text-sm items-center">
                <span className="text-gray-600 dark:text-gray-400 font-bold uppercase text-xs">Community Reports</span>
                <span className="font-mono font-black text-lg text-brand-500">12K+</span>
             </div>
             <div className="w-full pt-2 flex justify-between text-sm items-center">
                <span className="text-gray-600 dark:text-gray-400 font-bold uppercase text-xs">Scams Tracked</span>
                <span className="font-mono font-black text-lg text-brand-500">8.5K+</span>
             </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-sm shadow-xl p-5 border border-gray-200 dark:border-gray-800 relative">
             <div className="absolute top-0 left-0 w-1 h-full bg-gray-400 dark:bg-gray-600"></div>
             <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider mb-4 border-b border-gray-100 dark:border-gray-800 pb-2 pl-2">
               Partnered With
             </h3>
             <div className="grid gap-4 pl-2">
                <div className="flex items-center justify-center p-3 bg-gray-50 dark:bg-black rounded-sm border border-gray-200 dark:border-gray-800 hover:border-brand-500 transition-colors shadow-inner">
                  <img src="/partner-1.png" alt="Partner 1" className="h-16 object-contain" />
                </div>
                <div className="flex items-center justify-center p-3 bg-gray-50 dark:bg-black rounded-sm border border-gray-200 dark:border-gray-800 hover:border-brand-500 transition-colors shadow-inner">
                  <img src="/partner-2.png" alt="Partner 2" className="h-8 object-contain" />
                </div>
             </div>
          </div>
        </div>

        {/* Center Column: Search & Feed */}
        <div className="flex-1 flex flex-col gap-6">
          {/* Search Box */}
          <div className="bg-white dark:bg-[#111] rounded-sm shadow-[0_0_20px_rgba(255,107,0,0.15)] p-6 lg:p-8 border border-gray-200 dark:border-gray-800 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-brand-500 shadow-[0_0_10px_#FF6B00]"></div>
            <div className="flex items-center gap-3 mb-3">
              <Radar className="w-7 h-7 text-brand-500 animate-pulse" />
              <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight uppercase">Threat Intel Search</h2>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm font-medium">
              Cross-reference suspicious indicators against our real-time community threat database.
            </p>

            <form onSubmit={handleSearch} className="flex gap-3">
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="(555) 123-4567"
                className="flex-1 bg-gray-50 dark:bg-black border-2 border-gray-300 dark:border-gray-800 text-gray-900 dark:text-brand-500 font-mono text-xl rounded-sm px-4 py-4 focus:ring-0 focus:border-brand-500 outline-none transition-colors shadow-inner"
                disabled={isSearching}
              />
              <button
                type="submit"
                disabled={isSearching || phoneNumber.length < 10}
                className="bg-corporate-900 hover:bg-black dark:bg-brand-500 dark:hover:bg-brand-600 text-white px-8 py-4 rounded-sm font-black uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg"
              >
                {isSearching ? <Loader2 className="w-6 h-6 animate-spin" /> : <Search className="w-6 h-6" />}
                <span className="hidden sm:inline">Analyze</span>
              </button>
            </form>
          </div>

          {/* Search Results */}
          {result && (
            <div className="bg-white dark:bg-gray-800 rounded shadow-md p-6 border border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-2">
                <span>Search Results</span>
                <span className="text-brand-500 text-sm">{formatPhoneDisplay(result.searchDigits)}</span>
              </h3>

              {result.found ? (
                <div className="space-y-4">
                  <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded text-red-800 dark:text-red-200 text-sm mb-6 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong>Warning:</strong> We found {(result.reports.length + result.trackerEntries.length)} report{(result.reports.length + result.trackerEntries.length) > 1 ? 's' : ''} for this number. Exercise extreme caution.
                    </div>
                  </div>
                  {[...result.reports, ...result.trackerEntries].map((record) => (
                    <div key={record.id} className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4 rounded">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider px-2 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded">
                          {record.category}
                        </span>
                        <span className="text-xs text-gray-500">{new Date(record.incident_date || record.report_date || '').toLocaleDateString()}</span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">{record.description}</p>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                         <span className="text-xs text-gray-400">Source: {record.source || record.source_name}</span>
                         {record.source_url && (
                          <a href={record.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-500 hover:underline flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" />
                            View Source
                          </a>
                         )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                  <Shield className="w-12 h-12 text-green-500 mx-auto mb-3 opacity-50" />
                  <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">No records found</p>
                  <p className="text-sm">We don't have this number in our database yet.</p>
                </div>
              )}

              <div className="mt-8 pt-4 border-t border-gray-100 dark:border-gray-700">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">External Deep Search</p>
                <div className="flex flex-wrap gap-2">
                  {(["google", "bing", "brave"] as const).map((engine) => (
                    <a
                      key={engine}
                      href={buildSearchUrl(engine, result.searchDigits)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 min-w-[100px] flex items-center justify-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs font-medium text-gray-600 dark:text-gray-300 transition-colors"
                    >
                      Search {engine.charAt(0).toUpperCase() + engine.slice(1)} <ExternalLink className="w-3 h-3" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Impact & Resources */}
        <div className="w-full md:w-[300px] flex-shrink-0 flex flex-col gap-6">
          <div className="bg-white dark:bg-[#111] rounded-sm shadow-xl border border-gray-200 dark:border-gray-800 p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-brand-500/10 rounded-bl-full"></div>
            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider mb-4 border-b border-gray-200 dark:border-gray-800 pb-2 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-brand-500" /> Global Impact
            </h3>
            {impactStats ? (
              <div className="space-y-5">
                <div>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-widest mb-1">Reported Losses</p>
                  <p className="text-3xl font-black font-mono text-brand-500 drop-shadow-sm">{impactStats.total_loss_short}</p>
                </div>
                <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-widest mb-1">Victims (YoY)</p>
                  <p className="text-2xl font-black font-mono text-gray-900 dark:text-white">{impactStats.yoy_increase}</p>
                </div>
                <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-widest mb-1">Identity Theft</p>
                  <p className="text-2xl font-black font-mono text-gray-900 dark:text-white">{impactStats.identity_theft_victims}</p>
                </div>
              </div>
            ) : (
              <div className="py-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /></div>
            )}
          </div>

          <div className="bg-white dark:bg-[#111] rounded-sm shadow-xl p-5 border border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider mb-4 border-b border-gray-200 dark:border-gray-800 pb-2">
              Quick Links
            </h3>
            <div className="space-y-2">
              <Link to="/tracker" className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-900 rounded group transition-colors">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-brand-500 flex items-center gap-2"><Radar className="w-4 h-4"/> Tracker</span>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-brand-500" />
              </Link>
              <Link to="/ftc-scams" className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-900 rounded group transition-colors">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-brand-500 flex items-center gap-2"><AlertTriangle className="w-4 h-4"/> FTC Top Scams</span>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-brand-500" />
              </Link>
              <Link to="/education" className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-900 rounded group transition-colors">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-brand-500 flex items-center gap-2"><BookOpen className="w-4 h-4"/> Education</span>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-brand-500" />
              </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
