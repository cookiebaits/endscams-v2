import React, { useState } from 'react';
import { apiClient } from '../services/apiClient';
import { EmailResult } from '../types';
import { 
  Mail, 
  Search, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ShieldCheck, 
  ShieldAlert, 
  Copy, 
  Check, 
  RefreshCw, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  Database,
  Calendar
} from 'lucide-react';

export const EmailTool: React.FC = () => {
  const [email, setEmail] = useState('test@gmail.com');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EmailResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [breachSearch, setBreachSearch] = useState('');
  const [rateLimitTimer, setRateLimitTimer] = useState<number | null>(null);

  const presets = [
    { label: 'Gmail Account', value: 'test@gmail.com' },
    { label: 'Security Admin', value: 'security@github.com' },
    { label: 'Support Role', value: 'support@stripe.com' },
    { label: 'Disposable Test', value: 'inbox@tempmail.com' },
  ];

  const handleInspect = async (targetEmail = email) => {
    if (!targetEmail.trim() || !targetEmail.includes('@')) {
      setError('Please enter a valid email address with an @ symbol.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await apiClient.queryEmail(targetEmail);
      setResult(response.data);
    } catch (err: any) {
      console.error('Email query error:', err);
      if (err.status === 429) {
        setError('AbstractAPI rate limit: The Free Plan enforces a 1 request/second limit. Please wait 3 seconds before retrying.');
        setRateLimitTimer(3);
        const timer = setInterval(() => {
          setRateLimitTimer((prev) => {
            if (prev && prev > 1) return prev - 1;
            clearInterval(timer);
            return null;
          });
        }, 1000);
      } else {
        setError(err.message || 'Failed to inspect email address.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Filter breaches if any
  const breaches = result?.breaches || [];
  const filteredBreaches = breaches.filter((b) => 
    b.domain.toLowerCase().includes(breachSearch.toLowerCase()) || 
    b.breach_date.includes(breachSearch)
  );

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Mail className="w-5 h-5 text-indigo-600" />
            Email Reputation & Breach Intelligence
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Audit mailbox deliverability, detect disposable addresses, verify MX records, and cross-reference known data breach databases.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
            Encrypted API Proxy
          </span>
        </div>
      </div>

      {/* Input Form */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          Enter Email Address to Audit
        </label>
        
        <form onSubmit={(e) => { e.preventDefault(); handleInspect(); }} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Mail className="w-4 h-4" />
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 text-slate-900 dark:text-white text-sm font-mono placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !!rateLimitTimer}
            className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-500/20 active:scale-98"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Checking...</span>
              </>
            ) : rateLimitTimer ? (
              <>
                <Clock className="w-4 h-4 animate-pulse" />
                <span>Cooldown ({rateLimitTimer}s)</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Verify Email</span>
              </>
            )}
          </button>
        </form>

        {/* Quick presets */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-slate-500 dark:text-slate-400">Test Samples:</span>
          {presets.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => {
                setEmail(preset.value);
                handleInspect(preset.value);
              }}
              className="px-2.5 py-1 text-xs rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-sm flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Verification Alert</p>
            <p className="text-xs mt-0.5">{error}</p>
          </div>
          {rateLimitTimer && (
            <button
              onClick={() => handleInspect()}
              disabled={!!rateLimitTimer}
              className="text-xs font-semibold px-2.5 py-1 bg-rose-100 dark:bg-rose-900 rounded-lg hover:bg-rose-200"
            >
              Retry ({rateLimitTimer}s)
            </button>
          )}
        </div>
      )}

      {/* Results Display */}
      {result && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
          {/* Top Status Banner */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${
                result.is_smtp_valid?.value !== false && result.is_mx_found?.value !== false
                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400'
              }`}>
                {result.is_smtp_valid?.value !== false ? <ShieldCheck className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white font-mono">
                    {result.email || email}
                  </h3>
                  {result.quality_score !== undefined && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800">
                      Score: {typeof result.quality_score === 'number' ? `${(result.quality_score * 100).toFixed(0)}%` : result.quality_score}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {breaches.length > 0 
                    ? `⚠️ Discovered in ${breaches.length} known data leaks`
                    : '✅ No public security breach records found for this address'}
                </p>
              </div>
            </div>

            <button
              onClick={() => handleCopy(result.email || email)}
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center gap-1.5 hover:bg-slate-50 transition-colors shadow-sm"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy Email'}
            </button>
          </div>

          {/* Validation Flags Grid */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
              Deliverability & Domain Attributes
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Format Valid', val: result.is_valid_format?.value, invert: false },
                { label: 'MX Records', val: result.is_mx_found?.value, invert: false },
                { label: 'SMTP Valid', val: result.is_smtp_valid?.value, invert: false },
                { label: 'Disposable', val: result.is_disposable_email?.value, invert: true },
                { label: 'Free Provider', val: result.is_free_email?.value, invert: false, neutral: true },
                { label: 'Role Account', val: result.is_role_email?.value, invert: true },
              ].map((item, idx) => {
                const isPositive = item.neutral ? true : item.invert ? !item.val : !!item.val;
                return (
                  <div key={idx} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-center">
                    <div className="flex justify-center mb-1.5">
                      {isPositive ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                      )}
                    </div>
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{item.label}</p>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                      {item.val === undefined ? 'Unknown' : item.val ? 'True' : 'False'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Breach Intelligence Panel */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/40 dark:bg-slate-800/30 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Known Compromised Breaches ({breaches.length})
                </h4>
              </div>

              {breaches.length > 5 && (
                <div className="relative w-full sm:w-48">
                  <input
                    type="text"
                    value={breachSearch}
                    onChange={(e) => setBreachSearch(e.target.value)}
                    placeholder="Search breaches..."
                    className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>

            {breaches.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">
                No recorded database leaks associated with this specific address in AbstractAPI records.
              </p>
            ) : (
              <div className="max-h-60 overflow-y-auto pr-1 space-y-1.5 scrollbar-thin">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {filteredBreaches.slice(0, 48).map((b, idx) => (
                    <div 
                      key={idx} 
                      className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono truncate" title={b.domain}>
                        {b.domain}
                      </span>
                      <span className="text-[10px] text-slate-500 shrink-0 flex items-center gap-1 font-mono">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {b.breach_date || 'Undated'}
                      </span>
                    </div>
                  ))}
                </div>
                {filteredBreaches.length > 48 && (
                  <p className="text-xs text-center text-slate-500 py-1">
                    Showing top 48 of {filteredBreaches.length} breaches. Expand raw JSON below for the full list.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Raw JSON Accordion */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
            <button
              onClick={() => setShowJson(!showJson)}
              className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 transition-colors"
            >
              {showJson ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              <span>{showJson ? 'Hide Raw AbstractAPI Response' : 'View Raw AbstractAPI Response (JSON)'}</span>
            </button>

            {showJson && (
              <div className="mt-3 relative">
                <pre className="p-4 rounded-xl bg-slate-950 text-slate-200 text-xs font-mono overflow-x-auto max-h-72 border border-slate-800">
                  {JSON.stringify(result, null, 2)}
                </pre>
                <button
                  onClick={() => handleCopy(JSON.stringify(result, null, 2))}
                  className="absolute top-2 right-2 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy JSON</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
