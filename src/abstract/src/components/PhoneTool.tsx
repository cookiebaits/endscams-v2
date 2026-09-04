import React, { useState } from 'react';
import { apiClient } from '../services/apiClient';
import { PhoneResult } from '../types';
import { 
  Phone, 
  Search, 
  CheckCircle2, 
  XCircle, 
  ShieldAlert, 
  Radio, 
  MapPin, 
  Globe2, 
  Copy, 
  Check, 
  Clock, 
  RefreshCw,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export const PhoneTool: React.FC = () => {
  const [phone, setPhone] = useState('+14152007986');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PhoneResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [rateLimitTimer, setRateLimitTimer] = useState<number | null>(null);

  const presets = [
    { label: 'US Mobile', value: '+14152007986' },
    { label: 'UK London', value: '+442079460991' },
    { label: 'France Paris', value: '+33142685555' },
    { label: 'Japan Tokyo', value: '+81312345678' },
  ];

  const handleInspect = async (targetPhone = phone) => {
    if (!targetPhone.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await apiClient.queryPhone(targetPhone);
      setResult(response.data);
    } catch (err: any) {
      console.error('Phone query error:', err);
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
        setError(err.message || 'Failed to inspect phone number.');
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

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Phone className="w-5 h-5 text-blue-600" />
            Phone Intelligence & Carrier Lookup
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Validate phone numbers, identify mobile/VoIP line types, detect telecommunication carrier, and calculate risk scores.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            Encrypted API Proxy
          </span>
        </div>
      </div>

      {/* Input Form */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          Enter International Phone Number
        </label>
        
        <form onSubmit={(e) => { e.preventDefault(); handleInspect(); }} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Phone className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+14152007986 (include country code)"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 text-slate-900 dark:text-white text-sm font-mono placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !!rateLimitTimer}
            className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-500/20 active:scale-98"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Querying...</span>
              </>
            ) : rateLimitTimer ? (
              <>
                <Clock className="w-4 h-4 animate-pulse" />
                <span>Cooldown ({rateLimitTimer}s)</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Inspect Phone</span>
              </>
            )}
          </button>
        </form>

        {/* Quick presets */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-slate-500 dark:text-slate-400">Sample Numbers:</span>
          {presets.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => {
                setPhone(preset.value);
                handleInspect(preset.value);
              }}
              className="px-2.5 py-1 text-xs rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono transition-colors"
            >
              {preset.label} ({preset.value})
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-sm flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Query Failed</p>
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
                result.valid 
                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400'
              }`}>
                {result.valid ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white font-mono">
                    {result.format?.international || result.phone || phone}
                  </h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    result.valid
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                      : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                  }`}>
                    {result.valid ? 'Valid Phone' : 'Invalid / Unallocated'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Local format: <span className="font-mono text-slate-700 dark:text-slate-300">{result.format?.local || 'N/A'}</span>
                </p>
              </div>
            </div>

            <button
              onClick={() => handleCopy(result.format?.international || result.phone || phone)}
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center gap-1.5 hover:bg-slate-50 transition-colors shadow-sm"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy Number'}
            </button>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Carrier */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                <Radio className="w-3.5 h-3.5 text-blue-500" />
                Carrier
              </div>
              <p className="text-base font-bold text-slate-900 dark:text-white truncate">
                {result.carrier || 'Unknown Carrier'}
              </p>
              <p className="text-xs text-slate-500 mt-1">Network Provider</p>
            </div>

            {/* Line Type */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                <Phone className="w-3.5 h-3.5 text-indigo-500" />
                Line Type
              </div>
              <p className="text-base font-bold text-slate-900 dark:text-white capitalize">
                {result.type || 'Landline / Mobile'}
              </p>
              <p className="text-xs text-slate-500 mt-1">Classification</p>
            </div>

            {/* Country & Region */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                <Globe2 className="w-3.5 h-3.5 text-emerald-500" />
                Country
              </div>
              <p className="text-base font-bold text-slate-900 dark:text-white truncate">
                {result.country?.name || 'Global'} ({result.country?.code || 'XX'})
              </p>
              <p className="text-xs text-slate-500 mt-1">Prefix: {result.country?.prefix || 'N/A'}</p>
            </div>

            {/* Location */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                <MapPin className="w-3.5 h-3.5 text-amber-500" />
                Registered Location
              </div>
              <p className="text-base font-bold text-slate-900 dark:text-white truncate">
                {result.location || result.country?.name || 'Registered Area'}
              </p>
              <p className="text-xs text-slate-500 mt-1">Geographic Region</p>
            </div>
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
