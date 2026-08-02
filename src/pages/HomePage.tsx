import { useState } from 'react';
import { Search, Shield, AlertTriangle, ExternalLink, Loader2, Radar, BookOpen,  } from 'lucide-react';
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
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 mt-16 pb-20">

      {/* Central Terminal / Search Box */}
      <div className="w-full max-w-4xl text-center mb-8 mt-12 animate-fade-in">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-500/10 mb-6">
          <Radar className="w-8 h-8 text-brand-500 animate-pulse" />
        </div>
        <h1 className="text-2xl md:text-4xl font-black text-white mb-4 tracking-tight uppercase">Threat Database Search</h1>
        <p className="text-gray-400 font-mono text-sm md:text-base max-w-2xl mx-auto">
          Cross-reference suspicious indicators against our real-time community threat database.
        </p>
      </div>

      <div className="w-full max-w-4xl bg-[#111] rounded-sm shadow-[0_0_40px_rgba(255,107,0,0.15)] p-8 lg:p-12 border border-brand-500 relative z-10">
        <div className="absolute top-0 left-0 w-full h-1 bg-brand-500 shadow-[0_0_10px_#FF6B00]"></div>

        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="(555) 123-4567"
            className="flex-1 bg-black border-2 border-gray-800 text-brand-500 font-mono text-lg rounded-sm px-6 py-5 focus:ring-0 focus:border-brand-500 outline-none transition-colors shadow-inner text-center md:text-left tracking-widest"
            disabled={isSearching}
          />
          <button
            type="submit"
            disabled={isSearching || phoneNumber.length < 10}
            className="bg-brand-500 hover:bg-brand-600 text-white px-10 py-5 rounded-sm font-black uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg"
          >
            {isSearching ? <Loader2 className="w-6 h-6 animate-spin" /> : <Search className="w-6 h-6" />}
            <span className="text-lg">Analyze</span>
          </button>
        </form>

        {/* Quick Action Links inside search box for unified feel */}
        <div className="mt-8 pt-8 border-t border-gray-800 flex flex-wrap justify-center gap-4">
          <Link to="/education" className="text-gray-400 hover:text-brand-500 font-bold uppercase text-xs tracking-wider transition-colors flex items-center gap-1">
            <BookOpen className="w-3 h-3" /> Get Educated
          </Link>
          <span className="text-gray-800">•</span>
          <Link to="/report" className="text-gray-400 hover:text-brand-500 font-bold uppercase text-xs tracking-wider transition-colors flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Report a Scam
          </Link>
          <span className="text-gray-800">•</span>
          <Link to="/tracker" className="text-gray-400 hover:text-brand-500 font-bold uppercase text-xs tracking-wider transition-colors flex items-center gap-1">
            <Radar className="w-3 h-3" /> Live Tracker
          </Link>
        </div>
      </div>

      {/* Search Results */}
      {result && (
        <div className="w-full max-w-4xl mt-8 animate-slide-up">
          <div className="bg-[#111] rounded-sm shadow-xl border border-gray-800 p-8">
            <h3 className="text-xl font-black text-white mb-6 flex justify-between items-center border-b border-gray-800 pb-4 uppercase tracking-wider">
              <span>Analysis Results</span>
              <span className="text-brand-500 font-mono">{formatPhoneDisplay(result.searchDigits)}</span>
            </h3>

            {result.found ? (
              <div className="space-y-4">
                <div className="bg-red-900/20 border-l-4 border-red-500 p-4 rounded-sm text-red-200 text-sm mb-8 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong>CRITICAL WARNING:</strong> Found {(result.reports.length + result.trackerEntries.length)} record{(result.reports.length + result.trackerEntries.length) > 1 ? 's' : ''} for this indicator. Exercise extreme caution.
                  </div>
                </div>
                {[...result.reports, ...result.trackerEntries].map((record) => (
                  <div key={record.id} className="bg-black border border-gray-800 p-5 rounded-sm relative overflow-hidden">
                    <div className="absolute left-0 top-0 w-1 h-full bg-red-500"></div>
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-xs font-black uppercase tracking-widest px-2 py-1 bg-red-900/30 text-red-400 rounded-sm">
                        {record.category}
                      </span>
                      <span className="text-xs font-mono text-gray-500">{new Date(record.incident_date || record.report_date || '').toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-gray-300 mt-2 leading-relaxed">{record.description}</p>
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-900">
                       <span className="text-xs font-mono text-gray-500">SOURCE: {record.source || record.source_name}</span>
                       {record.source_url && (
                        <a href={record.source_url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-brand-500 hover:text-brand-400 uppercase tracking-wider flex items-center gap-1 transition-colors">
                          <ExternalLink className="w-3 h-3" /> View Source
                        </a>
                       )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-gray-400">
                <Shield className="w-16 h-16 text-green-500/50 mx-auto mb-4" />
                <p className="text-xl font-black text-white mb-2 uppercase tracking-wide">No Records Found</p>
                <p className="text-sm font-mono">This indicator is not currently in our database.</p>
              </div>
            )}

            <div className="mt-10 pt-6 border-t border-gray-800">
              <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-4">External Deep Search</p>
              <div className="grid grid-cols-3 gap-4">
                {(["google", "bing", "brave"] as const).map((engine) => (
                  <a
                    key={engine}
                    href={buildSearchUrl(engine, result.searchDigits)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-black hover:bg-gray-900 border border-gray-800 rounded-sm text-xs font-bold text-gray-400 hover:text-brand-500 uppercase tracking-wider transition-colors"
                  >
                    {engine} <ExternalLink className="w-3 h-3" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Impact Stats - Horizontal Strip */}
      {impactStats && (
        <div className="w-full max-w-4xl mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 animate-fade-in">
          <div className="bg-[#111] border-t-2 border-brand-500 p-6 text-center shadow-lg relative overflow-hidden group">
            <div className="absolute inset-0 bg-brand-500/5 group-hover:bg-brand-500/10 transition-colors"></div>
            <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2">Reported Losses</p>
            <p className="text-2xl font-black font-mono text-brand-500 drop-shadow-sm">{impactStats.total_loss_short}</p>
          </div>
          <div className="bg-[#111] border-t-2 border-brand-500 p-6 text-center shadow-lg relative overflow-hidden group">
            <div className="absolute inset-0 bg-brand-500/5 group-hover:bg-brand-500/10 transition-colors"></div>
            <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2">Victims (YoY)</p>
            <p className="text-2xl font-black font-mono text-white">{impactStats.yoy_increase}</p>
          </div>
          <div className="bg-[#111] border-t-2 border-brand-500 p-6 text-center shadow-lg relative overflow-hidden group">
            <div className="absolute inset-0 bg-brand-500/5 group-hover:bg-brand-500/10 transition-colors"></div>
            <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2">Identity Theft</p>
            <p className="text-2xl font-black font-mono text-white">{impactStats.identity_theft_victims}</p>
          </div>
        </div>
      )}

      {/* Organization Footer-like Strip */}
      <div className="w-full max-w-4xl mt-16 pt-8 border-t border-gray-800 flex flex-col md:flex-row items-center justify-between opacity-70 hover:opacity-100 transition-opacity gap-6 md:gap-0">
         <div className="flex items-center gap-4">
           <img src="/cwn-logo.png" alt="CWN" className="w-12 h-12 object-contain filter grayscale hover:grayscale-0 transition-all" />
           <div>
             <h2 className="text-sm font-black text-white uppercase tracking-wider">Cyberscam Watchdog Network</h2>
             <p className="text-xs text-brand-500 font-mono font-bold tracking-widest">EndScams.org</p>
           </div>
         </div>
         <div className="flex items-center gap-6">
            <span className="text-xs font-black uppercase text-gray-500 tracking-widest">Partners</span>
            <img src="/partner-1.png" alt="Partner 1" className="h-8 object-contain filter grayscale hover:grayscale-0 transition-all" />
            <img src="/partner-2.png" alt="Partner 2" className="h-5 object-contain filter grayscale hover:grayscale-0 transition-all" />
         </div>
      </div>
    </div>
  );
}
