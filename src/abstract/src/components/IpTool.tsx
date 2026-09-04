import React, { useState, useEffect } from 'react';
import { apiClient } from '../services/apiClient';
import { IpResult } from '../types';
import { 
  Globe, 
  Search, 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  MapPin, 
  Server, 
  Clock, 
  DollarSign, 
  Copy, 
  Check, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp,
  ExternalLink,
  Navigation
} from 'lucide-react';

export const IpTool: React.FC = () => {
  const [ip, setIp] = useState('8.8.8.8');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IpResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showJson, setShowJson] = useState(false);

  const presets = [
    { label: 'Google DNS (8.8.8.8)', value: '8.8.8.8' },
    { label: 'Cloudflare (1.1.1.1)', value: '1.1.1.1' },
    { label: 'Quad9 (9.9.9.9)', value: '9.9.9.9' },
    { label: 'OpenDNS (208.67.222.222)', value: '208.67.222.222' }
  ];

  const handleInspect = async (targetIp = ip) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await apiClient.queryIp(targetIp.trim());
      setResult(response.data);
    } catch (err: any) {
      console.error('IP query error:', err);
      setError(err.message || 'Failed to inspect IP address.');
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    handleInspect('8.8.8.8');
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const security = result?.security;

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-emerald-600" />
            IP Intelligence & Security Analysis
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Identify VPNs, proxies, Tor exit nodes, hosting providers, geolocation, and ASN network details for any IPv4 or IPv6 address.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            Encrypted API Proxy
          </span>
        </div>
      </div>

      {/* Input Form */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          Enter Target IPv4 or IPv6 Address
        </label>
        
        <form onSubmit={(e) => { e.preventDefault(); handleInspect(); }} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Globe className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              placeholder="e.g. 8.8.8.8 or 2607:f8b0:4005:805::200e"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 text-slate-900 dark:text-white text-sm font-mono placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setIp('');
              handleInspect('');
            }}
            disabled={loading}
            className="px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Navigation className="w-3.5 h-3.5 text-blue-500" />
            <span>Detect Client IP</span>
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-500/20 active:scale-98"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Scanning...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Analyze IP</span>
              </>
            )}
          </button>
        </form>

        {/* Presets */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-slate-500 dark:text-slate-400">Sample Targets:</span>
          {presets.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => {
                setIp(preset.value);
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
          <div>
            <p className="font-semibold">Analysis Error</p>
            <p className="text-xs mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Results Display */}
      {result && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
          {/* Top Banner */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                <Globe className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white font-mono">
                    {result.ip_address}
                  </h3>
                  {result.flag?.emoji && (
                    <span className="text-lg" title={result.location?.country || ''}>
                      {result.flag.emoji}
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                    {result.asn?.name || result.company?.name || 'Public IP'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {result.location?.city ? `${result.location.city}, ` : ''}
                  {result.location?.region ? `${result.location.region}, ` : ''}
                  {result.location?.country || 'Global Location'}
                </p>
              </div>
            </div>

            <button
              onClick={() => handleCopy(result.ip_address || ip)}
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center gap-1.5 hover:bg-slate-50 transition-colors shadow-sm"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy IP'}
            </button>
          </div>

          {/* Security Matrix */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
              Security & Threat Profile
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {[
                { label: 'VPN', active: security?.is_vpn, warn: true },
                { label: 'Proxy', active: security?.is_proxy, warn: true },
                { label: 'Tor Exit', active: security?.is_tor, warn: true },
                { label: 'Relay', active: security?.is_relay, warn: true },
                { label: 'Hosting/Cloud', active: security?.is_hosting, neutral: true },
                { label: 'Mobile Cellular', active: security?.is_mobile, neutral: true },
                { label: 'Abuse Flag', active: security?.is_abuse, warn: true },
              ].map((item, idx) => {
                const isTriggered = !!item.active;
                const badgeColor = isTriggered
                  ? item.warn 
                    ? 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800' 
                    : 'bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
                  : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800';

                return (
                  <div key={idx} className={`p-3 rounded-xl border text-center transition-all ${badgeColor}`}>
                    <div className="flex justify-center mb-1">
                      {isTriggered ? (
                        item.warn ? (
                          <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        ) : (
                          <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        )
                      ) : (
                        <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      )}
                    </div>
                    <p className="text-xs font-bold truncate">{item.label}</p>
                    <p className="text-[11px] font-mono mt-0.5 opacity-80">
                      {isTriggered ? 'DETECTED' : 'Clean'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Details 2-Column Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Geolocation Card */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                  Geographical Location
                </h4>
                {result.location?.latitude && result.location?.longitude && (
                  <a
                    href={`https://www.google.com/maps?q=${result.location.latitude},${result.location.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <span>View Map</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">City / Postal Code</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {result.location?.city || 'N/A'} {result.location?.postal_code ? `(${result.location.postal_code})` : ''}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Region / State</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {result.location?.region || 'N/A'} ({result.location?.region_iso_code || 'N/A'})
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Country</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {result.location?.country || 'N/A'} ({result.location?.country_code || 'N/A'})
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Coordinates</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {result.location?.latitude || '0'}, {result.location?.longitude || '0'}
                  </span>
                </div>
              </div>
            </div>

            {/* Network & Autonomous System Card */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-blue-500" />
                Network Provider & ASN
              </h4>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Autonomous System (ASN)</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                    AS{result.asn?.asn || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Organization / ISP</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px]" title={result.asn?.name || ''}>
                    {result.asn?.name || result.company?.name || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Timezone</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {result.timezone?.name || 'N/A'} ({result.timezone?.abbreviation || 'UTC'}, {result.timezone?.local_time || ''})
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Currency</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {result.currency?.name || 'N/A'} ({result.currency?.code || ''} {result.currency?.symbol || ''})
                  </span>
                </div>
              </div>
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
