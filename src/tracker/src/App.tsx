import { useState, useEffect, useRef, useCallback } from 'react';
import { StatsCards } from './components/StatsCards';
import { ResultsTable } from './components/ResultsTable';
import { SchedulerDiagnosticsPanel } from './components/SchedulerDiagnosticsPanel';
import { ScamPhoneRecord, SyncBridgeStatus } from './types';
import { ShieldAlert, AlertCircle, Clock, CheckCircle2, Radio, RefreshCw, Zap, Monitor, Smartphone } from 'lucide-react';
import { formatPSTTimeOnly, getPacificParts } from './utils/dateUtils';
import { syncBridge } from './utils/syncBridge';
import { useDeviceMode } from './hooks/useDeviceMode';
import { supabase, formatPhoneDisplay } from '../../lib/supabase';
import { getFetcherUrl } from './utils/fetcherUrl';
import { INITIAL_SAMPLE_RECORDS } from './data/presets';

export default function App() {
  const [records, setRecords] = useState<ScamPhoneRecord[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);
  const [nextScheduledRefresh, setNextScheduledRefresh] = useState<string>('Today at 1:00 PM PST');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentPST, setCurrentPST] = useState<string>(formatPSTTimeOnly(new Date(), true));
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [, setSyncStatus] = useState<SyncBridgeStatus | null>(null);

  // Auto-detect mobile devices and responsive screen widths with manual override
  const { isMobile, preference, setPreference } = useDeviceMode();

  // References for sync callback to always access latest state
  const recordsRef = useRef<ScamPhoneRecord[]>([]);
  const isScanningRef = useRef(false);
  const lastScanTimeRef = useRef<string | null>(null);
  const nextScheduledRefreshRef = useRef('Today at 1:00 PM PST');

  useEffect(() => {
    recordsRef.current = records;
  }, [records]);

  useEffect(() => {
    isScanningRef.current = isScanning;
  }, [isScanning]);

  useEffect(() => {
    lastScanTimeRef.current = lastScanTime;
  }, [lastScanTime]);

  useEffect(() => {
    nextScheduledRefreshRef.current = nextScheduledRefresh;
  }, [nextScheduledRefresh]);

  // Log page activation for troubleshooting and diagnostics
  useEffect(() => {
    const fetcherUrl = getFetcherUrl();
    const activationLog = {
      event: 'TRACKER_PAGE_ACTIVATED',
      timestamp: new Date().toISOString(),
      location: typeof window !== 'undefined' ? window.location.href : 'N/A',
      fetcherUrl,
      isDev: import.meta.env.DEV,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
    };
    console.log('🚀 [/tracker] Page Activated:', activationLog);
  }, []);

  // Mark / toggle "Number down" for a single record
  const handleToggleNumberDown = useCallback(async (id: string) => {
    setRecords((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              isNumberDown: !r.isNumberDown,
              numberDownAt: !r.isNumberDown ? new Date().toISOString() : undefined,
            }
          : r
      )
    );
    try {
      await fetch(`/api/records/${id}/toggle-down`, { method: 'POST' }).catch(() => null);
      const target = recordsRef.current.find((r) => r.id === id);
      if (target) {
        await supabase
          .from('tracker_entries')
          .update({ is_number_down: !target.isNumberDown })
          .eq('phone_digits', target.cleanPhone);
      }
    } catch (err) {
      console.warn('Number down error:', err);
    }
  }, []);

  // Add manual record directly to state & Supabase
  const handleAddManualRecord = useCallback(async (recordData: Omit<ScamPhoneRecord, 'id' | 'detectedAt'>) => {
    try {
      const cleanDigits = recordData.cleanPhone || recordData.phone.replace(/\D/g, '');
      const newRec: ScamPhoneRecord = {
        ...recordData,
        id: `manual-${Date.now()}-${cleanDigits}`,
        cleanPhone: cleanDigits,
        detectedAt: new Date().toISOString(),
      };

      setRecords((prev) => [newRec, ...prev]);
      setStatusMessage(`Added manual scam record for ${newRec.phone}. Data retained.`);

      // Persist directly to Supabase
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 60);

      await supabase.from('tracker_entries').upsert({
        phone_number: newRec.phone,
        phone_digits: cleanDigits,
        source_name: newRec.platform || 'Manual Entry',
        source_url: newRec.sourceUrl || '/tracker',
        report_date: new Date().toISOString().split('T')[0],
        category: newRec.scamType,
        description: newRec.snippet,
        expires_at: expiresAt.toISOString(),
      }, { onConflict: 'phone_digits,source_name' });

      // Try API sync if running
      await fetch('/api/records/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recordData),
      }).catch(() => null);
    } catch (err) {
      console.error('Error adding manual record:', err);
    }
  }, []);

  // Fetch records directly from Supabase & local storage fallback
  const fetchRecords = useCallback(async () => {
    try {
      // 1. Try backend API endpoint first via getFetcherUrl() or relative endpoint
      const fetcherUrl = getFetcherUrl();
      const response = await fetch(`${fetcherUrl}/api/records`).catch(() => fetch('/api/records').catch(() => null));
      let fetchedList: ScamPhoneRecord[] = [];

      if (response && response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.records)) {
          fetchedList = data.records;
          setLastScanTime(data.lastScanTime);
          if (data.nextScheduledRefresh) setNextScheduledRefresh(data.nextScheduledRefresh);
          setIsScanning(Boolean(data.isScanningInProgress));
          if (data.scanProgress !== undefined) setScanProgress(data.scanProgress);
        }
      }

      // 2. Fetch directly from Supabase tracker_entries table
      const { data: dbEntries, error: sbError } = await supabase
        .from('tracker_entries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (sbError) {
        console.warn('[Tracker] Supabase query returned error:', sbError.message);
      }

      if (dbEntries && dbEntries.length > 0) {
        const mappedDbRecords: ScamPhoneRecord[] = dbEntries.map((e: any) => ({
          id: e.id,
          phone: e.phone_number || formatPhoneDisplay(e.phone_digits),
          cleanPhone: e.phone_digits,
          scamType: e.category || 'Scam',
          detectedAt: e.report_date || e.created_at || new Date().toISOString(),
          sourceUrl: e.source_url || '/tracker',
          sourceDomain: e.source_name || 'Database',
          platform: e.source_name || 'Scam Tracker',
          snippet: e.description || 'Verified threat entry',
          searchQuery: e.category || 'Database Record',
          confidence: 'High',
          isNumberDown: Boolean(e.is_number_down),
        }));

        // Merge backend and Supabase records by unique phone digits
        const phoneMap = new Map<string, ScamPhoneRecord>();
        [...fetchedList, ...mappedDbRecords].forEach((rec) => {
          const key = rec.cleanPhone || rec.phone.replace(/\D/g, '');
          if (key && !phoneMap.has(key)) {
            phoneMap.set(key, rec);
          }
        });
        fetchedList = Array.from(phoneMap.values());
      }

      // 3. Merge user reports from local storage
      const userReportsRaw = localStorage.getItem('user_reported_scams') || '[]';
      try {
        const userReports = JSON.parse(userReportsRaw);
        if (Array.isArray(userReports)) {
          const phoneMap = new Map<string, ScamPhoneRecord>();
          fetchedList.forEach((r) => phoneMap.set(r.cleanPhone || r.phone.replace(/\D/g, ''), r));

          userReports.forEach((ur: any) => {
            const digits = (ur.phone_digits || ur.cleanPhone || ur.phone || '').replace(/\D/g, '');
            if (digits && !phoneMap.has(digits)) {
              phoneMap.set(digits, {
                id: ur.id || `user-report-${digits}`,
                phone: ur.phone || formatPhoneDisplay(digits),
                cleanPhone: digits,
                scamType: ur.scamType || ur.scam_type || ur.category || 'User Report',
                detectedAt: ur.created_at || ur.detectedAt || new Date().toISOString(),
                sourceUrl: '/report',
                sourceDomain: 'EndScams Community',
                platform: 'User Submission',
                snippet: ur.snippet || ur.summary || ur.description || 'User submitted scam report',
                searchQuery: ur.scamType || 'User Report',
                confidence: 'High',
              });
            }
          });
          fetchedList = Array.from(phoneMap.values());
        }
      } catch (err) {
        console.warn('Error reading local user reports:', err);
      }

      // 4. If no records retrieved from API or DB, fall back to initial preset records
      if (fetchedList.length === 0) {
        fetchedList = INITIAL_SAMPLE_RECORDS;
      }

      setRecords(fetchedList);
    } catch (err) {
      console.error('Error fetching records:', err);
      setRecords((prev) => (prev.length === 0 ? INITIAL_SAMPLE_RECORDS : prev));
    }
  }, []);

  // Trigger manual harvester scan with multi-stage endpoint fallback
  const handleRunScanNow = useCallback(async () => {
    setIsScanning(true);
    setErrorMessage(null);
    setStatusMessage(`Initiating manual harvester scan...`);

    const primaryUrl = `${getFetcherUrl()}/refresh`;
    const fallbackUrls = ['/refresh', '/api/scan-now'];
    const endpointsToTry = [primaryUrl, ...fallbackUrls.filter((u) => u !== primaryUrl)];

    let lastErrMessage = '';
    let succeeded = false;

    for (const endpoint of endpointsToTry) {
      try {
        console.log(`[Tracker] Attempting harvester scan via endpoint: ${endpoint}`);
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (response.ok) {
          const data = await response.json();
          setStatusMessage(data.message || `Harvester scan completed successfully via ${endpoint}. Processed & retained entries.`);
          await fetchRecords();
          succeeded = true;
          break;
        } else if (response.status === 429) {
          const data = await response.json().catch(() => ({}));
          setErrorMessage(data.error || 'Scan rate limit exceeded. Please wait 1 minute between scans.');
          succeeded = true;
          break;
        } else {
          lastErrMessage = `Endpoint ${endpoint} returned HTTP ${response.status}`;
        }
      } catch (e: any) {
        console.warn(`[Tracker] Endpoint ${endpoint} unreachable:`, e);
        lastErrMessage = e?.message || 'Network error';
      }
    }

    if (!succeeded) {
      console.error('[Tracker] All harvester scan endpoints failed:', lastErrMessage);
      setErrorMessage(
        `Unable to connect to the Threat Harvester service (${primaryUrl}). The backend fetcher container may be offline or restarting.`
      );
    }

    setIsScanning(false);
  }, [fetchRecords]);

  // Initialize Bi-Directional Parent / Iframe Sync Bridge
  useEffect(() => {
    syncBridge.init({
      onRequestData: () => ({
        records: recordsRef.current,
        isScanning: isScanningRef.current,
        lastScanTime: lastScanTimeRef.current,
        nextScheduledRefresh: nextScheduledRefreshRef.current,
      }),
      onPushRecords: (incomingRecords) => {
        setRecords((prev) => {
          const existingKeys = new Set(prev.map((r) => r.cleanPhone || r.phone));
          const newRecords = incomingRecords.filter((r) => !existingKeys.has(r.cleanPhone || r.phone));
          if (newRecords.length > 0) {
            setStatusMessage(`[Sync Bridge] Received & merged ${newRecords.length} synchronized records from parent/iframe.`);
            return [...newRecords, ...prev];
          }
          return prev;
        });
      },
      onAddManualRecord: (rec) => {
        handleAddManualRecord(rec);
      },
      onTriggerScan: () => {
        setStatusMessage('[Sync Bridge] Remote scan command received from parent/iframe.');
        handleRunScanNow();
      },
      onToggleNumberDown: (id) => {
        handleToggleNumberDown(id);
      },
      onStatusUpdate: (s) => {
        setSyncStatus(s);
      },
    });

    setSyncStatus(syncBridge.getStatus());

    return () => {
      syncBridge.destroy();
    };
  }, [handleAddManualRecord, handleRunScanNow, handleToggleNumberDown]);

  // Broadcast state changes across bridge when records or scan status changes
  useEffect(() => {
    if (records.length > 0) {
      syncBridge.broadcastCurrentState();
    }
  }, [records.length, isScanning, lastScanTime]);

  // Update live Pacific Time clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentPST(formatPSTTimeOnly(new Date(), true));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Automated 7:00 AM & 1:00 PM PST Trigger:
  // Monitors Pacific Time and literally triggers the "Manual Refresh" button when reaching 7am or 1pm PST
  useEffect(() => {
    const checkScheduleAndTrigger = () => {
      try {
        const { hour, dateStr } = getPacificParts(new Date());

        // Target slots: 7:00 AM PST (hour 7) and 1:00 PM PST (hour 13)
        if (hour === 7 || hour === 13) {
          const slotKey = `auto_refresh_triggered_${dateStr}_${hour}`;
          const alreadyTriggered = localStorage.getItem(slotKey);

          if (!alreadyTriggered && !isScanning) {
            localStorage.setItem(slotKey, new Date().toISOString());
            const slotLabel = hour === 7 ? '7:00 AM PST' : '1:00 PM PST';
            console.log(`[Auto-Trigger] ${slotLabel} reached! Automatically triggering the "Manual Refresh" button...`);

            setStatusMessage(`[Auto-Scan Active] ${slotLabel} reached — Automatically triggered "Manual Refresh" to populate the database.`);

            // Trigger the manual refresh directly & click the footer button
            handleRunScanNow();
            const btn = document.getElementById('btn-footer-manual-refresh');
            if (btn) {
              btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            }
          }
        }
      } catch (err) {
        console.warn('Error checking Pacific schedule:', err);
      }
    };

    // Check immediately on mount and every 5 seconds
    checkScheduleAndTrigger();
    const interval = setInterval(checkScheduleAndTrigger, 5000);
    return () => clearInterval(interval);
  }, [handleRunScanNow, isScanning]);

  useEffect(() => {
    fetchRecords();
    const pollInterval = isScanning ? 3000 : 15000;
    const interval = setInterval(fetchRecords, pollInterval);
    return () => clearInterval(interval);
  }, [fetchRecords, isScanning]);

  // Mark bulk selected records as "Number down"
  const handleMarkNumberDownSelected = useCallback(async (ids: string[]) => {
    const idsSet = new Set(ids);
    const targetDigits = recordsRef.current.filter((r) => idsSet.has(r.id)).map((r) => r.cleanPhone);

    setRecords((prev) =>
      prev.map((r) =>
        idsSet.has(r.id)
          ? { ...r, isNumberDown: true, numberDownAt: new Date().toISOString() }
          : r
      )
    );
    try {
      await fetch('/api/records/bulk-number-down', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, isNumberDown: true }),
      }).catch(() => null);

      if (targetDigits.length > 0) {
        await supabase
          .from('tracker_entries')
          .update({ is_number_down: true })
          .in('phone_digits', targetDigits);
      }
    } catch (err) {
      console.warn('Bulk number down error:', err);
    }
  }, []);

  return (
    <div className="bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950 flex flex-col">
      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-3.5 sm:py-6 space-y-4 sm:space-y-6">
        {/* Automated Harvester Live Control Banner */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-5 shadow-lg relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <h2 className="text-sm sm:text-base font-bold text-slate-100">
                  End Scam Threat Harvester
                </h2>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded">
                  Daily Auto-Scans: 7:00 AM & 1:00 PM PST
                </span>

                {/* Live Running Indicator */}
                <div
                  className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    isScanning
                      ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                      : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isScanning ? 'bg-amber-400 animate-ping' : 'bg-emerald-400 animate-pulse'}`} />
                  <span>{isScanning ? `Scan in Progress (${scanProgress}%)` : 'Automated Task Runner Active'}</span>
                </div>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 max-w-2xl">
                Automated multi-source harvester scheduled daily at 7:00 AM PST and 1:00 PM PST. Newly detected numbers are incrementally added to the retained database.
              </p>
            </div>

            {/* Schedule, Live PST Clock & View Mode Toggle */}
            <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
              <div className="flex items-center space-x-2 sm:space-x-2.5 flex-wrap gap-y-2">
                {/* Live PST Clock */}
                <div className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 shadow-inner" title="Live Pacific Standard/Daylight Time">
                  <Radio className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                  <span className="font-mono text-slate-200 text-[11px] sm:text-xs">
                    PST: <strong className="text-amber-400 font-semibold">{currentPST}</strong>
                  </span>
                </div>

                {/* Next Scheduled Refresh */}
                <div
                  className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300"
                  title="Next Automated Scan"
                >
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[11px] sm:text-xs">Next: <strong className="text-slate-100">{nextScheduledRefresh}</strong></span>
                </div>

                {/* Manual Scan Trigger Button */}
                <button
                  id="btn-run-manual-scan-banner"
                  onClick={handleRunScanNow}
                  disabled={isScanning}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-lg text-xs flex items-center space-x-1.5 transition-colors shadow-sm cursor-pointer"
                  title="Trigger immediate threat harvester scan across all platforms"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                  <span>{isScanning ? `Scanning (${scanProgress}%)` : 'Scan Now'}</span>
                </button>
              </div>

              {/* View Mode Toggle: Auto / Desktop / Mobile (under Next & PST info) */}
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs shadow-inner">
                <button
                  id="btn-view-auto"
                  onClick={() => setPreference('auto')}
                  className={`px-2.5 py-1 rounded text-xs font-medium flex items-center space-x-1 transition-colors ${
                    preference === 'auto'
                      ? 'bg-slate-800 text-amber-300 font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Auto-detect screen / device type"
                >
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span>Auto</span>
                </button>
                <button
                  id="btn-view-desktop"
                  onClick={() => setPreference('desktop')}
                  className={`px-2.5 py-1 rounded text-xs font-medium flex items-center space-x-1 transition-colors ${
                    preference === 'desktop'
                      ? 'bg-slate-800 text-blue-300 font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Force Desktop Layout"
                >
                  <Monitor className="w-3 h-3" />
                  <span>Desktop</span>
                </button>
                <button
                  id="btn-view-mobile"
                  onClick={() => setPreference('mobile')}
                  className={`px-2.5 py-1 rounded text-xs font-medium flex items-center space-x-1 transition-colors ${
                    preference === 'mobile'
                      ? 'bg-slate-800 text-amber-300 font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Force Mobile Layout"
                >
                  <Smartphone className="w-3 h-3" />
                  <span>Mobile</span>
                </button>
              </div>
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
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl space-y-2 text-xs text-red-300 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              <button
                onClick={() => setErrorMessage(null)}
                className="text-red-400 hover:text-red-300 text-xs font-bold"
              >
                Dismiss
              </button>
            </div>

            <details className="mt-1 pt-1 border-t border-red-500/20 text-[11px] text-red-400/90">
              <summary className="cursor-pointer font-semibold hover:underline">
                Technical Diagnostics &amp; Troubleshooting Info
              </summary>
              <div className="mt-2 space-y-1 font-mono bg-slate-950/80 p-2.5 rounded-lg border border-red-500/20 text-slate-300">
                <p>• <strong>Fetcher Backend URL:</strong> {getFetcherUrl()}</p>
                <p>• <strong>Attempted Scan Endpoint:</strong> {getFetcherUrl()}/refresh</p>
                <p>• <strong>Page Location:</strong> {typeof window !== 'undefined' ? window.location.href : ''}</p>
                <p>• <strong>Troubleshooting Steps:</strong> Verify that the Deno/Node fetcher service at <code>{getFetcherUrl()}</code> is running in Docker/Dokploy and accessible over port 8000 or proxy with valid CORS headers.</p>
              </div>
            </details>
          </div>
        )}

        {/* Metrics Cards */}
        <StatsCards records={records} isSearching={isScanning} />

        {/* Sortable & Filterable Database Results Table with Date Column */}
        <section>
          <div className="flex items-center justify-between mb-2.5 sm:mb-3">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                Harvested Scam Phone Database
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400">
                Sorted by date detected. Filter by category, platform, or search keywords.
              </p>
            </div>
          </div>

          <ResultsTable
            records={records}
            onToggleNumberDown={handleToggleNumberDown}
            onMarkNumberDownSelected={handleMarkNumberDownSelected}
            onAddManualRecord={handleAddManualRecord}
            onThreatSearchSuccess={(msg) => setStatusMessage(msg)}
            onReloadRecords={fetchRecords}
            isSearching={isScanning}
            isMobileActive={isMobile}
          />
        </section>
      </main>

      {/* Diagnostics Modal (Available internally if needed) */}
      <SchedulerDiagnosticsPanel
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        onRunManualScan={handleRunScanNow}
        isScanning={isScanning}
      />

    </div>
  );
}
