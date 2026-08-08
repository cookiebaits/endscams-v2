import { useState, useEffect } from 'react';
import { Navbar } from '../components/Navbar';
import { StatsCards } from '../components/StatsCards';
import { ResultsTable } from '../components/ResultsTable';
import { ScamPhoneRecord } from '../types';
import { ShieldAlert, RefreshCw, Sparkles, AlertCircle, Clock, Calendar, CheckCircle2, ShieldCheck } from 'lucide-react';

export default function TrackerPage() {
  const [records, setRecords] = useState<ScamPhoneRecord[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);
  const [_lastScanSummary, setLastScanSummary] = useState<string>('Database loaded.');
  const [nextScheduledRefresh, setNextScheduledRefresh] = useState<string>('7:00 AM & 1:00 PM PST Daily');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch records from backend API
  const fetchRecords = async () => {
    try {
      const response = await fetch(import.meta.env.DEV ? 'http://localhost:8000/api/records' : `${import.meta.env.VITE_FETCHER_URL}/api/records`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.records)) {
          setRecords(data.records);
          setLastScanTime(data.lastScanTime);
          if (data.lastScanSummary) setLastScanSummary(data.lastScanSummary);
          if (data.nextScheduledRefresh) setNextScheduledRefresh(data.nextScheduledRefresh);
          setIsScanning(Boolean(data.isScanningInProgress));
        }
      }
    } catch (err) {
      console.error('Error fetching records from server:', err);
    }
  };

  useEffect(() => {
    fetchRecords();
    // Poll server records every 15 seconds to update table if background harvester runs
    const interval = setInterval(fetchRecords, 15000);
    return () => clearInterval(interval);
  }, []);

  // Trigger manual harvester scan (31 days window or 24 hours window)
  const handleRunScanNow = async (windowDays: number = 31) => {
    setIsScanning(true);
    setErrorMessage(null);
    const windowLabel = windowDays === 1 ? 'last 24 hours' : 'last 31 days';
    setStatusMessage(`Initiating harvester scan for ${windowLabel} across Google & BBB Scam Tracker...`);

    try {
      const response = await fetch(import.meta.env.DEV ? 'http://localhost:8000/api/scan-now' : `${import.meta.env.VITE_FETCHER_URL}/api/scan-now`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ windowDays }),
      });

      if (response.ok) {
        const data = await response.json();
        setStatusMessage(data.message || 'Harvester scan started.');
        // Poll quickly for updates
        setTimeout(fetchRecords, 3000);
        setTimeout(fetchRecords, 8000);
        setTimeout(fetchRecords, 15000);
      } else {
        throw new Error(`Server returned HTTP ${response.status}`);
      }
    } catch (err: any) {
      console.error('Error triggering harvester scan:', err);
      setErrorMessage(err.message || 'Failed to start harvester scan.');
      setIsScanning(false);
    }
  };

  // Delete single record
  const handleDeleteRecord = async (id: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== id));
    try {
      await fetch(import.meta.env.DEV ? `http://localhost:8000/api/records/${id}` : `${import.meta.env.VITE_FETCHER_URL}/api/records/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.warn('Delete error:', err);
    }
  };

  // Delete bulk selected records
  const handleDeleteSelected = async (ids: string[]) => {
    const idsSet = new Set(ids);
    setRecords((prev) => prev.filter((r) => !idsSet.has(r.id)));
    try {
      await fetch(import.meta.env.DEV ? 'http://localhost:8000/api/records/delete-bulk' : `${import.meta.env.VITE_FETCHER_URL}/api/records/delete-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
    } catch (err) {
      console.warn('Delete bulk error:', err);
    }
  };

  // Add manual record
  const handleAddManualRecord = async (recordData: Omit<ScamPhoneRecord, 'id' | 'detectedAt'>) => {
    try {
      const response = await fetch(import.meta.env.DEV ? 'http://localhost:8000/api/records/manual' : `${import.meta.env.VITE_FETCHER_URL}/api/records/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recordData),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.record) {
          setRecords((prev) => [data.record, ...prev]);
        }
      } else {
        const errData = await response.json();
        setErrorMessage(errData.error || 'Failed to add manual record.');
      }
    } catch (err) {
      console.error('Error adding manual record:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950 flex flex-col pt-[165px]">
      {/* Top Header Navigation */}
      <Navbar
        totalRecordsCount={records.length}
        lastScanTime={lastScanTime}
        nextScheduledRefresh={nextScheduledRefresh}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Automated Harvester Live Control Banner */}
        <section className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2 flex-wrap">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <h2 className="text-base font-bold text-slate-100">
                  End Scam Scan Engine
                </h2>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded">
                  Daily Refreshes @ 7:00 AM & 1:00 PM PST (24h Window)
                </span>
              </div>
              <p className="text-xs text-slate-400 max-w-2xl">
                Continuously extracts scam phone numbers across Facebook, Instagram, Guestbooks, and{' '}
                <strong className="text-slate-200">BBB Scam Tracker</strong> (Geek Squad & tech support scams). Auto-purges after 31 days with strict zero-duplicate filtering.
              </p>
            </div>

            <div className="flex items-center space-x-2 shrink-0 flex-wrap">
              <button
                id="btn-run-manual-31day-scan"
                onClick={() => handleRunScanNow(31)}
                disabled={isScanning}
                className="inline-flex items-center space-x-2 px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-all disabled:opacity-50"
                title="Perform full manual search for the last 31 days"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                <span>{isScanning ? 'Scanning...' : 'Manual Search (31 Days)'}</span>
              </button>

              <button
                id="btn-run-24h-scan"
                onClick={() => handleRunScanNow(1)}
                disabled={isScanning}
                className="inline-flex items-center space-x-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition-all disabled:opacity-50"
                title="Perform scan for last 24 hours"
              >
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Scan (24 Hours)</span>
              </button>
            </div>
          </div>

          {/* Sub-bar showing sources, deduplication status and 31-day retention policy */}
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <div className="flex items-center space-x-3 flex-wrap">
              <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Active Target Sources:
              </span>
              <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-[11px]">
                Google Deep Search
              </span>
              <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-[11px] text-amber-300">
                BBB Scam Tracker (Geek Squad)
              </span>
              <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-[11px]">
                Social Media Dorks
              </span>
            </div>

            <div className="flex items-center space-x-4 text-[11px] text-slate-400 flex-wrap">
              <span className="flex items-center gap-1 text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                Strict Zero-Duplicate Filter Active
              </span>
              <span className="flex items-center gap-1 text-slate-400">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                31-Day Retention Policy
              </span>
            </div>
          </div>
        </section>

        {/* Notifications */}
        {statusMessage && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between text-xs text-amber-300 animate-fadeIn">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
              <span>{statusMessage}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-amber-400 hover:text-amber-300 text-xs font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center justify-between text-xs text-red-300">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-400 hover:text-red-300 text-xs font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Metrics Cards */}
        <StatsCards records={records} isSearching={isScanning} />

        {/* Sortable & Filterable Database Results Table with Date Column */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                Harvested Scam Phone Database (Past 31 Days)
              </h2>
              <p className="text-xs text-slate-400">
                Sorted by date detected. Includes scam type, direct WhatsApp links, source links, and report context.
              </p>
            </div>
          </div>

          <ResultsTable
            records={records}
            onDeleteRecord={handleDeleteRecord}
            onDeleteSelected={handleDeleteSelected}
            onAddManualRecord={handleAddManualRecord}
            isSearching={isScanning}
          />
        </section>
      </main>

      {/* Clean Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500 mt-auto">
        <p>
          End Scam Scan &bull; Scheduled Daily Refreshes (24h Window @ 7:00 AM & 1:00 PM PST) &bull; 31-Day Retention & Deduplication
        </p>
      </footer>
    </div>
  );
}
