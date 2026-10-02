import React, { useState, useEffect } from 'react';
import {
  Search, ShieldAlert, CheckCircle2, ExternalLink, Loader2,
  Phone, Globe, Shield, ArrowRight, X
} from 'lucide-react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import databaseSeed from '../data/database_seed.json';

// Helper: Normalize input phone
function normalizeInput(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  return digits;
}

// Helper: Format phone display
function formatPhoneDisplay(raw: string): string {
  if (!raw) return '';
  const rawTrim = raw.trim();
  const isPlus = rawTrim.startsWith('+');
  const digits = rawTrim.replace(/\D/g, '');
  if (!digits) return rawTrim;

  if (isPlus || (digits.length > 10 && !digits.startsWith('1')) || (digits.length >= 11 && !digits.startsWith('1'))) {
    let ccLength = 3;
    if (digits.startsWith('1')) {
      ccLength = 1;
    } else if (
      ['44', '33', '49', '39', '34', '31', '32', '41', '43', '46', '47', '45', '48', '61', '64', '81', '82', '86', '91', '20', '27', '55', '52', '54'].some(p => digits.startsWith(p))
    ) {
      ccLength = 2;
    } else if (isPlus) {
      ccLength = Math.min(3, digits.length);
    } else if (digits.length <= 10) {
      ccLength = Math.min(3, Math.max(2, digits.length - 7));
    }

    if (ccLength === 1 && digits.length === 11) {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }

    const cc = digits.slice(0, ccLength);
    const rest = digits.slice(ccLength);
    if (!rest) return `+(${cc})`;
    if (rest.length <= 3) return `+(${cc}) ${rest}`;
    if (rest.length <= 8) return `+(${cc}) ${rest.slice(0, 3)}-${rest.slice(3)}`;
    return `+(${cc}) ${rest.slice(0, 3)}-${rest.slice(3, 8)}${rest.length > 8 ? '-' + rest.slice(8) : ''}`;
  }

  if (digits.length === 10) {
    return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  return `+${digits}`;
}

// Helper: Format typing
function formatTyping(value: string): string {
  if (!value) return '';
  const rawTrim = value.trim();
  if (rawTrim.startsWith('+')) {
    const digits = rawTrim.slice(1).replace(/\D/g, '');
    if (!digits) return '+';
    let ccLength = 3;
    if (digits.startsWith('1')) ccLength = 1;
    else if (['44', '33', '49', '39', '34', '31', '32', '41', '43', '46', '47', '45', '48', '61', '64', '81', '82', '86', '91', '20', '27', '55', '52', '54'].some(p => digits.startsWith(p))) {
      ccLength = 2;
    }
    const cc = digits.slice(0, ccLength);
    const rest = digits.slice(ccLength);
    if (!rest) return `+(${cc})`;
    if (rest.length <= 3) return `+(${cc}) ${rest}`;
    if (rest.length <= 8) return `+(${cc}) ${rest.slice(0, 3)}-${rest.slice(3)}`;
    return `+(${cc}) ${rest.slice(0, 3)}-${rest.slice(3, 8)}-${rest.slice(8)}`;
  }

  const digits = value.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 11)}`;
  }
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

// Phone matching logic
function isRecordMatch(record: any, targetInput: string): boolean {
  if (!record || !targetInput) return false;
  const rawTarget = String(targetInput).trim();
  const cleanTarget = rawTarget.replace(/\D/g, '');
  if (!cleanTarget || cleanTarget.length < 7) return false;

  let target10 = cleanTarget;
  if (cleanTarget.length === 11 && cleanTarget.startsWith('1')) {
    target10 = cleanTarget.slice(1);
  }

  const candidateDigits: string[] = [];
  const addVal = (val: any) => {
    if (!val) return;
    const d = String(val).replace(/\D/g, '');
    if (d && !candidateDigits.includes(d)) candidateDigits.push(d);
  };

  addVal(record.phone_digits);
  addVal(record.clean_phone);
  addVal(record.cleanPhone);
  addVal(record.phone_number);
  addVal(record.phone);
  addVal(record.alt_phone);

  if (Array.isArray(record.alt_numbers)) {
    for (const alt of record.alt_numbers) {
      if (typeof alt === 'string') {
        addVal(alt);
      } else if (alt && typeof alt === 'object') {
        addVal(alt.digits);
        addVal(alt.phone);
      }
    }
  }

  for (const cDigits of candidateDigits) {
    if (!cDigits) continue;
    if (cDigits === cleanTarget) return true;

    let c10 = cDigits;
    if (cDigits.length === 11 && cDigits.startsWith('1')) {
      c10 = cDigits.slice(1);
    }

    if (target10.length === 10 && c10.length === 10 && target10 === c10) return true;

    if (target10.length === 10) {
      if (cDigits === `1${target10}` || cDigits === target10) return true;
    }
    if (c10.length === 10) {
      if (cleanTarget === `1${c10}` || cleanTarget === c10) return true;
    }

    if (cleanTarget.startsWith('234') && cDigits.startsWith('0') && cDigits.slice(1) === cleanTarget.slice(3)) return true;
    if (cDigits.startsWith('234') && cleanTarget.startsWith('0') && cleanTarget.slice(1) === cDigits.slice(3)) return true;
    if (cleanTarget.startsWith('254') && cDigits.startsWith('0') && cDigits.slice(1) === cleanTarget.slice(3)) return true;
    if (cDigits.startsWith('254') && cleanTarget.startsWith('0') && cleanTarget.slice(1) === cDigits.slice(3)) return true;

    if (cleanTarget.length >= 10 && cDigits.length >= 10 && cleanTarget === cDigits) return true;
  }

  return false;
}

export type SearchResult = {
  found: boolean;
  reports: Array<{ id: string; category: string; description: string; incident_date: string; source: string; source_url?: string }>;
  trackerEntries: Array<{ id: string; source_name: string; source_url: string; report_date: string; category?: string; description?: string }>;
};

export interface CommunityScamDatabaseSearchProps {
  onNavigateToTracker?: (searchQuery?: string) => void;
  onNavigateToReport?: (prefilledPhone?: string) => void;
  onNavigateToHome?: () => void;
}

export default function CommunityScamDatabaseSearch({
  onNavigateToTracker,
  onNavigateToReport,
}: CommunityScamDatabaseSearchProps) {
  const [input, setInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [searched, setSearched] = useState(false);
  const [searchedDigits, setSearchedDigits] = useState('');
  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient | null>(null);

  useEffect(() => {
    async function initSupabase() {
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const config = await res.json();
          if (config.supabaseUrl && config.supabaseKey) {
            setSupabaseClient(createClient(config.supabaseUrl, config.supabaseKey));
          }
        }
      } catch (e) {
        console.warn('Failed to fetch config for database search', e);
      }
    }
    initSupabase();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setInput(formatTyping(raw));
  };

  const executeSearch = async (queryInput: string) => {
    const rawInput = queryInput.trim();
    const cleanDigits = rawInput.replace(/\D/g, '');
    if (cleanDigits.length < 7) return;

    setSearching(true);
    setSearched(false);
    setSearchedDigits(cleanDigits);

    try {
      const reports: Array<{ id: string; category: string; description: string; incident_date: string; source: string; source_url?: string }> = [];
      const trackerEntries: Array<{ id: string; source_name: string; source_url: string; report_date: string; category?: string; description?: string }> = [];
      const seenIds = new Set<string>();

      // 1. Direct Backend /api/records Query
      try {
        const recRes = await fetch('/api/records');
        if (recRes.ok) {
          const recData = await recRes.json();
          if (Array.isArray(recData.records)) {
            recData.records.forEach((item: any) => {
              if (isRecordMatch(item, rawInput)) {
                const itemId = String(item.id || item.phone_digits || item.phone_number);
                if (!seenIds.has(itemId)) {
                  seenIds.add(itemId);
                  trackerEntries.push({
                    id: itemId,
                    source_name: item.source_name || item.source || 'Live Threat Tracker',
                    source_url: item.source_url || item.sourceUrl || '',
                    report_date: item.report_date || item.incident_date || new Date().toISOString().split('T')[0],
                    category: item.category || 'Scam Intelligence',
                    description: item.description || item.impersonated_company || ''
                  });
                }
              }
            });
          }
        }
      } catch (err) {
        console.warn('Backend /api/records fetch error:', err);
      }

      // 2. Direct Seed database check
      if (Array.isArray(databaseSeed)) {
        databaseSeed.forEach((item: any) => {
          if (isRecordMatch(item, rawInput)) {
            const itemId = String(item.id || item.phone_digits || item.phone_number);
            if (!seenIds.has(itemId)) {
              seenIds.add(itemId);
              trackerEntries.push({
                id: itemId,
                source_name: item.source_name || item.source || 'Watchdog Seed Index',
                source_url: item.source_url || '',
                report_date: item.report_date || new Date().toISOString().split('T')[0],
                category: item.category || 'Scam Intelligence',
                description: item.description || item.impersonated_company || ''
              });
            }
          }
        });
      }

      // 3. Supabase query if available
      if (supabaseClient) {
        try {
          const core10Digits = normalizeInput(rawInput);
          const target11Digits = `1${core10Digits}`;
          const [reportsRes, trackerRes] = await Promise.all([
            supabaseClient
              .from('scam_reports')
              .select('id,category,description,incident_date,source,source_url,phone_digits,phone_number')
              .or(`phone_digits.eq.${core10Digits},phone_digits.eq.${target11Digits},phone_digits.eq.${cleanDigits}`)
              .order('incident_date', { ascending: false }),
            supabaseClient
              .from('tracker_entries')
              .select('id,source_name,source_url,report_date,category,description,phone_digits,phone_number')
              .or(`phone_digits.eq.${core10Digits},phone_digits.eq.${target11Digits},phone_digits.eq.${cleanDigits}`)
              .order('report_date', { ascending: false }),
          ]);

          if (reportsRes && reportsRes.data) {
            reportsRes.data.forEach((r: any) => {
              if (isRecordMatch(r, rawInput) && !seenIds.has(r.id)) {
                seenIds.add(r.id);
                reports.push({
                  id: r.id,
                  category: r.category || 'User Scam Report',
                  description: r.description || '',
                  incident_date: r.incident_date || r.report_date || new Date().toISOString().split('T')[0],
                  source: r.source || 'User Report',
                  source_url: r.source_url
                });
              }
            });
          }

          if (trackerRes && trackerRes.data) {
            trackerRes.data.forEach((t: any) => {
              if (isRecordMatch(t, rawInput) && !seenIds.has(t.id)) {
                seenIds.add(t.id);
                trackerEntries.push({
                  id: t.id,
                  source_name: t.source_name || 'Threat Intelligence Tracker',
                  source_url: t.source_url || '',
                  report_date: t.report_date || new Date().toISOString().split('T')[0],
                  category: t.category || 'Scam',
                  description: t.description || ''
                });
              }
            });
          }
        } catch (e) {
          console.warn('Supabase search error:', e);
        }
      }

      // 4. LocalStorage search
      const storageKeys = ['esscan_threat_records_v2', 'user_reported_scams', 'end_scam_scan_shared_state', 'tracker_records'];
      storageKeys.forEach((key) => {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            const items = Array.isArray(parsed) ? parsed : (parsed.records && Array.isArray(parsed.records) ? parsed.records : []);
            items.forEach((item: any) => {
              if (item && isRecordMatch(item, rawInput)) {
                const itemId = item.id || `local-${item.phone_digits || item.cleanPhone || Math.random()}`;
                if (!seenIds.has(itemId)) {
                  seenIds.add(itemId);
                  trackerEntries.push({
                    id: itemId,
                    source_name: item.source_name || item.source || item.platform || 'Local Report Index',
                    source_url: item.source_url || item.sourceUrl || '',
                    report_date: item.report_date || item.incident_date || item.detectedAt || new Date().toISOString().split('T')[0],
                    category: item.category || item.type_of_scam || item.scamType || 'Reported Scam',
                    description: item.description || item.detailedSummary || item.snippet || ''
                  });
                }
              }
            });
          }
        } catch {}
      });

      const totalFound = reports.length > 0 || trackerEntries.length > 0;
      setResult({ found: totalFound, reports, trackerEntries });
    } catch {
      setResult({ found: false, reports: [], trackerEntries: [] });
    } finally {
      setSearching(false);
      setSearched(true);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(input);
  };

  const handleQuickSample = (samplePhone: string) => {
    setInput(samplePhone);
    executeSearch(samplePhone);
  };

  const buildSearchUrl = (engine: string, digits: string) => {
    const formatted = formatPhoneDisplay(digits);
    const dashes = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    const q = encodeURIComponent(`"${formatted}" OR "${dashes}" OR "${digits}" scam`);
    if (engine === 'google') return `https://www.google.com/search?q=${q}`;
    if (engine === 'duckduckgo') return `https://duckduckgo.com/?q=${q}`;
    return `https://search.brave.com/search?q=${q}`;
  };

  return (
    <div className="max-w-4xl mx-auto px-4">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-4">
          <Shield className="w-3.5 h-3.5" />
          <span>Watchdog Database Search</span>
        </div>
        <h2 className="text-3xl md:text-4xl font-black text-white mb-3 tracking-tight">
          Community Scam Database Search
        </h2>
        <p className="text-slate-400 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
          Search our global watchdog database by phone number to check for known scam reports, active decoy hits, and impersonation flags.
        </p>
      </div>

      {/* Search Input Box */}
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="relative flex flex-col sm:flex-row gap-3 p-2 bg-slate-900/90 rounded-2xl border border-slate-800 shadow-2xl backdrop-blur-sm">
          <div className="relative flex-1 flex items-center">
            <Phone className="absolute left-4 w-5 h-5 text-slate-500" />
            <input
              type="text"
              value={input}
              onChange={handleInputChange}
              placeholder="Enter phone number (e.g. (800) 555-0199 or 8882001234)"
              className="w-full pl-12 pr-10 py-3.5 bg-transparent text-white placeholder-slate-500 text-base rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
            {input && (
              <button
                type="button"
                onClick={() => { setInput(''); setSearched(false); setResult(null); }}
                className="absolute right-3 p-1 text-slate-500 hover:text-slate-300 transition"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={searching || !input.trim()}
            className="px-8 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-xl text-base shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 cursor-pointer shrink-0"
          >
            {searching ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Searching...</span>
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                <span>Check Number</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Sample Quick Try Chips */}
      {!searched && (
        <div className="flex flex-wrap items-center justify-center gap-2 mb-8 text-xs text-slate-400">
          <span className="font-medium text-slate-500">Quick Try Sample:</span>
          {['(800) 555-0199', '(888) 200-1234', '800-386-8422'].map((sample) => (
            <button
              key={sample}
              onClick={() => handleQuickSample(sample)}
              className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-amber-400/90 hover:text-amber-300 hover:border-amber-500/40 transition cursor-pointer"
            >
              {sample}
            </button>
          ))}
        </div>
      )}

      {/* Results Rendering */}
      {searched && result && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {result.found ? (
            <div className="bg-slate-900/90 rounded-2xl p-6 md:p-8 border border-red-500/30 shadow-2xl">
              <div className="flex items-center gap-3 mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                <ShieldAlert className="w-6 h-6 shrink-0" />
                <div>
                  <h3 className="font-extrabold text-lg text-white">MATCH FOUND IN WATCHDOG DATABASE</h3>
                  <p className="text-xs text-red-300/90">
                    Phone number <span className="font-mono font-bold">{formatPhoneDisplay(searchedDigits)}</span> matches active threat records.
                  </p>
                </div>
              </div>

              {/* Matched Items */}
              <div className="space-y-4 mb-6">
                {result.trackerEntries.map((item) => (
                  <div key={item.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-left">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {item.category || 'Threat Tracker'}
                      </span>
                      <span className="text-xs text-slate-500">{item.report_date}</span>
                    </div>
                    {item.description && (
                      <p className="text-sm text-slate-200 mb-3 leading-relaxed">{item.description}</p>
                    )}
                    <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                      <span>Source: <strong className="text-slate-300">{item.source_name}</strong></span>
                      {item.source_url && (
                        <a
                          href={item.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-amber-400 hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" /> Source Link
                        </a>
                      )}
                    </div>
                  </div>
                ))}

                {result.reports.map((item) => (
                  <div key={item.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-left">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                        {item.category || 'User Scam Report'}
                      </span>
                      <span className="text-xs text-slate-500">{item.incident_date}</span>
                    </div>
                    {item.description && (
                      <p className="text-sm text-slate-200 mb-3 leading-relaxed">{item.description}</p>
                    )}
                    <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                      <span>Source: <strong className="text-slate-300">{item.source}</strong></span>
                      {item.source_url && (
                        <a
                          href={item.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-amber-400 hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" /> View Evidence
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => onNavigateToTracker && onNavigateToTracker(input)}
                  className="flex-1 py-3 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  View in Live Threat Tracker <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onNavigateToReport && onNavigateToReport(input)}
                  className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 border border-slate-700 transition cursor-pointer"
                >
                  Submit Additional Report
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/90 rounded-2xl p-6 md:p-8 border border-emerald-500/30 shadow-2xl text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-4">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">NO MATCHES FOUND IN WATCHDOG DATABASE</h3>
              <p className="text-slate-400 text-sm max-w-md mx-auto mb-6 leading-relaxed">
                Number <span className="font-mono text-emerald-400 font-bold">{formatPhoneDisplay(searchedDigits)}</span> is not currently flagged in our index. Exercise caution, as scammers frequently rotate numbers.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto mb-6">
                <button
                  onClick={() => onNavigateToReport && onNavigateToReport(input)}
                  className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <ShieldAlert className="w-4 h-4" /> Report This Number
                </button>
                <a
                  href="#advanced-tools"
                  className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 border border-slate-700 transition cursor-pointer"
                >
                  <Globe className="w-4 h-4 text-amber-400" /> Carrier Deep Search
                </a>
              </div>

              {/* External Web Search Links */}
              <div className="pt-6 border-t border-slate-800">
                <p className="text-xs font-semibold text-slate-500 mb-3">Check External Search Engines:</p>
                <div className="flex flex-wrap justify-center gap-2 text-xs">
                  <a
                    href={buildSearchUrl('google', searchedDigits)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-amber-400 transition flex items-center gap-1.5"
                  >
                    Google Search <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href={buildSearchUrl('duckduckgo', searchedDigits)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-amber-400 transition flex items-center gap-1.5"
                  >
                    DuckDuckGo <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href={buildSearchUrl('brave', searchedDigits)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-amber-400 transition flex items-center gap-1.5"
                  >
                    Brave Search <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
