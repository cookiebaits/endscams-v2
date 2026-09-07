import React, { useState, useEffect } from 'react';
import {
  Layers,
  X,
  Send,
  RefreshCw,
  Copy,
  Check,
  Radio,
  Share2,
  Cpu,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Terminal,
  Code2,
  Trash2,
  Play
} from 'lucide-react';
import { SyncLogEntry, SyncBridgeStatus, ScamPhoneRecord } from '../types';
import { syncBridge } from '../utils/syncBridge';

interface IFrameSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: ScamPhoneRecord[];
  isScanning?: boolean;
  lastScanTime?: string | null;
  nextScheduledRefresh?: string;
  onTriggerScan?: () => void;
}

export const IFrameSyncModal: React.FC<IFrameSyncModalProps> = ({
  isOpen,
  onClose,
  records,
}) => {
  const [activeTab, setActiveTab] = useState<'status' | 'tester' | 'snippets'>('status');
  const [status, setStatus] = useState<SyncBridgeStatus>(syncBridge.getStatus());
  const [logs, setLogs] = useState<SyncLogEntry[]>(syncBridge.getLogs());
  const [filterDirection, setFilterDirection] = useState<'ALL' | 'INCOMING' | 'OUTGOING'>('ALL');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [testMessageText, setTestMessageText] = useState('Hello from Parent/Iframe Bridge!');
  const [customIframeUrl, setCustomIframeUrl] = useState('https://endscams.org/tracker');
  const [showEmbeddedTester, setShowEmbeddedTester] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      setStatus(syncBridge.getStatus());
      setLogs(syncBridge.getLogs());
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleBroadcastSyncNow = () => {
    syncBridge.broadcastCurrentState();
    setStatus(syncBridge.getStatus());
    setLogs(syncBridge.getLogs());
  };

  const handleSendPing = () => {
    syncBridge.sendHandshake();
    setStatus(syncBridge.getStatus());
    setLogs(syncBridge.getLogs());
  };

  const handleRequestSync = () => {
    syncBridge.requestSyncFromParent();
    setStatus(syncBridge.getStatus());
    setLogs(syncBridge.getLogs());
  };

  const handleSendCustomMessage = () => {
    syncBridge.broadcast('CUSTOM_EVENT', {
      message: testMessageText,
      sentAt: new Date().toISOString(),
    }, 'Manual Custom Event');
    setStatus(syncBridge.getStatus());
    setLogs(syncBridge.getLogs());
  };

  const handleClearLogs = () => {
    syncBridge.clearLogs();
    setLogs([]);
  };

  const filteredLogs = logs.filter((log) => {
    if (filterDirection === 'INCOMING') return log.direction === 'INCOMING';
    if (filterDirection === 'OUTGOING') return log.direction === 'OUTGOING';
    return true;
  });

  const parentEmbedHtmlSnippet = `<!-- 1. HTML Iframe Embed Code for https://endscams.org/tracker -->
<iframe 
  id="end-scam-scanner-frame"
  src="${typeof window !== 'undefined' ? window.location.origin : 'https://your-scanner-app-url'}"
  width="100%" 
  height="750px" 
  style="border: 1px solid #334155; border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3);"
  allow="clipboard-write; storage-access"
></iframe>

<script>
  // 2. Real-Time Bi-Directional Synchronization for https://endscams.org/tracker
  const iframeEl = document.getElementById('end-scam-scanner-frame');

  // A. Listen for live threat intel records from the scanner iframe
  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    // Direct compatibility: handles SYNC_DATA and TRACKER_RECORDS_UPDATED
    if (data.type === 'SYNC_DATA' || data.event === 'TRACKER_RECORDS_UPDATED') {
      const records = data.payload?.records || data.records || [];
      console.log('✅ [EndScams Tracker] Received fresh scam records:', records);
      console.log('Total Active Threats:', records.length);
      
      // Update your tracker state or store:
      // window.endScamsTracker.updateRecords(records);
    }

    if (data.type === 'HANDSHAKE' || data.type === 'HANDSHAKE_ACK') {
      console.log('🤝 [EndScams Tracker] Connected to Threat Harvester iframe!');
    }
  });

  // B. Commands you can invoke from endscams.org/tracker
  function requestLatestThreats() {
    iframeEl.contentWindow.postMessage({
      source: 'ENDSCAMS_TRACKER',
      type: 'REQUEST_SYNC',
      timestamp: new Date().toISOString()
    }, '*');
  }

  function triggerHarvesterScan() {
    iframeEl.contentWindow.postMessage({
      source: 'ENDSCAMS_TRACKER',
      type: 'TRIGGER_SCAN',
      timestamp: new Date().toISOString()
    }, '*');
  }
</script>`;

  const reactHookSnippet = `import React, { useEffect, useState } from 'react';

export function useScamScannerSync(iframeRef) {
  const [records, setRecords] = useState([]);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    const handleMessage = (event) => {
      const { type, payload } = event.data || {};
      if (type === 'SYNC_DATA' && payload?.records) {
        setRecords(payload.records);
        setIsScanning(Boolean(payload.isScanning));
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const triggerScan = () => {
    iframeRef.current?.contentWindow?.postMessage({
      type: 'TRIGGER_SCAN',
      timestamp: new Date().toISOString()
    }, '*');
  };

  return { records, isScanning, triggerScan };
}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-slate-100">
                  Parent &amp; Iframe Real-Time Sync Bridge
                </h2>
                <span
                  className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
                    status.isEmbeddedInIframe
                      ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                      : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  }`}
                >
                  {status.isEmbeddedInIframe ? '⚡ Embedded in Iframe' : '🖥️ Top-Level Host'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Zero-republish live data exchange via <code className="text-amber-300 font-mono">window.postMessage()</code>, <code className="text-emerald-300 font-mono">BroadcastChannel</code>, and <code className="text-cyan-300 font-mono">SharedStorage</code>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6">
          <button
            onClick={() => setActiveTab('status')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'status'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>Live Status &amp; Logs</span>
          </button>

          <button
            onClick={() => setActiveTab('tester')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'tester'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Share2 className="w-4 h-4" />
            <span>Interactive Iframe Sandbox</span>
          </button>

          <button
            onClick={() => setActiveTab('snippets')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'snippets'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>Embed &amp; API Code Snippets</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: STATUS & LOGS */}
          {activeTab === 'status' && (
            <div className="space-y-6">
              {/* Status Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Environment Mode</span>
                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="text-sm font-bold text-slate-200 mt-1">
                    {status.isEmbeddedInIframe ? 'Iframe Child Window' : 'Standalone / Parent Host'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {status.hasParentWindow ? 'Parent Window linked' : 'No outer frame detected'}
                  </div>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>BroadcastChannel API</span>
                    <Radio className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="text-sm font-bold text-emerald-400 mt-1">
                    {status.hasBroadcastChannel ? 'Active & Ready' : 'Unavailable'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Syncs same-origin tabs instantly
                  </div>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>SharedStorage API</span>
                    <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                  <div className="text-sm font-bold text-cyan-400 mt-1">
                    {status.hasSharedStorage ? 'Supported (Fenced Frames)' : 'Fallback (StorageEvent)'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Cross-context persistent keys
                  </div>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Messages Exchanged</span>
                    <Cpu className="w-3.5 h-3.5 text-purple-400" />
                  </div>
                  <div className="text-sm font-bold text-slate-200 mt-1 flex items-center space-x-2">
                    <span className="text-emerald-400">↑ {status.messagesSentCount}</span>
                    <span className="text-slate-600">|</span>
                    <span className="text-amber-400">↓ {status.messagesReceivedCount}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                    {status.lastSyncTimestamp ? `Last: ${new Date(status.lastSyncTimestamp).toLocaleTimeString()}` : 'No messages yet'}
                  </div>
                </div>
              </div>

              {/* Quick Actions Bar */}
              <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-semibold text-slate-200">
                    Live Synchronization Commands:
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleBroadcastSyncNow}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs flex items-center space-x-1.5 transition-colors shadow-sm"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Broadcast Full Dataset Now ({records.length} records)</span>
                    </button>
                    <button
                      onClick={handleRequestSync}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Request Sync from Parent</span>
                    </button>
                    <button
                      onClick={handleSendPing}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                    >
                      <Radio className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Send Handshake Ping</span>
                    </button>
                  </div>
                </div>

                {/* Custom Event Sender */}
                <div className="flex items-center space-x-2 pt-2 border-t border-slate-800/80">
                  <input
                    type="text"
                    value={testMessageText}
                    onChange={(e) => setTestMessageText(e.target.value)}
                    placeholder="Enter test message payload to send across iframe boundary..."
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    onClick={handleSendCustomMessage}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold shrink-0"
                  >
                    Send Custom Message
                  </button>
                </div>
              </div>

              {/* Message Inspector Log */}
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center space-x-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Live Message Inspector ({filteredLogs.length} events)
                    </h3>
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-[11px]">
                      <button
                        onClick={() => setFilterDirection('ALL')}
                        className={`px-2 py-0.5 rounded ${filterDirection === 'ALL' ? 'bg-slate-800 text-slate-100 font-semibold' : 'text-slate-400'}`}
                      >
                        All
                      </button>
                      <button
                        onClick={() => setFilterDirection('INCOMING')}
                        className={`px-2 py-0.5 rounded ${filterDirection === 'INCOMING' ? 'bg-amber-500/20 text-amber-300 font-semibold' : 'text-slate-400'}`}
                      >
                        Incoming (↓)
                      </button>
                      <button
                        onClick={() => setFilterDirection('OUTGOING')}
                        className={`px-2 py-0.5 rounded ${filterDirection === 'OUTGOING' ? 'bg-emerald-500/20 text-emerald-300 font-semibold' : 'text-slate-400'}`}
                      >
                        Outgoing (↑)
                      </button>
                    </div>

                    <button
                      onClick={handleClearLogs}
                      className="p-1 text-slate-500 hover:text-slate-300 rounded hover:bg-slate-800"
                      title="Clear message logs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 max-h-72 overflow-y-auto font-mono text-xs space-y-2">
                  {filteredLogs.length === 0 ? (
                    <div className="py-8 text-center text-slate-500 text-xs font-sans">
                      No messages received or sent yet. Click <strong>"Broadcast Full Dataset Now"</strong> or <strong>"Send Handshake Ping"</strong> above to test communication.
                    </div>
                  ) : (
                    filteredLogs.map((log) => (
                      <div
                        key={log.id}
                        className={`p-2.5 rounded-lg border text-xs flex flex-col space-y-1.5 ${
                          log.direction === 'INCOMING'
                            ? 'bg-amber-950/20 border-amber-500/20 text-amber-200'
                            : 'bg-emerald-950/20 border-emerald-500/20 text-emerald-200'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <div className="flex items-center space-x-2">
                            {log.direction === 'INCOMING' ? (
                              <span className="flex items-center text-amber-400 font-bold">
                                <ArrowDownLeft className="w-3.5 h-3.5 mr-1" />
                                INCOMING (from {log.origin})
                              </span>
                            ) : (
                              <span className="flex items-center text-emerald-400 font-bold">
                                <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
                                OUTGOING (to Parent/Frames)
                              </span>
                            )}
                            <span className="px-1.5 py-0.2 bg-slate-900 border border-slate-800 rounded text-[10px] text-slate-400">
                              {log.channel}
                            </span>
                          </div>
                          <span className="text-slate-500 text-[10px]">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-100">
                            Type: <strong className="text-amber-400">{log.type}</strong>
                          </span>
                          <button
                            onClick={() => copyToClipboard(JSON.stringify(log.payload, null, 2), log.id)}
                            className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center space-x-1"
                          >
                            {copiedKey === log.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>Copy Payload</span>
                          </button>
                        </div>

                        <pre className="text-[10px] bg-slate-950 p-2 rounded border border-slate-900 overflow-x-auto text-slate-300 max-h-28">
                          {JSON.stringify(log.payload, null, 2)}
                        </pre>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: INTERACTIVE TESTER */}
          {activeTab === 'tester' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                  <Share2 className="w-4 h-4 text-amber-400" />
                  <span>Live Iframe Bi-Directional Test Sandbox</span>
                </h3>
                <p className="text-xs text-slate-400">
                  You can test embedding another page or test the built-in communication simulation to verify real-time data sync without reloading or republishing.
                </p>

                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={customIframeUrl}
                    onChange={(e) => setCustomIframeUrl(e.target.value)}
                    placeholder="Enter your other page URL (optional) or leave blank to test simulated iframe..."
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    onClick={() => setShowEmbeddedTester(!showEmbeddedTester)}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs flex items-center space-x-1.5 transition-colors shadow-sm"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{showEmbeddedTester ? 'Close Sandbox' : 'Launch Live Sandbox'}</span>
                  </button>
                </div>
              </div>

              {showEmbeddedTester && (
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                  <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300">
                    <span className="flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="font-mono">{customIframeUrl || 'Sandbox Child Frame (Simulated)'}</span>
                    </span>
                    <button
                      onClick={handleBroadcastSyncNow}
                      className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-[11px] hover:bg-amber-500/30 font-semibold"
                    >
                      Push State to Frame
                    </button>
                  </div>

                  {customIframeUrl ? (
                    <iframe
                      src={customIframeUrl}
                      className="w-full h-80 border-0"
                      title="Custom Iframe Sandbox"
                    />
                  ) : (
                    <div className="p-6 text-center space-y-4">
                      <div className="max-w-md mx-auto p-4 bg-slate-900 border border-slate-800 rounded-xl text-left space-y-2">
                        <div className="text-xs font-bold text-slate-200">
                          Simulated Child Iframe Listening via postMessage:
                        </div>
                        <div className="text-xs text-slate-400">
                          Currently ready to exchange records. Current active database size: <strong className="text-amber-400">{records.length} records</strong>.
                        </div>
                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={handleBroadcastSyncNow}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium"
                          >
                            Send SYNC_DATA
                          </button>
                          <button
                            onClick={handleSendPing}
                            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium"
                          >
                            Send PING
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CODE SNIPPETS */}
          {activeTab === 'snippets' && (
            <div className="space-y-6">
              {/* Snippet 1: Parent Page Embed */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Code2 className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Parent Page Embed &amp; PostMessage Sync Code
                    </span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(parentEmbedHtmlSnippet, 'parentSnippet')}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                  >
                    {copiedKey === 'parentSnippet' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'parentSnippet' ? 'Copied!' : 'Copy Code'}</span>
                  </button>
                </div>
                <pre className="text-xs bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-slate-300 overflow-x-auto">
                  {parentEmbedHtmlSnippet}
                </pre>
              </div>

              {/* Snippet 2: React Hook */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Code2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      React / Next.js Hook Integration
                    </span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(reactHookSnippet, 'reactSnippet')}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                  >
                    {copiedKey === 'reactSnippet' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'reactSnippet' ? 'Copied!' : 'Copy React Hook'}</span>
                  </button>
                </div>
                <pre className="text-xs bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-slate-300 overflow-x-auto">
                  {reactHookSnippet}
                </pre>
              </div>

              {/* Supported Protocol Messages Reference Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Supported Message Types Reference
                </h4>
                <div className="border border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="p-2.5 font-semibold">Message Type</th>
                        <th className="p-2.5 font-semibold">Direction</th>
                        <th className="p-2.5 font-semibold">Payload &amp; Behavior</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                      <tr className="bg-slate-900/40">
                        <td className="p-2.5 text-amber-400 font-bold">REQUEST_SYNC / GET_RECORDS</td>
                        <td className="p-2.5 text-slate-300">Parent → Iframe</td>
                        <td className="p-2.5 text-slate-400">Triggers an immediate <code className="text-emerald-400">SYNC_DATA</code> response with all scam records.</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-emerald-400 font-bold">SYNC_DATA</td>
                        <td className="p-2.5 text-slate-300">Iframe → Parent</td>
                        <td className="p-2.5 text-slate-400"><code className="text-slate-300">{`{ records, totalRecords, isScanning, lastScanTime }`}</code></td>
                      </tr>
                      <tr className="bg-slate-900/40">
                        <td className="p-2.5 text-cyan-400 font-bold">TRIGGER_SCAN</td>
                        <td className="p-2.5 text-slate-300">Parent → Iframe</td>
                        <td className="p-2.5 text-slate-400">Triggers the automated threat harvester scan remotely.</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-purple-400 font-bold">ADD_RECORD</td>
                        <td className="p-2.5 text-slate-300">Either Direction</td>
                        <td className="p-2.5 text-slate-400"><code className="text-slate-300">{`{ record: { phone, scamType, sourceUrl, ... } }`}</code> adds record into database.</td>
                      </tr>
                      <tr className="bg-slate-900/40">
                        <td className="p-2.5 text-pink-400 font-bold">TOGGLE_NUMBER_DOWN</td>
                        <td className="p-2.5 text-slate-300">Either Direction</td>
                        <td className="p-2.5 text-slate-400"><code className="text-slate-300">{`{ id: "rec_123" }`}</code> marks number down while retaining it in the database.</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-amber-400 font-bold">SET_FILTER</td>
                        <td className="p-2.5 text-slate-300">Either Direction</td>
                        <td className="p-2.5 text-slate-400"><code className="text-slate-300">{`{ searchTerm, category, platform, country }`}</code> synchronizes table search filters.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Sync Bridge Active &bull; <strong className="text-slate-200">{records.length} records ready</strong></span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
