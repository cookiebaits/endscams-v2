import { useState, useEffect } from 'react';
import { ServerStatusResponse } from './types';
import { apiClient } from './services/apiClient';
import { OverviewDashboard } from './components/OverviewDashboard';
import { ProxyConfigModal } from './components/ProxyConfigModal';
import { 
  AlertCircle,
  RefreshCw
} from 'lucide-react';

export default function App() {
  const [status, setStatus] = useState<ServerStatusResponse | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const fetchStatus = async () => {
    setStatusLoading(true);
    setStatusError(null);
    try {
      const data = await apiClient.getStatus();
      setStatus(data);
    } catch (err: any) {
      console.warn('Status check failed:', err.message);
      setStatusError(err.message || 'Unable to reach backend proxy');
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors selection:bg-blue-500/20">
      {/* Main Content Area - Grid Dashboard Only */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Offline / Proxy Error Advisory Banner */}
        {statusError && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-sm flex items-start justify-between gap-3 shadow-sm">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Backend Proxy Connection Notice</p>
                <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                  Currently unable to reach the proxy server at <code className="bg-amber-100 dark:bg-amber-900 px-1 py-0.5 rounded font-mono">{apiClient.getProxyUrl()}</code>.
                  If you are browsing via GitHub Pages, configure your remote Dokploy proxy URL in Settings.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
              >
                Configure Proxy
              </button>
              <button
                onClick={fetchStatus}
                className="p-1.5 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900 text-amber-800 dark:text-amber-200"
                title="Retry connection"
              >
                <RefreshCw className={`w-4 h-4 ${statusLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        )}

        {/* The Grid Dashboard is the sole primary view */}
        <OverviewDashboard status={status} />
      </main>

      {/* Footer styled per Professional Polish */}
      <footer className="h-12 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-4 sm:px-8 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-auto">
        <div className="flex items-center gap-4">
          <span>API Usage: 1,240 / 5,000</span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">Active Cache: 10m TTL</span>
          <span className="hidden md:inline">•</span>
          <span className="hidden md:inline font-mono">Cipher: AES-256-GCM</span>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            Proxy Config
          </button>
          <span>&copy; 2026 Abstract Tools Hub • Grid Dashboard</span>
        </div>
      </footer>

      {/* Settings Modal */}
      <ProxyConfigModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={() => fetchStatus()}
      />
    </div>
  );
}
