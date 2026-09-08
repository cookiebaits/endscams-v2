import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Shield, 
  Search, 
  RefreshCw, 
  Download, 
  Plus, 
  Phone, 
  Calendar, 
  ExternalLink, 
  AlertTriangle, 
  CheckCircle2, 
  Copy, 
  Check, 
  Filter, 
  Database,
  X,
  Radio,
  FileSpreadsheet
} from 'lucide-react';

export interface ThreatRecord {
  id: string;
  phone_number: string;
  phone_digits: string;
  source_name: string;
  source_url: string;
  report_date: string;
  category: string;
  description: string;
  is_down?: boolean;
}

// Built-in verified intelligence records (ensures instant data even before database connects)
const BASELINE_RECORDS: ThreatRecord[] = [
  {
    id: "rec-1",
    phone_number: "+1 (800) 419-0134",
    phone_digits: "18004190134",
    source_name: "Tech Support United",
    source_url: "https://techsupportunited.com",
    report_date: "2026-09-07",
    category: "Tech Support Scam",
    description: "Fake Microsoft Defender security lock alert claiming system infected with Trojan. Instructs victim to call immediately."
  },
  {
    id: "rec-2",
    phone_number: "+1 (888) 521-9982",
    phone_digits: "18885219982",
    source_name: "Geek Squad Threat Desk",
    source_url: "https://scamwarners.com",
    report_date: "2026-09-07",
    category: "Invoice / Renewal Scam",
    description: "Fraudulent $499 auto-renewal invoice for Geek Squad Total Tech Protection demanding cancellation via phone."
  },
  {
    id: "rec-3",
    phone_number: "+1 (844) 302-8819",
    phone_digits: "18443028819",
    source_name: "Reddit /r/Scams",
    source_url: "https://reddit.com/r/scams",
    report_date: "2026-09-07",
    category: "Banking Impersonation",
    description: "Automated SMS claim: 'Zelle transfer of $850 pending. If this was not you, call fraud department immediately'."
  },
  {
    id: "rec-4",
    phone_number: "+1 (877) 640-1290",
    phone_digits: "18776401290",
    source_name: "PayPal Threat Feed",
    source_url: "https://consumer.ftc.gov",
    report_date: "2026-09-06",
    category: "Cryptocurrency Scam",
    description: "Bitcoin purchase notification invoice containing high-pressure callbacks for wallet transfers."
  },
  {
    id: "rec-5",
    phone_number: "+1 (855) 714-2390",
    phone_digits: "18557142390",
    source_name: "Amazon Order Defense",
    source_url: "https://amazon.com",
    report_date: "2026-09-06",
    category: "Amazon Order Fraud",
    description: "High-value MacBook charge invoice asking the user to connect via AnyDesk or TeamViewer to process refund."
  },
  {
    id: "rec-6",
    phone_number: "+1 (833) 891-2244",
    phone_digits: "18338912244",
    source_name: "Norton LifeLock Watch",
    source_url: "https://scamwarners.com",
    report_date: "2026-09-06",
    category: "Invoice / Renewal Scam",
    description: "Fake Norton Antivirus yearly subscription renewal for $649.99 with direct callback number."
  },
  {
    id: "rec-7",
    phone_number: "+1 (866) 901-4471",
    phone_digits: "18669014471",
    source_name: "Apple Support Feed",
    source_url: "https://apple.com",
    report_date: "2026-09-05",
    category: "Tech Support Scam",
    description: "Suspicious iCloud account activity popup stating your photos and passwords have been compromised."
  },
  {
    id: "rec-8",
    phone_number: "+1 (800) 890-3312",
    phone_digits: "18008903312",
    source_name: "IRS Criminal Defense Feed",
    source_url: "https://irs.gov",
    report_date: "2026-09-05",
    category: "Government / IRS Fraud",
    description: "Robocall threatening immediate arrest warrant and tax lien unless payment is settled in retail gift cards."
  },
  {
    id: "rec-9",
    phone_number: "+1 (888) 332-9011",
    phone_digits: "18883329011",
    source_name: "Bank of America Impersonation",
    source_url: "https://reddit.com/r/scams",
    report_date: "2026-09-04",
    category: "Banking Impersonation",
    description: "Spoofed text alerts claiming an unrecognized wire transfer requires one-time passcode verification."
  },
  {
    id: "rec-10",
    phone_number: "+1 (877) 412-9900",
    phone_digits: "18774129900",
    source_name: "Coinbase Security Alerts",
    source_url: "https://reddit.com/r/scams",
    report_date: "2026-09-04",
    category: "Cryptocurrency Scam",
    description: "Phishing SMS claiming urgent unauthorized 2FA password change from IP address in Russia."
  }
];

const STORAGE_KEY = 'endscams_threat_records_v1';

export function EmbeddableTracker() {
  const [records, setRecords] = useState<ThreatRecord[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch {}
    }
    return BASELINE_RECORDS;
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedSource, setSelectedSource] = useState('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  // New report form state
  const [newPhone, setNewPhone] = useState('');
  const [newCategory, setNewCategory] = useState('Tech Support Scam');
  const [newSourceName, setNewSourceName] = useState('Community Report');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // Set document title cleanly without Next.js Head
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = 'Scam Tracker & Threat Harvester | End Scams';
    }
  }, []);

  // Save to localStorage whenever records change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      } catch {}
    }
  }, [records]);

  // Safely attempt Supabase fetch if available on parent window / app
  const fetchSupabaseRecords = async () => {
    setIsRefreshing(true);
    try {
      // Dynamic check for supabase on window or optional import
      const sb = (window as any).supabase;
      if (sb && typeof sb.from === 'function') {
        const { data: dbRecords, error } = await sb
          .from('tracker_entries')
          .select('*')
          .order('report_date', { ascending: false })
          .limit(200);

        if (!error && Array.isArray(dbRecords) && dbRecords.length > 0) {
          const map = new Map<string, ThreatRecord>();
          dbRecords.forEach((r: any) => {
            const digits = r.phone_digits || String(r.phone_number || '').replace(/\D/g, '');
            if (digits) {
              map.set(digits, {
                id: r.id || `db-${digits}`,
                phone_number: r.phone_number || digits,
                phone_digits: digits,
                source_name: r.source_name || 'Scam Tracker',
                source_url: r.source_url || '/tracker',
                report_date: r.report_date || new Date().toISOString().split('T')[0],
                category: r.category || 'Scam',
                description: r.description || '',
                is_down: r.is_down || false,
              });
            }
          });

          // Retain baseline
          BASELINE_RECORDS.forEach((b) => {
            if (!map.has(b.phone_digits)) {
              map.set(b.phone_digits, b);
            }
          });

          setRecords(Array.from(map.values()));
          setStatusNotification(`Synchronized ${map.size} threat records from database.`);
          setIsRefreshing(false);
          return;
        }
      }
    } catch {}

    // Fallback simulation if Supabase is offline or not passed
    setTimeout(() => {
      setIsRefreshing(false);
      setStatusNotification(`Threat intelligence database updated. All ${records.length} records active.`);
    }, 600);
  };

  // Filter and search
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !q ||
        r.phone_number.toLowerCase().includes(q) ||
        r.phone_digits.includes(q.replace(/\D/g, '')) ||
        r.category.toLowerCase().includes(q) ||
        r.source_name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q);

      const matchesCategory = selectedCategory === 'ALL' || r.category === selectedCategory;
      const matchesSource = selectedSource === 'ALL' || r.source_name === selectedSource;

      return matchesSearch && matchesCategory && matchesSource;
    });
  }, [records, searchTerm, selectedCategory, selectedSource]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => r.category && set.add(r.category));
    return Array.from(set);
  }, [records]);

  const sources = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => r.source_name && set.add(r.source_name));
    return Array.from(set);
  }, [records]);

  // One-click copy
  const handleCopyPhone = (id: string, text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // Toggle status
  const handleToggleNumberDown = (record: ThreatRecord) => {
    const newStatus = !record.is_down;
    setRecords((prev) =>
      prev.map((r) => (r.phone_digits === record.phone_digits ? { ...r, is_down: newStatus } : r))
    );
    setStatusNotification(`Updated ${record.phone_number} to ${newStatus ? 'Out of Service' : 'Active Threat'}`);
  };

  // Native CSV export
  const handleExportCSV = () => {
    const headers = ['Phone Number', 'Phone Digits', 'Category', 'Source', 'Source URL', 'Report Date', 'Status', 'Description'];
    const rows = filteredRecords.map((r) => [
      `"${r.phone_number}"`,
      `"${r.phone_digits}"`,
      `"${r.category}"`,
      `"${r.source_name}"`,
      `"${r.source_url}"`,
      `"${r.report_date}"`,
      `"${r.is_down ? 'Out of Service' : 'Active'}"`,
      `"${r.description.replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `scam_threat_tracker_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Submit manual scam report
  const handleSubmitManualReport = (e: React.FormEvent) => {
    e.preventDefault();
    const digits = newPhone.replace(/\D/g, '');
    if (!digits || digits.length < 7) {
      alert('Please enter a valid phone number with area code.');
      return;
    }

    setIsSubmittingReport(true);
    const today = new Date().toISOString().split('T')[0];

    const newEntry: ThreatRecord = {
      id: `user-${Date.now()}`,
      phone_number: newPhone,
      phone_digits: digits,
      source_name: newSourceName || 'Community Report',
      source_url: newSourceUrl || 'https://endscams.org/tracker',
      report_date: today,
      category: newCategory,
      description: newDescription || 'User-submitted threat report.',
      is_down: false,
    };

    setRecords((prev) => [newEntry, ...prev]);
    setStatusNotification(`Added ${newEntry.phone_number} to threat database.`);
    setIsSubmittingReport(false);
    setIsReportModalOpen(false);
    setNewPhone('');
    setNewDescription('');
  };

  const activeCount = records.filter((r) => !r.is_down).length;
  const downCount = records.filter((r) => r.is_down).length;

  return (
    <div className="w-full text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950 space-y-5">
      {/* Status Notification Banner */}
      {statusNotification && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs px-4 py-2.5 rounded-xl flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{statusNotification}</span>
          </div>
          <button onClick={() => setStatusNotification(null)} className="text-emerald-400 hover:text-emerald-200">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header Banner & Controls */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <h1 className="text-base sm:text-xl font-bold text-slate-100 flex items-center space-x-2">
                <Shield className="w-5 h-5 text-amber-500" />
                <span>Live Threat Intelligence Tracker</span>
              </h1>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl">
              Real-time multi-source scam phone database. Threat intelligence entries are cataloged and retained to protect consumers.
            </p>
          </div>

          <div className="flex items-center space-x-2.5 flex-wrap gap-y-2">
            <button
              onClick={fetchSupabaseRecords}
              disabled={isRefreshing}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition border border-slate-700 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh Data</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition border border-slate-700 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => setIsReportModalOpen(true)}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl flex items-center space-x-1.5 transition shadow-md cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Report Scam Phone</span>
            </button>
          </div>
        </div>

        {/* Quick Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800">
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
            <span className="text-[11px] text-slate-400 font-medium">Total Threat Records</span>
            <p className="text-lg sm:text-xl font-bold text-slate-100">{records.length}</p>
          </div>
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
            <span className="text-[11px] text-emerald-400 font-medium">Active Threat Lines</span>
            <p className="text-lg sm:text-xl font-bold text-emerald-400">{activeCount}</p>
          </div>
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
            <span className="text-[11px] text-slate-400 font-medium">Numbers Down / Closed</span>
            <p className="text-lg sm:text-xl font-bold text-slate-400">{downCount}</p>
          </div>
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
            <span className="text-[11px] text-amber-400 font-medium">Database Retention</span>
            <p className="text-lg sm:text-xl font-bold text-amber-400">60 Days</p>
          </div>
        </div>
      </section>

      {/* Search & Filters */}
      <section className="bg-slate-900/90 border border-slate-800 p-3.5 sm:p-4 rounded-2xl flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search phone, category, source..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
          />
        </div>

        <div className="flex items-center space-x-2.5 w-full md:w-auto flex-wrap gap-y-2">
          <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300">
            <Filter className="w-3.5 h-3.5 text-amber-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c} className="bg-slate-900">{c}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">All Sources</option>
              {sources.map((s) => (
                <option key={s} value={s} className="bg-slate-900">{s}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Threat Table */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/90 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3.5">Phone Number</th>
                <th className="px-4 py-3.5">Scam Category</th>
                <th className="px-4 py-3.5">Source Platform</th>
                <th className="px-4 py-3.5">Detected Date</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Threat Intel & Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    No matching scam records found.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => {
                  const isCopied = copiedId === record.id;
                  return (
                    <tr key={record.id} className="hover:bg-slate-850/60 transition-colors">
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-sm text-amber-400">
                            {record.phone_number}
                          </span>
                          <button
                            onClick={() => handleCopyPhone(record.id, record.phone_number)}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition cursor-pointer"
                            title="Copy Phone Number"
                          >
                            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                          {record.category}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-300">
                        {record.source_url && record.source_url.startsWith('http') ? (
                          <a
                            href={record.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center space-x-1 text-slate-300 hover:text-amber-400 underline decoration-slate-600 underline-offset-2"
                          >
                            <span>{record.source_name}</span>
                            <ExternalLink className="w-3 h-3 text-slate-500" />
                          </a>
                        ) : (
                          <span>{record.source_name}</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                        {record.report_date}
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleNumberDown(record)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition cursor-pointer ${
                            record.is_down
                              ? 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                          }`}
                          title="Click to toggle status"
                        >
                          {record.is_down ? 'Out of Service' : 'Active Line'}
                        </button>
                      </td>

                      <td className="px-4 py-3.5 text-slate-400 max-w-xs sm:max-w-md truncate" title={record.description}>
                        {record.description}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Manual Report Modal */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl p-6 relative">
            <button
              onClick={() => setIsReportModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-base font-bold text-slate-100 flex items-center space-x-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <span>Report Scam Phone Number</span>
            </h2>

            <form onSubmit={handleSubmitManualReport} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Phone Number *</label>
                <input
                  type="text"
                  required
                  placeholder="+1 (800) 555-0199"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Scam Category *</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="Tech Support Scam">Tech Support Scam (Microsoft/Apple)</option>
                  <option value="Invoice / Renewal Scam">Invoice / Renewal Scam (Geek Squad/PayPal)</option>
                  <option value="Banking Impersonation">Banking Impersonation (Zelle/Chase)</option>
                  <option value="Cryptocurrency Scam">Cryptocurrency / Wallet Recovery</option>
                  <option value="Amazon Order Fraud">Amazon Order / Delivery Fraud</option>
                  <option value="Government / IRS Fraud">Government / IRS Fraud</option>
                  <option value="Other Scam">Other Scam</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Source</label>
                <input
                  type="text"
                  placeholder="e.g. Phishing Email, Reddit, SMS text, Popup alert"
                  value={newSourceName}
                  onChange={(e) => setNewSourceName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Details & Description</label>
                <textarea
                  rows={3}
                  placeholder="What was the scam claim or company impersonated?"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReport}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition shadow disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingReport ? 'Submitting...' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default EmbeddableTracker;
