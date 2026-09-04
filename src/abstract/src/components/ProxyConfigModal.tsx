import React, { useState, useEffect } from 'react';
import { getProxyBaseUrl, setProxyBaseUrl } from '../services/apiClient';
import { Server, CheckCircle2, AlertCircle, RefreshCw, X, ExternalLink, ShieldCheck } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const ProxyConfigModal: React.FC<Props> = ({ isOpen, onClose, onSaved }) => {
  const [url, setUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setUrl(getProxyBaseUrl());
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async (targetUrl: string) => {
    setTesting(true);
    setTestResult(null);
    const clean = (targetUrl.trim() || '/api').replace(/\/+$/, '');
    try {
      const res = await fetch(`${clean}/status`);
      if (res.ok) {
        const data = await res.json();
        setTestResult({
          ok: true,
          message: `Connected successfully! Proxy mode: ${data.proxy_mode || 'online'}, Encryption: ${data.security?.encryption_algorithm || 'Active'}`
        });
      } else {
        setTestResult({
          ok: false,
          message: `Proxy returned HTTP ${res.status}. Check URL and CORS settings.`
        });
      }
    } catch (err: any) {
      setTestResult({
        ok: false,
        message: `Connection failed: ${err.message || 'Network error'}. If using GitHub Pages, ensure your Dokploy proxy has CORS enabled.`
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    setProxyBaseUrl(url);
    onSaved();
    onClose();
  };

  const handleReset = () => {
    setUrl('/api');
    setProxyBaseUrl('/api');
    setTestResult(null);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Proxy & Deployment Settings</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Configure Dokploy backend proxy for GitHub Pages or custom host</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wide">
              Backend Proxy Base URL
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setTestResult(null);
                }}
                placeholder="/api or https://my-dokploy-app.example.com/api"
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
              <button
                type="button"
                onClick={() => handleTestConnection(url)}
                disabled={testing}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium text-xs flex items-center gap-1.5 transition-colors"
              >
                {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Server className="w-3.5 h-3.5" />}
                Test
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
              Default is <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-blue-600 dark:text-blue-400">/api</code> when frontend and backend run on the same container (Dokploy, Docker, Cloud Run).
            </p>
          </div>

          {testResult && (
            <div className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 border ${
              testResult.ok 
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' 
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
            }`}>
              {testResult.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}

          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl p-3.5 space-y-2 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
              <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>How GitHub Pages + Dokploy Works</span>
            </div>
            <p>
              1. <strong>Dokploy Server:</strong> Hosts the secure Node.js proxy server with encrypted environment variables. It handles all AbstractAPI calls securely.
            </p>
            <p>
              2. <strong>GitHub Pages:</strong> Hosts the static React frontend. By setting this URL to your Dokploy proxy (e.g. <code className="text-blue-600">https://api.yourdomain.com/api</code>), the GitHub Pages UI sends requests through your encrypted Dokploy proxy without exposing secrets to browsers.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline underline-offset-4"
          >
            Reset to Local /api
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm"
            >
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
