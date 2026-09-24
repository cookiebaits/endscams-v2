import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Radio,
  RefreshCw,
  Play,
  Terminal,
  Database,
  Cpu,
  ShieldCheck,
  Zap,
  X,
  ChevronDown,
  ChevronUp,
  Flame,
  Info,
} from 'lucide-react';
import { SchedulerDiagnosticsData, SchedulerLogEntry } from '../types';

interface SchedulerDiagnosticsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onRunManualScan: () => Promise<void>;
  isScanning: boolean;
}

export const SchedulerDiagnosticsPanel: React.FC<SchedulerDiagnosticsPanelProps> = ({
  isOpen,
  onClose,
  onRunManualScan,
  isScanning,
}) => {
  const [data, setData] = useState<SchedulerDiagnosticsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isTickLoading, setIsTickLoading] = useState<boolean>(false);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [logFilter, setLogFilter] = useState<'all' | 'tick' | 'scan' | 'trigger' | 'error'>('all');
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [liveCountdown, setLiveCountdown] = useState<string>('--');

  const fetchDiagnostics = useCallback(async () => {
    try {
      const res = await fetch('/api/scheduler/diagnostics');
      if (res.ok) {
        const json: SchedulerDiagnosticsData = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Error fetching scheduler diagnostics:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch and auto-refresh interval (every 3 seconds when open)
  useEffect(() => {
    if (!isOpen) return;
    fetchDiagnostics();

    if (!autoRefresh) return;
    const interval = setInterval(fetchDiagnostics, 3000);
    return () => clearInterval(interval);
  }, [isOpen, autoRefresh, fetchDiagnostics]);

  // Live countdown timer calculation ticking every second
  useEffect(() => {
    if (!data?.schedule?.nextExecution?.isoTimestamp) return;

    const updateCountdown = () => {
      const targetTime = new Date(data.schedule.nextExecution.isoTimestamp).getTime();
      const now = Date.now();
      const diffMs = targetTime - now;

      if (diffMs <= 0) {
        setLiveCountdown('Due now / Running scheduled slot');
        return;
      }

      const totalSec = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSec / 3600);
      const minutes = Math.floor((totalSec % 3600) / 60);
      const seconds = totalSec % 60;

      const pad = (n: number) => n.toString().padStart(2, '0');
      setLiveCountdown(`${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`);
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [data?.schedule?.nextExecution?.isoTimestamp]);

  // Handle manual scheduler tick
  const handleForceTick = async () => {
    setIsTickLoading(true);
    setActionFeedback(null);
    try {
      const res = await fetch('/api/scheduler/tick', { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setActionFeedback('Scheduler cycle evaluated successfully: Interval tick verified.');
      } else {
        setActionFeedback('Failed to execute scheduler tick.');
      }
    } catch (err: any) {
      setActionFeedback(`Error: ${err.message || 'Unable to reach backend'}`);
    } finally {
      setIsTickLoading(false);
      setTimeout(() => setActionFeedback(null), 4000);
    }
  };

  // Handle schedule reconciliation and backfill
  const handleCheckAndSync = async () => {
    setIsTickLoading(true);
    setActionFeedback(null);
    try {
      const res = await fetch('/api/scheduler/check-and-sync', { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        if (json.diagnostics) {
          setData(json.diagnostics);
        }
        setActionFeedback('Schedule synchronized: All daily 7 AM & 1 PM PST slots checked & backfilled.');
      } else {
        setActionFeedback('Failed to synchronize schedule.');
      }
    } catch (err: any) {
      setActionFeedback(`Error: ${err.message || 'Unable to reach backend'}`);
    } finally {
      setIsTickLoading(false);
      setTimeout(() => setActionFeedback(null), 4000);
    }
  };

  if (!isOpen) return null;

  const isStalled = data?.scheduler.isStalled || false;
  const isCurrentlyScanning = isScanning || data?.execution.isScanning || false;
  const heartbeatAge = data?.scheduler.lastHeartbeatAgeSeconds ?? 0;

  const filteredLogs = (data?.logs || []).filter((log) => {
    if (logFilter === 'all') return true;
    if (logFilter === 'tick') return log.type === 'tick';
    if (logFilter === 'scan') return log.type === 'scan' || log.type === 'catchup';
    if (logFilter === 'trigger') return log.type === 'trigger';
    if (logFilter === 'error') return log.type === 'error';
    return true;
  });

  return (
    <div
      id="scheduler-diagnostics-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-fadeIn"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div
              className={`p-2.5 rounded-xl border ${
                isCurrentlyScanning
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  : isStalled
                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              }`}
            >
              <Activity className={`w-6 h-6 ${isCurrentlyScanning ? 'animate-spin' : isStalled ? '' : 'animate-pulse'}`} />
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap">
                <h2 className="text-lg font-bold text-slate-100">
                  Backend Scheduled Task Runner Diagnostics
                </h2>
                {/* State Tag */}
                {isCurrentlyScanning ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                    <span className="w-2 h-2 rounded-full bg-amber-400 mr-1.5 animate-ping" />
                    Scanning Now
                  </span>
                ) : isStalled ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-300 border border-red-500/30">
                    <AlertTriangle className="w-3.5 h-3.5 mr-1 text-red-400" />
                    Runner Stalled
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
                    Actively Running (Interval Healthy)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time scheduler heartbeat, next execution timestamp tracking, and cold-start resilience monitor.
              </p>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center space-x-2.5 self-end sm:self-center">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center space-x-1.5 ${
                autoRefresh
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
              title="Toggle automatic 3-second diagnostic polling"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
              <span>{autoRefresh ? 'Live Polling (3s)' : 'Polling Paused'}</span>
            </button>

            <button
              onClick={fetchDiagnostics}
              disabled={isLoading}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition-colors"
              title="Manually refresh diagnostic data"
            >
              Refresh
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
              aria-label="Close diagnostics"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {actionFeedback && (
          <div className="px-5 py-2.5 bg-amber-500/10 border-b border-amber-500/30 text-amber-300 text-xs flex items-center justify-between animate-fadeIn">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{actionFeedback}</span>
            </div>
            <button onClick={() => setActionFeedback(null)} className="text-amber-400 hover:underline text-[11px] font-bold">
              Dismiss
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
          {/* Primary Countdown & Next Scheduled Execution Hero Banner */}
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 rounded-xl p-5 shadow-inner relative overflow-hidden">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-amber-400" />
                  <span className="text-xs uppercase tracking-wider font-bold text-amber-400">
                    Next Automated Scan Execution
                  </span>
                  <span className="px-2 py-0.5 bg-amber-400/10 text-amber-300 border border-amber-400/20 rounded text-[10px] font-mono">
                    Server Authoritative
                  </span>
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
                  {data?.schedule?.nextExecution?.label || 'Calculating next execution...'}
                </div>
                <div className="flex items-center space-x-3 text-xs text-slate-400 font-mono flex-wrap gap-y-1">
                  <span>
                    Pacific Time: <strong className="text-slate-200">{data?.schedule?.nextExecution?.targetPST || 'N/A'}</strong>
                  </span>
                  <span>&bull;</span>
                  <span>
                    UTC Timestamp: <strong className="text-slate-300">{data?.schedule?.nextExecution?.isoTimestamp || 'N/A'}</strong>
                  </span>
                </div>
              </div>

              {/* Countdown Ticker Box */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col items-center justify-center min-w-[200px] shadow-lg">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                  Time Remaining
                </span>
                <span className="text-2xl font-mono font-bold text-amber-400 tracking-wider my-0.5">
                  {liveCountdown}
                </span>
                <span className="text-[10px] text-slate-400">
                  Daily Slots: 7:00 AM & 1:00 PM PST
                </span>
              </div>
            </div>
          </div>

          {/* Diagnostic Metrics 4-Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Scheduler Runner Status */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-slate-300">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider">Runner State</h3>
                </div>
                <span
                  className={`w-2 h-2 rounded-full ${
                    isStalled ? 'bg-red-500' : 'bg-emerald-400 animate-ping'
                  }`}
                />
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className={`font-semibold ${isStalled ? 'text-red-400' : 'text-emerald-400'}`}>
                    {isStalled ? 'Stalled / Paused' : 'Actively Ticking'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Interval Loop:</span>
                  <span className="font-mono text-slate-200">Every 30 Seconds</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Heartbeat Count:</span>
                  <span className="font-mono text-slate-200">#{data?.scheduler.heartbeatCount || 0} ticks</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Last Heartbeat:</span>
                  <span className="font-mono text-amber-300">
                    {heartbeatAge}s ago
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Process Uptime:</span>
                  <span className="font-mono text-slate-300">
                    {Math.floor((data?.scheduler.serverUptimeSeconds || 0) / 60)}m {(data?.scheduler.serverUptimeSeconds || 0) % 60}s
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Schedule & Cold-Start Catch-up */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-slate-300">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider">Schedule & Catch-Up</h3>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded">
                  PST
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Schedule Policy:</span>
                  <span className="text-slate-200 font-medium">7 AM & 1 PM Daily</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Time Since Last:</span>
                  <span className="font-mono text-slate-200">
                    {data?.schedule.hoursSinceLastScan !== null
                      ? `${data?.schedule.hoursSinceLastScan} hrs`
                      : 'Unknown'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Catch-Up Threshold:</span>
                  <span className="font-mono text-slate-200">&gt; 12.0 Hours</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Catch-Up Status:</span>
                  <span
                    className={`font-semibold ${
                      data?.schedule.catchUpEligible ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {data?.schedule.catchUpEligible ? 'Catch-Up Active' : 'Normal Window'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Active Slot:</span>
                  <span className="font-mono text-slate-300">
                    {data?.schedule.lastScheduledSlot || 'None'}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 3: Last Harvest Scan Report */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-slate-300">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider">Last Scan Report</h3>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 rounded">
                  {data?.execution.totalScansExecuted || 0} Runs
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Execution Time:</span>
                  <span className="text-slate-200 font-mono text-[11px] truncate max-w-[140px]" title={data?.execution.lastScanFormattedPST || 'N/A'}>
                    {data?.execution.lastScanFormattedPST || 'Pending initial scan'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Duration:</span>
                  <span className="font-mono text-slate-200">
                    {data?.execution.lastScanDurationMs
                      ? `${(data.execution.lastScanDurationMs / 1000).toFixed(1)}s`
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">New Numbers Added:</span>
                  <span className="font-semibold text-emerald-400">
                    +{data?.execution.lastScanAddedCount ?? 0} DIDs
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Current Status:</span>
                  <span className={`font-semibold ${isCurrentlyScanning ? 'text-amber-400' : 'text-slate-300'}`}>
                    {isCurrentlyScanning ? `Scanning (${data?.execution.scanProgress}%)` : 'Idle'}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 4: System Integration & Storage */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-slate-300">
                  <Database className="w-4 h-4 text-purple-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider">Health & Storage</h3>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded">
                  Tiered Retention
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Gemini Engine:</span>
                  <span className="font-semibold text-emerald-400 font-mono text-[11px]">
                    {data?.health.geminiApiKey === 'configured'
                      ? `Active (${data?.health.geminiKeyPreview || 'Configured'})`
                      : 'Missing Key'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Proxy Architecture:</span>
                  <span className="font-semibold text-cyan-400 text-[11px]">
                    {data?.health.proxyMode || 'Cloudflare / Dokploy Proxy'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Disk Persistence:</span>
                  <span className="font-semibold text-emerald-400">
                    {data?.health.storage === 'healthy' ? 'Writable & Syncing' : 'Storage Error'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Retained Records:</span>
                  <span className="font-mono text-slate-100 font-bold">
                    {data?.health.recordsRetained || 0} active
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Auto-Purge Policy:</span>
                  <span className="text-amber-300 font-mono text-[11px] text-right font-medium">
                    6-Mo (Prize/PCH/Stake) &bull; 60d Std
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Controls & Test Actions */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                Runner Management & Diagnostics Actions
              </h4>
              <p className="text-[11px] text-slate-400">
                Directly verify the backend scheduler tick loop or trigger an on-demand threat intelligence scan.
              </p>
            </div>

            <div className="flex items-center space-x-2.5 flex-wrap gap-y-2">
              <button
                id="btn-sync-scheduler-slots"
                onClick={handleCheckAndSync}
                disabled={isTickLoading || isCurrentlyScanning}
                className="px-3 py-2 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-700/50 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-sm disabled:opacity-50"
                title="Force evaluate daily schedule and backfill any missed 7:00 AM & 1:00 PM PST slots"
              >
                <Zap className={`w-3.5 h-3.5 text-emerald-400 ${isTickLoading ? 'animate-bounce' : ''}`} />
                <span>{isTickLoading ? 'Syncing...' : 'Sync & Reconcile Slots'}</span>
              </button>

              <button
                id="btn-force-scheduler-tick"
                onClick={handleForceTick}
                disabled={isTickLoading}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-sm disabled:opacity-50"
                title="Force evaluate the 30-second interval scheduler function immediately"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isTickLoading ? 'animate-spin' : ''}`} />
                <span>{isTickLoading ? 'Evaluating Tick...' : 'Force Scheduler Tick'}</span>
              </button>

              <button
                id="btn-run-manual-scan-diagnostics"
                onClick={onRunManualScan}
                disabled={isCurrentlyScanning}
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-sm disabled:opacity-50"
                title="Trigger a full 24-hour threat harvester scan"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{isCurrentlyScanning ? 'Scan Running...' : 'Run Harvester Scan Now'}</span>
              </button>
            </div>
          </div>

          {/* Live Task Runner Event Log Stream */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-3.5 bg-slate-900/90 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Live Runner Event Stream & Logs
                </h4>
                <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded">
                  {filteredLogs.length} events
                </span>
              </div>

              {/* Log Filters */}
              <div className="flex items-center space-x-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px]">
                {(['all', 'tick', 'trigger', 'scan', 'error'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setLogFilter(filter)}
                    className={`px-2.5 py-1 rounded capitalize font-medium transition-colors ${
                      logFilter === filter
                        ? 'bg-slate-800 text-slate-100 font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Terminal Window */}
            <div className="p-3 font-mono text-xs max-h-56 overflow-y-auto space-y-1.5 bg-slate-950 custom-scrollbar">
              {filteredLogs.length === 0 ? (
                <div className="text-slate-400 text-center py-6 text-xs">
                  No log entries found for filter '{logFilter}'.
                </div>
              ) : (
                filteredLogs.map((log) => {
                  const badgeColor =
                    log.type === 'tick'
                      ? 'text-cyan-400 bg-cyan-950/50 border-cyan-800'
                      : log.type === 'trigger'
                      ? 'text-emerald-400 bg-emerald-950/50 border-emerald-800'
                      : log.type === 'scan'
                      ? 'text-amber-400 bg-amber-950/50 border-amber-800'
                      : log.type === 'catchup'
                      ? 'text-purple-400 bg-purple-950/50 border-purple-800'
                      : log.type === 'error'
                      ? 'text-red-400 bg-red-950/50 border-red-800'
                      : 'text-slate-400 bg-slate-900 border-slate-800';

                  return (
                    <div
                      key={log.id}
                      className="flex items-start space-x-2.5 py-1 border-b border-slate-900/60 hover:bg-slate-900/40 px-1 rounded transition-colors text-[11px]"
                    >
                      <span className="text-slate-400 shrink-0 select-none">
                        {log.formattedPST}
                      </span>
                      <span
                        className={`px-1.5 py-0.2 rounded uppercase text-[10px] font-bold border shrink-0 ${badgeColor}`}
                      >
                        {log.type}
                      </span>
                      <span className="text-slate-300 break-all">{log.message}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>
              Server Local Time:{' '}
              <strong className="text-slate-200 font-mono">
                {data?.currentTimePST || 'Syncing...'}
              </strong>
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium transition-colors"
          >
            Close Diagnostics
          </button>
        </div>
      </div>
    </div>
  );
};
