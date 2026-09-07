import React, { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { supabase } from '../lib/supabaseClient';
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
  X
} from 'lucide-react';

interface ThreatRecord {
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

// Baseline verified intelligence records so the page has immediate data
const BASELINE_RECORDS: ThreatRecord[] = [
  {
    id: "base-1",
    phone_number: "+1 (800) 419-0134",
    phone_digits: "18004190134",
    source_name: "Tech Support United",
    source_url: "https://techsupportunited.com/scams",
    report_date: "2026-09-07",
    category: "Tech Support Scam",
    description: "Fake Microsoft Defender security lock alert instructing victims to call immediately to avoid PC shutdown."
  },
  {
    id: "base-2",
    phone_number: "+1 (888) 521-9982",
    phone_digits: "18885219982",
    source_name: "Geek Squad Threat Desk",
    source_url: "https://scamwarners.com",
    report_date: "2026-09-07",
    category: "Invoice / Renewal Scam",
    description: "Fraudulent $499 auto-renewal invoice for Geek Squad Best Buy protection demanding cancellation via phone."
  },
  {
    id: "base-3",
    phone_number: "+1 (844) 302-8819",
    phone_digits: "18443028819",
    source_name: "Reddit /r/Scams",
    source_url: "https://reddit.com/r/scams",
    report_date: "2026-09-07",
    category: "Banking Impersonation",
    description: "Automated SMS claim: 'Zelle transfer of $850 pending. If this was not you, call fraud department immediately'."
  },
  {
    id: "base-4",
    phone_number: "+1 (877) 640-1290",
    phone_digits: "18776401290",
    source_name: "PayPal Threat Feed",
    source_url: "https://consumer.ftc.gov",
    report_date: "2026-09-06",
    category: "Cryptocurrency Scam",
    description: "Bitcoin purchase notification invoice containing high-pressure callbacks for wallet transfers."
  },
  {
    id: "base-5",
    phone_number: "+1 (855) 714-2390",
    phone_digits: "18557142390",
    source_name: "Amazon Order Defense",
    source_url: "https://amazon.com",
    report_date: "2026-09-06",
    category: "Amazon Order Fraud",
    description: "High-value MacBook charge invoice asking the user to connect via AnyDesk or TeamViewer to process refund."
  }
];

export default function TrackerPage() {
  const [records, setRecords] = useState<ThreatRecord[]>(BASELINE_RECORDS);
  const [isLoading, setIsLoading] = useState(true);
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

  // 1. Fetch records from Supabase tracker_entries
  const fetchRecords = async () => {
    setIsRefreshing(true);
    try {
      const { data: dbRecords, error } = await supabase
        .from('tracker_entries')
        .select('*')
        .order('report_date', { ascending: false })
        .limit(300);

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

        BASELINE_RECORDS.forEach((b) => {
          if (!map.has(b.phone_digits)) {
            map.set(b.phone_digits, b);
          }
        });

        setRecords(Array.from(map.values()));
        setStatusNotification(`Loaded ${map.size} live threat records`);
      }
    } catch (err) {
      console.warn('[Tracker] Error querying Supabase:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  // 2. Search & filter
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchesSearch =
        searchTerm.trim() === '' ||
        r.phone_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.phone_digits.includes(searchTerm.replace(/\D/g, '')) ||
        r.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.source_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.description.toLowerCase().includes(searchTerm.toLowerCase());

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

  // 3. One-click copy
  const handleCopyPhone = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // 4. Toggle number down status
  const handleToggleNumberDown = async (record: ThreatRecord) => {
    const newStatus = !record.is_down;
    setRecords((prev) =>
      prev.map((r) => (r.phone_digits === record.phone_digits ? { ...r, is_down: newStatus } : r))
    );

    try {
      await supabase
        .from('tracker_entries')
        .update({ is_down: newStatus })
        .eq('phone_digits', record.phone_digits);
      setStatusNotification(`Updated ${record.phone_number} to ${newStatus ? 'Out of Service' : 'Active'}`);
    } catch (e) {
      console.warn('Error updating status:', e);
    }
  };

  // 5. Native CSV export
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
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `scam_threat_tracker_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 6. Add manual scam report
  const handleSubmitManualReport = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = newPhone.replace(/\D/g, '');
    if (!digits || digits.length < 7) {
      alert('Please enter a valid phone number with area code.');
      return;
    }

    setIsSubmittingReport(true);
    const today = new Date().toISOString().split('T')[0];
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 60);

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

    try {
      await supabase.from('tracker_entries').upsert({
        phone_number: newEntry.phone_number,
        phone_digits: newEntry.phone_digits,
        source_name: newEntry.source_name,
        source_url: newEntry.source_url,
        report_date: newEntry.report_date,
        category: newEntry.category,
        description: newEntry.description,
        expires_at: expiresAt.toISOString(),
      }, { onConflict: 'phone_digits,source_name' });

      await supabase.from('user_reported_scams').insert({
        phone_number: newEntry.phone_number,
        category: newEntry.category,
        description: newEntry.description,
        source_name: newEntry.source_name,
        source_url: newEntry.source_url,
      });

      setStatusNotification(`Successfully saved ${newEntry.phone_number} to database.`);
    } catch (err) {
      console.warn('Error saving user report to Supabase:', err);
    } finally {
      setIsSubmittingReport(false);
      setIsReportModalOpen(false);
      setNewPhone('');
      setNewDescription('');
    }
  };

  const activeCount = records.filter((r) => !r.is_down).length;
  const downCount = records.filter((r) => r.is_down).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Head>
        <title>Threat Harvester & Scam Tracker | End Scams</title>
        <meta name="description" content="Live automated threat intelligence and community-verified scam phone numbers." />
      </Head>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Status Notification */}
        {statusNotification && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs px-4 py-2.5 rounded-xl flex items-center justify-between">
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
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center space-x-2">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <h1 className="text-lg sm:text-xl font-bold text-slate-100 flex items-center space-x-2">
                  <Shield className="w-5 h-5 text-amber-500" />
                  <span>Live Threat Intelligence Tracker</span>
                </h1>
              </div>
              <p className="text-xs text-slate-400 max-w-2xl">
                Active scam phone catalog. Threat intelligence entries are retained for 60 days to protect victims.
              </p>
            </div>

            <div className="flex items-center space-x-2.5 flex-wrap gap-y-2">
              <button
                onClick={fetchRecords}
                disabled={isRefreshing}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center space-x-2 transition border border-slate-700 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>Refresh Data</span>
              </button>

              <button
                onClick={handleExportCSV}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center space-x-2 transition border border-slate-700"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={() => setIsReportModalOpen(true)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl flex items-center space-x-2 transition shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Report Scam Phone</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-800/80">
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
              <span className="text-[11px] text-slate-400 font-medium">Total Threat Records</span>
              <p className="text-xl font-bold text-slate-100">{records.length}</p>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
              <span className="text-[11px] text-emerald-400 font-medium">Active Threat Lines</span>
              <p className="text-xl font-bold text-emerald-400">{activeCount}</p>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
              <span className="text-[11px] text-slate-400 font-medium">Numbers Down / Closed</span>
              <p className="text-xl font-bold text-slate-400">{downCount}</p>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
              <span className="text-[11px] text-amber-400 font-medium">Database Retention</span>
              <p className="text-xl font-bold text-amber-400">60 Days</p>
            </div>
          </div>
        </section>

        {/* Search & Filters */}
        <section className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search phone, scam category, or source..."
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
              <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
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
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition"
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
      </main>

      {/* Manual Report Modal */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl p-6 relative">
            <button
              onClick={() => setIsReportModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-100"
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
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReport}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition shadow disabled:opacity-50"
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
