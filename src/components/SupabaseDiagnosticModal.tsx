import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Shield,
  Key,
  X,
  Sparkles,
} from 'lucide-react';
import {
  getStoredSupabaseConfig,
  saveSupabaseConfig,
  getSupabaseClient,
  fetchFromSupabase,
  upsertToSupabase,
} from '../lib/supabase';
import { ThreatRecord } from '../types';

export interface SupabaseDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  localRecords: ThreatRecord[];
  onSyncComplete?: (records: ThreatRecord[]) => void;
}

export const SupabaseDiagnosticModal: React.FC<SupabaseDiagnosticModalProps> = ({
  isOpen,
  onClose,
  localRecords,
  onSyncComplete,
}) => {
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    tested: boolean;
    connected: boolean;
    readOk: boolean;
    writeOk: boolean;
    table: string | null;
    count: number;
    error: string | null;
    isRlsError: boolean;
  } | null>(null);

  const [copiedSql, setCopiedSql] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const cfg = getStoredSupabaseConfig();
      setSupabaseUrl(cfg.url);
      setSupabaseKey(cfg.key);
      runDiagnostics(cfg.url, cfg.key);
    }
  }, [isOpen]);

  const runDiagnostics = async (urlToUse?: string, keyToUse?: string) => {
    const url = (urlToUse ?? supabaseUrl).trim();
    const key = (keyToUse ?? supabaseKey).trim();

    if (!url || !key) {
      setTestResult({
        tested: true,
        connected: false,
        readOk: false,
        writeOk: false,
        table: null,
        count: 0,
        error: 'Supabase URL and Public Anon Key must be provided.',
        isRlsError: false,
      });
      return;
    }

    setIsTesting(true);

    try {
      // Temporarily save config to test
      saveSupabaseConfig(url, key);
      const client = getSupabaseClient();
      if (!client) {
        setTestResult({
          tested: true,
          connected: false,
          readOk: false,
          writeOk: false,
          table: null,
          count: 0,
          error: 'Could not initialize Supabase client with given URL/Key.',
          isRlsError: false,
        });
        setIsTesting(false);
        return;
      }

      // 1. Test Read from tracker_entries
      let tableFound: string | null = null;
      let readOk = false;
      let count = 0;
      let isRlsError = false;
      let errorMsg: string | null = null;

      const { data: trackerData, error: trackerError } = await client
        .from('tracker_entries')
        .select('*', { count: 'exact', head: false })
        .limit(5);

      if (!trackerError) {
        tableFound = 'tracker_entries';
        readOk = true;
        count = trackerData ? trackerData.length : 0;
      } else {
        if (trackerError.code === '42501' || trackerError.message.includes('row-level security')) {
          isRlsError = true;
          errorMsg = `RLS Policy Error on tracker_entries: ${trackerError.message}`;
        }

        // Try scam_records
        const { data: scamData, error: scamError } = await client
          .from('scam_records')
          .select('*', { count: 'exact', head: false })
          .limit(5);

        if (!scamError) {
          tableFound = 'scam_records';
          readOk = true;
          count = scamData ? scamData.length : 0;
          isRlsError = false;
        } else {
          errorMsg = errorMsg || scamError.message;
          if (scamError.code === '42501' || scamError.message.includes('row-level security')) {
            isRlsError = true;
          }
        }
      }

      // 2. Test Write capability
      let writeOk = false;
      if (tableFound && readOk) {
        const testId = `test-ping-${Date.now()}`;
        const testRow = {
          id: testId,
          phone_number: '1 (800) 000-0000',
          phone_digits: `ping${Date.now()}`,
          category: 'Diagnostic Ping',
          description: 'Self-deleting test row',
        };

        const { error: insertErr } = await client.from(tableFound).insert([testRow]);
        if (!insertErr) {
          writeOk = true;
          // Delete test row immediately
          await client.from(tableFound).delete().eq('id', testId);
        } else {
          if (insertErr.code === '42501' || insertErr.message.includes('row-level security')) {
            isRlsError = true;
            errorMsg = `Write blocked by RLS: ${insertErr.message}`;
          }
        }
      }

      setTestResult({
        tested: true,
        connected: Boolean(tableFound || readOk),
        readOk,
        writeOk,
        table: tableFound,
        count,
        error: errorMsg,
        isRlsError,
      });
    } catch (err: any) {
      setTestResult({
        tested: true,
        connected: false,
        readOk: false,
        writeOk: false,
        table: null,
        count: 0,
        error: err.message || 'Network error communicating with Supabase',
        isRlsError: false,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveAndSync = async () => {
    saveSupabaseConfig(supabaseUrl, supabaseKey);
    setIsSyncing(true);
    setSyncStatus('Pushing records to Supabase tables...');

    try {
      // 1. Push local records to Supabase
      if (localRecords.length > 0) {
        const res = await upsertToSupabase(localRecords);
        if (!res.success) {
          setSyncStatus(`Notice: ${res.error || 'Failed to push'}`);
        } else {
          setSyncStatus(`Successfully pushed ${res.count || localRecords.length} records to Supabase!`);
        }
      }

      // 2. Fetch fresh records from Supabase to reconcile
      const pullRes = await fetchFromSupabase();
      if (pullRes.success && pullRes.records && pullRes.records.length > 0) {
        if (onSyncComplete) {
          onSyncComplete(pullRes.records);
        }
      }

      runDiagnostics();
    } catch (err: any) {
      setSyncStatus(`Sync error: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const sqlSetupScript = `-- ==============================================================
-- ENDSCAMS SUPABASE SETUP & RLS FIX SCRIPT
-- Paste and Run in Supabase Dashboard -> SQL Editor
-- ==============================================================

-- 1. Create tracker_entries table
CREATE TABLE IF NOT EXISTS public.tracker_entries (
  id TEXT PRIMARY KEY,
  phone_number TEXT NOT NULL,
  phone_digits TEXT NOT NULL UNIQUE,
  country_code TEXT DEFAULT 'US',
  country_name TEXT DEFAULT 'United States',
  scam_type TEXT DEFAULT 'General Tech Support & Refund Scams',
  category TEXT DEFAULT 'General Tech Support & Refund Scams',
  impersonated_company TEXT DEFAULT 'N/A',
  invoice_number TEXT DEFAULT 'N/A',
  amount_charged TEXT DEFAULT 'N/A',
  source_platform TEXT DEFAULT 'Tech Support United',
  source_name TEXT DEFAULT 'Tech Support United',
  source_url TEXT DEFAULT '',
  source_domain TEXT DEFAULT '',
  threat_intel TEXT DEFAULT '',
  description TEXT DEFAULT '',
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  report_date TEXT DEFAULT '',
  post_date TEXT DEFAULT '',
  is_down BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'Active',
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create fast indexes
CREATE INDEX IF NOT EXISTS idx_tracker_entries_phone_digits ON public.tracker_entries (phone_digits);
CREATE INDEX IF NOT EXISTS idx_tracker_entries_detected_at ON public.tracker_entries (detected_at DESC);

-- 2. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.tracker_entries ENABLE ROW LEVEL SECURITY;

-- 3. PERMISSIVE POLICIES FOR SHARED THREAT SHARING
-- CRITICAL FIX FOR INCOGNITO WINDOWS: Allows anonymous and authenticated
-- visitors to read and submit scam numbers without being blocked!

DROP POLICY IF EXISTS "Allow public read tracker_entries" ON public.tracker_entries;
CREATE POLICY "Allow public read tracker_entries" 
  ON public.tracker_entries 
  FOR SELECT 
  TO anon, authenticated 
  USING (true);

DROP POLICY IF EXISTS "Allow public insert tracker_entries" ON public.tracker_entries;
CREATE POLICY "Allow public insert tracker_entries" 
  ON public.tracker_entries 
  FOR INSERT 
  TO anon, authenticated 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update tracker_entries" ON public.tracker_entries;
CREATE POLICY "Allow public update tracker_entries" 
  ON public.tracker_entries 
  FOR UPDATE 
  TO anon, authenticated 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public delete tracker_entries" ON public.tracker_entries;
CREATE POLICY "Allow public delete tracker_entries" 
  ON public.tracker_entries 
  FOR DELETE 
  TO anon, authenticated 
  USING (true);

-- Safe, idempotent Supabase Realtime publication setup
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'tracker_entries'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tracker_entries;
  END IF;
END $$;
`;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl p-6 relative my-8 space-y-5">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">
              Table Settings & Database Connection
            </h2>
            <p className="text-xs text-slate-400">
              Manage database settings, table schema diagnostics, and real-time data persistence.
            </p>
          </div>
        </div>

        {/* Diagnostic Status Alert */}
        {testResult && (
          <div
            className={`p-4 rounded-xl border text-xs space-y-2 ${
              testResult.connected && testResult.readOk && testResult.writeOk
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : testResult.isRlsError
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}
          >
            <div className="flex items-center justify-between font-semibold">
              <span className="flex items-center space-x-2">
                {testResult.connected && testResult.readOk && testResult.writeOk ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                )}
                <span>
                  {testResult.connected && testResult.readOk && testResult.writeOk
                    ? `Fully Connected to table "${testResult.table}"`
                    : testResult.isRlsError
                    ? 'RLS Policy Blocking Detected (Fix Required in Supabase)'
                    : 'Supabase Connection Inactive / Not Configured'}
                </span>
              </span>
              <button
                type="button"
                onClick={() => runDiagnostics()}
                disabled={isTesting}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-mono transition cursor-pointer flex items-center space-x-1"
              >
                <RefreshCw className={`w-3 h-3 ${isTesting ? 'animate-spin' : ''}`} />
                <span>Re-Test</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
              <div className="bg-slate-950/60 p-2 rounded-lg">
                <span className="text-slate-400 block text-[10px]">Read (SELECT)</span>
                <span className={testResult.readOk ? 'text-emerald-400' : 'text-red-400'}>
                  {testResult.readOk ? 'ALLOWED' : 'BLOCKED'}
                </span>
              </div>
              <div className="bg-slate-950/60 p-2 rounded-lg">
                <span className="text-slate-400 block text-[10px]">Write (INSERT)</span>
                <span className={testResult.writeOk ? 'text-emerald-400' : 'text-red-400'}>
                  {testResult.writeOk ? 'ALLOWED' : 'BLOCKED'}
                </span>
              </div>
              <div className="bg-slate-950/60 p-2 rounded-lg">
                <span className="text-slate-400 block text-[10px]">Rows Detected</span>
                <span className="text-slate-200">{testResult.count}</span>
              </div>
            </div>

            {testResult.error && (
              <p className="text-[11px] text-amber-300 font-mono pt-1">
                Notice: {testResult.error}
              </p>
            )}
          </div>
        )}

        {/* Credentials Form */}
        <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-200 flex items-center space-x-1.5">
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span>Supabase Connection Settings</span>
            </span>
            <span className="text-[10px] text-slate-400">Saved securely in browser session</span>
          </div>

          <div className="space-y-2">
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Supabase Project URL
              </label>
              <input
                type="text"
                placeholder="https://xyzcompany.supabase.co"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 font-mono text-xs focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Public Anon Key
              </label>
              <input
                type="password"
                placeholder="eyJhbGciOi..."
                value={supabaseKey}
                onChange={(e) => setSupabaseKey(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 font-mono text-xs focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              disabled={isTesting}
              onClick={() => runDiagnostics()}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5"
            >
              <RefreshCw className={`w-3 h-3 ${isTesting ? 'animate-spin' : ''}`} />
              <span>Test Connection</span>
            </button>

            <button
              type="button"
              disabled={isSyncing || !supabaseUrl || !supabaseKey}
              onClick={handleSaveAndSync}
              className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs transition shadow cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Syncing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3" />
                  <span>Save & Push All Numbers</span>
                </>
              )}
            </button>
          </div>

          {syncStatus && (
            <p className="text-[11px] text-emerald-400 font-mono">{syncStatus}</p>
          )}
        </div>

        {/* RLS Policy Fixer & SQL Generator */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <Shield className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs font-bold text-slate-200">
                Fix RLS Policy For Shared Incognito Access
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(sqlSetupScript);
                setCopiedSql(true);
                setTimeout(() => setCopiedSql(false), 2500);
              }}
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
            >
              {copiedSql ? (
                <>
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Copied SQL!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy SQL Script</span>
                </>
              )}
            </button>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            By default, Supabase Row-Level Security (RLS) blocks anon visitors (including your incognito test windows) from reading or adding numbers. Run this SQL in your Supabase Dashboard SQL Editor to allow public read & write.
          </p>

          <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-[10px] font-mono text-slate-300 max-h-36 overflow-y-auto select-all">
            {sqlSetupScript}
          </pre>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SupabaseDiagnosticModal;
