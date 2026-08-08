import { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, ExternalLink, Calendar, AlertTriangle, Loader2, PhoneOff, Shield, Activity, Database, Clock, Zap, Search, Plus, Download, ChevronDown, MessageCircle, Copy, Check, Globe } from 'lucide-react';
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

export default function TrackerPage() {
  const [entries, setEntries] = useState<CombinedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);

  // New UI states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterScamType, setFilterScamType] = useState('All Scam Types');
  const [filterPlatform, setFilterPlatform] = useState('All Platforms');
  const [filterCountry, setFilterCountry] = useState('All Countries');

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

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

      const trackerItems: CombinedEntry[] = (trackerRes.data || []).map((e: Entry) => ({
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

      const userItems: CombinedEntry[] = (reportsRes.data || []).map((e: UserReport) => ({
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

      const all = [...trackerItems, ...userItems]
        .filter(e => !isFakeNumber(e.digits))
        .sort((a, b) => (a.date < b.date ? 1 : -1));
      setEntries(all);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
      setReloading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleReload = async () => {
    setReloading(true);
    try {
      const fnUrl = import.meta.env.DEV
        ? 'http://localhost:8000/refresh'
        : `${import.meta.env.VITE_FETCHER_URL}/refresh`;

      await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (e) {
      console.error('Failed to reload data:', e);
    }
    await fetchData();
  };


  const filtered = useMemo(() => {
    let result = entries;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.phone.toLowerCase().includes(q) ||
          e.digits.includes(q) ||
          e.category.toLowerCase().includes(q) ||
          (e.description && e.description.toLowerCase().includes(q)) ||
          e.sourceName.toLowerCase().includes(q)
      );
    }

    if (filterScamType !== 'All Scam Types') {
      result = result.filter((e) => e.category === filterScamType);
    }

    // For this simple mock implementation, map platforms loosely based on sourceName
    if (filterPlatform !== 'All Platforms') {
       result = result.filter((e) => e.sourceName.toLowerCase().includes(filterPlatform.toLowerCase()));
    }

    return result;
  }, [entries, searchQuery, filterScamType, filterPlatform]);

  const uniqueCategories = useMemo(() => {
    const cats = new Set(entries.map((e) => e.category));
    return ['All Scam Types', ...Array.from(cats)];
  }, [entries]);

  const uniquePlatforms = useMemo(() => {
     // A crude extraction for the dropdown.
     return ['All Platforms', 'BBB Scam Tracker', 'Facebook', 'Instagram', 'TechScammersUnited', 'Google'];
  }, []);

  const uniqueCountries = useMemo(() => {
     return ['All Countries', 'US', 'NG', 'ZA', 'GB'];
  }, []);


  const totalEntries = entries.length;
  const scamTypesCount = new Set(entries.map(e => e.category)).size;
  const platformsCount = 6; // Mock for UI
  const countriesCount = 4; // Mock for UI

  return (
    <div className="min-h-screen bg-[#050B14] pt-[165px] pb-16 font-sans text-slate-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8 border-b border-slate-800 pb-6">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-500 border border-orange-500/30">
               <Shield className="w-6 h-6" />
             </div>
             <div>
               <div className="flex items-center gap-3 mb-1">
                 <h1 className="text-2xl font-bold text-white">End Scam Scan</h1>
                 <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium tracking-wide uppercase">
                   <Activity className="w-3 h-3" /> Auto-Live
                 </span>
               </div>
               <p className="text-sm text-slate-400">Automated multi-page Google & BBB Scam Tracker harvester (31-Day Retention)</p>
             </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
             <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
               <Clock className="w-4 h-4 text-emerald-500" />
               <span className="text-slate-400">Last Scan:</span>
               <span className="text-white">{lastUpdated ? lastUpdated.toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }) + ' PST' : 'Loading...'}</span>
             </div>
             <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
               <Clock className="w-4 h-4 text-orange-500" />
               <span className="text-slate-400">Next Refresh:</span>
               <span className="text-white">Today at 7:00 AM PST</span>
             </div>
             <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
               <Calendar className="w-4 h-4 text-blue-500" />
               <span className="text-slate-400">Retention:</span>
               <span className="text-white">31 Days Auto-Purge</span>
             </div>
          </div>
        </div>

        {/* Engine Panel */}
        <div className="bg-[#0A101C] border border-slate-800 rounded-xl p-6 mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 relative z-10">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <h2 className="text-lg font-bold text-white">End Scam Scan Engine</h2>
                <span className="text-xs px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 font-medium">Daily Refreshes @ 7:00 AM & 1:00 PM PST (24h Window)</span>
              </div>
              <p className="text-sm text-slate-400 max-w-2xl mb-6 leading-relaxed">
                Continuously extracts scam phone numbers across Facebook, Instagram, Guestbooks, and <strong className="text-slate-300">BBB Scam Tracker</strong> (Geek Squad & tech support scams). Auto-purges after 31 days with strict zero-duplicate filtering.
              </p>

              <div className="flex flex-wrap items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5 text-orange-400 font-medium">
                  <Zap className="w-4 h-4" /> Active Target Sources:
                </span>
                <span className="px-2 py-1 rounded bg-slate-800/50 text-slate-300 border border-slate-700/50 hover:bg-slate-800 transition-colors cursor-default">Google Deep Search</span>
                <span className="px-2 py-1 rounded bg-slate-800/50 text-orange-200 border border-orange-500/30 hover:bg-slate-800 transition-colors cursor-default">BBB Scam Tracker (Geek Squad)</span>
                <span className="px-2 py-1 rounded bg-slate-800/50 text-slate-300 border border-slate-700/50 hover:bg-slate-800 transition-colors cursor-default">Social Media Dorks</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 min-w-[200px]">
              <button
                onClick={handleReload}
                disabled={reloading}
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${reloading ? 'animate-spin' : ''}`} />
                {reloading ? 'Scanning...' : 'Manual Search (31 Days)'}
              </button>
              <button className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg font-medium transition-all">
                <Clock className="w-4 h-4 text-emerald-500" />
                Scan (24 Hours)
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-6 mt-6 pt-4 border-t border-slate-800/50 text-xs">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <Check className="w-4 h-4" /> Strict Zero-Duplicate Filter Active
            </span>
            <span className="flex items-center gap-1.5 text-blue-400">
              <Calendar className="w-4 h-4" /> 31-Day Retention Policy
            </span>
          </div>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-[#0A101C] border border-slate-800 rounded-xl p-5 flex items-center justify-between">
             <div>
               <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Total Numbers</p>
               <div className="flex items-baseline gap-2">
                 <span className="text-2xl font-black text-white">{totalEntries}</span>
                 <span className="text-xs text-slate-400">entries</span>
               </div>
             </div>
             <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20">
               <PhoneOff className="w-5 h-5" />
             </div>
          </div>

          <div className="bg-[#0A101C] border border-slate-800 rounded-xl p-5 flex items-center justify-between">
             <div>
               <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Scam Types</p>
               <div className="flex items-baseline gap-2">
                 <span className="text-2xl font-black text-white">{scamTypesCount}</span>
                 <span className="text-xs text-slate-400">categories</span>
               </div>
             </div>
             <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500 border border-orange-500/20">
               <AlertTriangle className="w-5 h-5" />
             </div>
          </div>

          <div className="bg-[#0A101C] border border-slate-800 rounded-xl p-5 flex items-center justify-between">
             <div>
               <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Platforms Target</p>
               <div className="flex items-baseline gap-2">
                 <span className="text-2xl font-black text-white">{platformsCount}</span>
                 <span className="text-xs text-slate-400">sources</span>
               </div>
             </div>
             <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
               <Globe className="w-5 h-5" />
             </div>
          </div>

          <div className="bg-[#0A101C] border border-slate-800 rounded-xl p-5 flex items-center justify-between">
             <div>
               <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Countries Detected</p>
               <div className="flex items-baseline gap-2">
                 <span className="text-2xl font-black text-white">{countriesCount}</span>
                 <span className="text-xs text-slate-400">regions</span>
               </div>
             </div>
             <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
               <Shield className="w-5 h-5" />
             </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <Loader2 className="w-10 h-10 text-orange-500 mx-auto mb-4 animate-spin" />
            <p className="text-slate-500">Loading scam tracker data...</p>
          </div>
        ) : (
          <div className="bg-[#0A101C] border border-slate-800 rounded-xl overflow-hidden flex flex-col">

            {/* Table Header/Toolbar */}
            <div className="p-4 border-b border-slate-800">
               <div className="flex items-center gap-2 mb-4">
                 <Shield className="w-4 h-4 text-orange-500" />
                 <h2 className="text-sm font-bold text-white">Harvested Scam Phone Database (Past 31 Days)</h2>
               </div>
               <p className="text-xs text-slate-400 mb-6">Sorted by date detected. Includes scam type, direct WhatsApp links, source links, and report context.</p>

               <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                 <div className="relative w-full md:w-96">
                   <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                     <Search className="h-4 w-4 text-slate-500" />
                   </div>
                   <input
                     type="text"
                     placeholder="Search by phone, date, scam type, URL, or snippet..."
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                     className="block w-full pl-10 pr-3 py-2 border border-slate-700 rounded-lg leading-5 bg-[#050B14] text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
                   />
                 </div>

                 <div className="flex items-center gap-2">
                   <button className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-sm font-medium transition-all">
                     <Plus className="w-4 h-4" /> Add Entry
                   </button>
                   <button className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 rounded-lg text-sm font-medium transition-all">
                     <Download className="w-4 h-4" /> Export CSV
                   </button>
                   <button className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/30 rounded-lg text-sm font-medium transition-all">
                     <Database className="w-4 h-4" /> JSON
                   </button>
                   <button className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-sm font-medium transition-all">
                     <Download className="w-4 h-4" /> TXT
                   </button>
                 </div>
               </div>

               {/* Filters */}
               <div className="flex flex-wrap items-center gap-3 mt-4">
                 <Filter className="w-4 h-4 text-slate-500 mr-1" />
                 <select
                   value={filterScamType}
                   onChange={(e) => setFilterScamType(e.target.value)}
                   className="pl-3 pr-8 py-1.5 bg-[#050B14] border border-slate-700 text-slate-300 rounded-lg text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-orange-500"
                 >
                   {uniqueCategories.map(cat => (
                     <option key={cat} value={cat}>{cat} {cat === 'All Scam Types' ? `(${totalEntries})` : ''}</option>
                   ))}
                 </select>

                 <select
                   value={filterPlatform}
                   onChange={(e) => setFilterPlatform(e.target.value)}
                   className="pl-3 pr-8 py-1.5 bg-[#050B14] border border-slate-700 text-slate-300 rounded-lg text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-orange-500"
                 >
                   {uniquePlatforms.map(plat => (
                     <option key={plat} value={plat}>{plat}</option>
                   ))}
                 </select>

                 <select
                   value={filterCountry}
                   onChange={(e) => setFilterCountry(e.target.value)}
                   className="pl-3 pr-8 py-1.5 bg-[#050B14] border border-slate-700 text-slate-300 rounded-lg text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-orange-500"
                 >
                   {uniqueCountries.map(country => (
                     <option key={country} value={country}>{country}</option>
                   ))}
                 </select>
               </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-[#050B14] border-b border-slate-800 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="p-4 w-10">
                      <input type="checkbox" className="rounded bg-slate-900 border-slate-700 text-orange-500 focus:ring-orange-500/20" />
                    </th>
                    <th className="p-4 cursor-pointer hover:text-slate-300">Date Detected <ChevronDown className="w-3 h-3 inline ml-1" /></th>
                    <th className="p-4 cursor-pointer hover:text-slate-300">Type of Scam <ChevronDown className="w-3 h-3 inline ml-1" /></th>
                    <th className="p-4 cursor-pointer hover:text-slate-300">Phone Number <ChevronDown className="w-3 h-3 inline ml-1" /></th>
                    <th className="p-4 cursor-pointer hover:text-slate-300">Source URL <ChevronDown className="w-3 h-3 inline ml-1" /></th>
                    <th className="p-4 cursor-pointer hover:text-slate-300">Platform <ChevronDown className="w-3 h-3 inline ml-1" /></th>
                    <th className="p-4">Context Snippet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {filtered.length === 0 ? (
                    <tr>
                       <td colSpan={7} className="p-8 text-center text-slate-500">
                         No entries match your search criteria.
                       </td>
                    </tr>
                  ) : (
                    filtered.map((entry) => (
                      <TrackerRow key={entry.id} entry={entry} />
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

// A stub for Filter icon since it wasn't imported from lucide-react initially
const Filter = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
);


function TrackerRow({ entry }: { entry: CombinedEntry }) {
  const categoryColors: Record<string, string> = {
    'Invoice / Imposter Scam': 'text-orange-400 bg-orange-400/10 border-orange-400/20',
    'Emergency Scam': 'text-red-400 bg-red-400/10 border-red-400/20',
    'Lottery / Prize Scam': 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
    'Government Impersonation': 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    'Spiritual / Spellcaster Scam': 'text-purple-400 bg-purple-400/10 border-purple-400/20',
    'Crypto Recovery Scam': 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
    'Apple Support Impersonation': 'text-slate-300 bg-slate-300/10 border-slate-300/20',
    'Tech Support / Geek Squad Impersonation': 'text-red-400 bg-red-400/10 border-red-400/20',
    'PayPal Invoice Scam': 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    'Sweepstakes / Lottery Scam': 'text-slate-300 bg-slate-300/10 border-slate-300/20',
  };
  const colorClass = categoryColors[entry.category] || 'text-slate-400 bg-slate-400/10 border-slate-400/20';

  // Format date
  const dateObj = new Date(entry.date);
  const formattedDate = dateObj.toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) + ' PST';

  // Extract short domain
  let shortDomain = entry.sourceName;
  if (entry.sourceUrl) {
    try {
      const url = new URL(entry.sourceUrl);
      shortDomain = url.hostname.replace('www.', '');
    } catch {
      // Ignore
    }
  }

  // Try to infer country and platform based on mock data in the image
  let countryCode = 'US';
  if (entry.phone.startsWith('+234')) countryCode = 'NG';
  if (entry.phone.startsWith('+44')) countryCode = 'GB';
  if (entry.phone.startsWith('+27')) countryCode = 'ZA';

  let platform = 'Unknown';
  if (entry.sourceName.toLowerCase().includes('facebook')) platform = 'Facebook';
  else if (entry.sourceName.toLowerCase().includes('instagram')) platform = 'Instagram';
  else if (entry.sourceName.toLowerCase().includes('bbb')) platform = 'BBB Scam Tracker';
  else if (shortDomain.includes('techscammersunited')) platform = 'TechScammersUnited';
  else platform = entry.sourceName;


  return (
    <tr className="hover:bg-slate-800/30 transition-colors group">
      <td className="p-4">
        <input type="checkbox" className="rounded bg-slate-900 border-slate-700 text-orange-500 focus:ring-orange-500/20" />
      </td>
      <td className="p-4 text-slate-300">{formattedDate}</td>
      <td className="p-4">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${colorClass}`}>
          {entry.category}
        </span>
      </td>
      <td className="p-4 font-mono font-bold text-white flex items-center gap-2">
        {entry.phone}
        <span className="text-[10px] bg-slate-800 text-slate-400 px-1 py-0.5 rounded">{countryCode}</span>
        <button className="w-6 h-6 rounded bg-emerald-500/10 text-emerald-500 flex items-center justify-center hover:bg-emerald-500/20" title="WhatsApp">
           <MessageCircle className="w-3.5 h-3.5" />
        </button>
        <button className="w-6 h-6 rounded bg-slate-800 text-slate-400 flex items-center justify-center hover:bg-slate-700 hover:text-white" title="Copy">
           <Copy className="w-3.5 h-3.5" />
        </button>
      </td>
      <td className="p-4">
         <div className="flex items-center gap-2">
           <span className="text-slate-300">{shortDomain}</span>
           {entry.sourceUrl && (
             <a href={entry.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:text-orange-400">
               <ExternalLink className="w-3.5 h-3.5" />
             </a>
           )}
           <button className="text-slate-500 hover:text-slate-300"><Copy className="w-3.5 h-3.5" /></button>
         </div>
      </td>
      <td className="p-4">
         <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
          {platform}
         </span>
      </td>
      <td className="p-4">
         <div className="max-w-[200px] truncate text-slate-400 text-xs italic">
           {entry.description ? `"${entry.description}"` : '-'}
         </div>
      </td>
    </tr>
  );
}
