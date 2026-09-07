import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { supabase } from '../lib/supabaseClient';
import { RefreshCw, ExternalLink, Shield, AlertTriangle, Phone, Calendar, Download, Database, CheckCircle2 } from 'lucide-react';

// Live Harvester Hosted URL (fallback to environment variable if present)
const HARVESTER_URL = 
  process.env.NEXT_PUBLIC_TRACKER_IFRAME_URL || 
  'https://ais-pre-6bcbw5dahy2mjkuwgvvzlq-451738151228.us-west2.run.app';

export default function TrackerPage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [frameHeight, setFrameHeight] = useState('850px');
  const [retainedCount, setRetainedCount] = useState<number | null>(null);
  const [lastSyncStatus, setLastSyncStatus] = useState<string>('Connecting to threat harvester...');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 1. Dynamic Responsive Iframe Height Adjustment
  useEffect(() => {
    const updateHeight = () => {
      const nav = document.querySelector('nav');
      const footer = document.querySelector('footer');

      const navH = nav ? nav.offsetHeight : 70;
      const footH = footer ? footer.offsetHeight : 120;
      const windowH = window.innerHeight;
      let topOffset = containerRef.current ? containerRef.current.getBoundingClientRect().top : navH;

      if (topOffset <= 0) topOffset = navH + 20;
      const targetHeight = windowH - topOffset - footH + 40;

      if (targetHeight > 650) {
        setFrameHeight(`${targetHeight}px`);
      } else {
        setFrameHeight('750px');
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // 2. Fetch existing retained count from Supabase on mount
  useEffect(() => {
    const fetchExistingCount = async () => {
      try {
        const { count, error } = await supabase
          .from('tracker_entries')
          .select('*', { count: 'exact', head: true });
        if (!error && count !== null) {
          setRetainedCount(count);
          setLastSyncStatus(`Database loaded (${count} retained entries in Postgres)`);
        }
      } catch (err) {
        console.warn('[TrackerSync] Unable to read initial count:', err);
      }
    };
    fetchExistingCount();
  }, []);

  // 3. Retain records directly to Supabase Postgres (60-Day Expiry)
  const retainRecordsToPostgres = async (records: any[]) => {
    if (!records || !Array.isArray(records) || records.length === 0) return;

    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 60);

      const entriesToUpsert = records.map((r: any) => {
        const rawPhone = r.phone_digits || r.cleanPhone || r.phone || r.phoneNumber || '';
        const digits = String(rawPhone).replace(/\D/g, '');
        if (!digits) return null;

        const reportDate = r.report_date || r.incident_date || r.date || r.postDate || new Date().toISOString().split('T')[0];

        return {
          phone_number: r.phone_number || r.phone || digits,
          phone_digits: digits,
          source_name: r.source_name || r.platform || r.source || 'Tech Support United',
          source_url: r.source_url || r.sourceUrl || r.url || 'https://endscams.org/tracker',
          report_date: reportDate,
          category: r.category || r.scamType || 'Tech Support Scam',
          description: r.description || r.detailedSummary || r.notes || r.snippet || '',
          expires_at: expiresAt.toISOString(),
        };
      }).filter(Boolean);

      if (entriesToUpsert.length > 0) {
        // Upsert in batches of 50 to avoid request size limitations
        let totalUpserted = 0;
        for (let i = 0; i < entriesToUpsert.length; i += 50) {
          const chunk = entriesToUpsert.slice(i, i + 50);
          const { error } = await supabase
            .from('tracker_entries')
            .upsert(chunk, { onConflict: 'phone_digits,source_name' });
          if (error) {
            console.warn('[TrackerSync] Upsert batch warning:', error);
          } else {
            totalUpserted += chunk.length;
          }
        }

        setRetainedCount((prev) => (prev ? Math.max(prev, entriesToUpsert.length) : entriesToUpsert.length));
        setLastSyncStatus(`Retained ${entriesToUpsert.length} threat records to Postgres`);
      }
    } catch (e) {
      console.warn('[TrackerSync] Error retaining records in Postgres:', e);
      setLastSyncStatus('Postgres upsert fallback active');
    }
  };

  // 4. Send existing user-reported scams to the embedded Harvester
  const syncUserReportsToIframe = async () => {
    if (!iframeRef.current || !iframeRef.current.contentWindow) return;

    try {
      const { data: userReports, error } = await supabase
        .from('user_reported_scams')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(150);

      if (!error && Array.isArray(userReports) && userReports.length > 0) {
        for (const report of userReports) {
          iframeRef.current.contentWindow.postMessage({
            type: 'ADD_RECORD',
            event: 'ADD_RECORD',
            action: 'ADD_RECORD',
            payload: {
              phone: report.phone_number || report.phone,
              phone_digits: (report.phone_number || '').replace(/\D/g, ''),
              scamType: report.category || 'User Reported Scam',
              category: report.category,
              platform: report.source_name || 'Community Report',
              source_name: report.source_name || 'Community Report',
              sourceUrl: report.source_url || '/tracker',
              snippet: report.description || 'User submitted report',
              description: report.description,
              report_date: report.report_date || report.created_at?.slice(0, 10),
            },
          }, '*');
        }
      }
    } catch (err) {
      console.warn('[TrackerSync] Error pushing user reports to iframe:', err);
    }
  };

  // 5. Cross-Window Message Listener
  useEffect(() => {
    const handleWindowMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      const eventType = data.event || data.type || data.action;

      if (
        eventType === 'TRACKER_RECORDS_UPDATED' || 
        eventType === 'SYNC_RECORDS' || 
        eventType === 'SYNC_DATA'
      ) {
        const records = data.records || data.payload?.records || data.data;
        if (Array.isArray(records)) {
          retainRecordsToPostgres(records);
        }
      }
    };

    window.addEventListener('message', handleWindowMessage);
    return () => window.removeEventListener('message', handleWindowMessage);
  }, []);

  const handleIframeLoad = () => {
    setIsLoaded(true);
    setLastSyncStatus('Harvester connected. Performing two-way sync...');
    setTimeout(syncUserReportsToIframe, 600);
    setTimeout(syncUserReportsToIframe, 1800);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Head>
        <title>Threat Harvester & Scam Tracker | End Scams</title>
        <meta name="description" content="Live automated scam phone threat harvester and 60-day retained intelligence database." />
      </Head>

      {/* Embedded Harvester Container */}
      <main ref={containerRef} className="flex-1 w-full max-w-7xl mx-auto px-2 sm:px-4 py-3 flex flex-col">
        {/* Top Integration Status Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-300">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-slate-200">Supabase Postgres Bridge:</span>
            <span className="text-slate-400">{lastSyncStatus}</span>
          </div>
          {retainedCount !== null && (
            <div className="flex items-center space-x-1 bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800 text-amber-400 font-mono text-[11px]">
              <Database className="w-3 h-3 text-amber-400" />
              <span>{retainedCount.toLocaleString()} Entries in Postgres</span>
            </div>
          )}
        </div>

        {/* The Live Harvester Iframe with Full Sandbox Permissions */}
        <div className="w-full flex-1 rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl relative">
          {!isLoaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm z-10 text-slate-400 space-y-3">
              <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
              <p className="text-sm font-medium">Connecting to threat harvester bridge...</p>
            </div>
          )}

          <iframe
            ref={iframeRef}
            src={`${HARVESTER_URL}?auto=false`}
            className="w-full h-full border-0"
            style={{ minHeight: frameHeight }}
            onLoad={handleIframeLoad}
            title="End Scam Threat Harvester"
            allow="microphone; camera; display-capture; clipboard-read; clipboard-write"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-downloads allow-modals"
          />
        </div>
      </main>
    </div>
  );
}
