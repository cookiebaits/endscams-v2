import React, { useState, useEffect, useRef } from 'react';
import { StatsCards } from './components/StatsCards';
import { ResultsTable } from './components/ResultsTable';
import { SchedulerDiagnosticsPanel } from './components/SchedulerDiagnosticsPanel';
import { BackupRestoreModal } from './components/BackupRestoreModal';
import { ScamPhoneRecord, SyncBridgeStatus } from './types';
import { ShieldAlert, AlertCircle, Clock, CheckCircle2, Radio, Activity, RefreshCw, Zap, Monitor, Smartphone, FileSpreadsheet } from 'lucide-react';
import { formatPSTTimeOnly, formatPST, getPacificParts } from './utils/dateUtils';
import { syncBridge } from './utils/syncBridge';
import { useDeviceMode } from './hooks/useDeviceMode';
import { noSqlDatabase } from './db/noSqlDatabase';

export default function App() {
  const [records, setRecords] = useState<ScamPhoneRecord[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatusMessage, setScanStatusMessage] = useState("");
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);
  const [lastScanSummary, setLastScanSummary] = useState<string>('Database loaded.');
  const [nextScheduledRefresh, setNextScheduledRefresh] = useState<string>('Today at 1:00 PM PST');
  const [nextExecutionPST, setNextExecutionPST] = useState<string | null>(null);
  const [nextExecutionCountdown, setNextExecutionCountdown] = useState<string | null>(null);
  const [schedulerActive, setSchedulerActive] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentPST, setCurrentPST] = useState<string>(formatPSTTimeOnly(new Date(), true));
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [isBackupRestoreOpen, setIsBackupRestoreOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncBridgeStatus | null>(null);

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
  }, []);

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
  }, [isScanning]);

  // Fetch records from backend API with automatic built-in NoSQL fallback
  const fetchRecords = async () => {
    try {
      const response = await fetch('/api/records');
      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.records)) {
          setRecords(data.records);
          setLastScanTime(data.lastScanTime);
          if (data.lastScanSummary) setLastScanSummary(data.lastScanSummary);
          if (data.nextScheduledRefresh) setNextScheduledRefresh(data.nextScheduledRefresh);
          if (data.nextExecutionPST) setNextExecutionPST(data.nextExecutionPST);
          if (data.nextExecutionCountdown) setNextExecutionCountdown(data.nextExecutionCountdown);
          if (data.schedulerActive !== undefined) setSchedulerActive(data.schedulerActive);
          setIsScanning(Boolean(data.isScanningInProgress));
          if (data.scanProgress !== undefined) setScanProgress(data.scanProgress);
          if (data.scanStatusMessage !== undefined) setScanStatusMessage(data.scanStatusMessage);

          // Mirror into client-side built-in NoSQL database
          noSqlDatabase.getRecordsCollection().clear();
          noSqlDatabase.getRecordsCollection().insertMany(data.records);
          noSqlDatabase.persist();
        }
      } else {
        throw new Error(`Server returned HTTP ${response.status}`);
      }
    } catch (err) {
      console.warn('[Built-in NoSQL] Backend API unreachable, falling back to local built-in NoSQL database:', err);
      // Seamlessly hydrate from built-in NoSQL store (bundled with code export)
      const localDocs = noSqlDatabase.getRecordsCollection().getAll();
      if (localDocs.length > 0) {
        setRecords((prev) => (prev.length === 0 ? localDocs : prev));
      }
    }
  };

  useEffect(() => {
    fetchRecords();
    const pollInterval = isScanning ? 3000 : 15000;
    const interval = setInterval(fetchRecords, pollInterval);
    return () => clearInterval(interval);
  }, [isScanning]);

  // Trigger manual harvester scan
  const handleRunScanNow = async () => {
    setIsScanning(true);
    setErrorMessage(null);
    setStatusMessage(`Initiating manual harvester scan...`);

    try {
      const response = await fetch('/api/scan-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        setStatusMessage(data.message || 'Harvester scan started.');
        // Poll quickly for updates
        setTimeout(fetchRecords, 1000);
        setTimeout(fetchRecords, 2000);
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

  // Mark / toggle "Number down" for a single record (retains number in DB)
  const handleToggleNumberDown = async (id: string) => {
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
      await fetch(`/api/records/${id}/toggle-down`, { method: 'POST' });
    } catch (err) {
      console.warn('Number down error:', err);
    }
  };

  // Mark bulk selected records as "Number down" (retains numbers in DB)
  const handleMarkNumberDownSelected = async (ids: string[]) => {
    const idsSet = new Set(ids);
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
      });
    } catch (err) {
      console.warn('Bulk number down error:', err);
    }
  };

  // Add manual record
  const handleAddManualRecord = async (recordData: Omit<ScamPhoneRecord, 'id' | 'detectedAt'>) => {
    try {
      const response = await fetch('/api/records/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recordData),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.record) {
          setRecords((prev) => [data.record, ...prev]);
          setStatusMessage(`Added manual scam record for ${data.record.phone}. Data retained.`);
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
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950 flex flex-col">
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

      {/* Database Backup & Restore Modal */}
      <BackupRestoreModal
        isOpen={isBackupRestoreOpen}
        onClose={() => setIsBackupRestoreOpen(false)}
        records={records}
        onRestoreSuccess={(newRecords, message) => {
          setRecords(newRecords);
          setStatusMessage(message);
          fetchRecords();
        }}
      />

      {/* Clean Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-3.5 text-center text-xs text-slate-500 mt-auto">
        <p className="flex items-center justify-center space-x-2 flex-wrap px-3">
          <span>End Scam Scan &bull; Auto Refreshes @ 7:00 AM & 1:00 PM PST &bull; 60-Day Auto-Retention</span>
          <span>&bull;</span>
          <button
            id="btn-footer-backup-restore"
            onClick={() => setIsBackupRestoreOpen(true)}
            className="inline-flex items-center space-x-1 text-slate-400 hover:text-amber-400 font-medium transition-colors cursor-pointer py-1 px-1.5 rounded hover:bg-slate-900"
            title="Backup Database to Excel or Restore Database from Excel File"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Backup and Restore</span>
          </button>
          <span>&bull;</span>
          <button
            id="btn-footer-manual-refresh"
            onClick={handleRunScanNow}
            disabled={isScanning}
            className={`focus:outline-none transition-colors ${isScanning ? 'text-emerald-400 opacity-80 cursor-not-allowed' : 'hover:text-emerald-400 font-medium'}`}
            title="Trigger Manual Refresh Scan"
          >
            {isScanning ? (scanStatusMessage ? `${scanStatusMessage} (${scanProgress}%)` : `Refreshing... ${scanProgress}%`) : 'Manual Refresh'}
          </button>
        </p>
      </footer>
    </div>
  );
}

