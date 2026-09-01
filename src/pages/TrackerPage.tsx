import { useState, useEffect, useRef } from "react";
import { supabase, formatPhoneDisplay } from "../lib/supabase";

export default function TrackerPage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [frameHeight, setFrameHeight] = useState("700px");

  // Function to sync user-reported scams to the iframe
  const syncUserReportsToIframe = () => {
    if (!iframeRef.current?.contentWindow) return;

    try {
      const userReportsRaw = localStorage.getItem('user_reported_scams') || '[]';
      const userReports = JSON.parse(userReportsRaw);
      if (Array.isArray(userReports)) {
        for (const report of userReports) {
          iframeRef.current.contentWindow.postMessage({
            type: 'ADD_RECORD',
            event: 'ADD_RECORD',
            action: 'ADD_RECORD',
            payload: { record: report, ...report },
            record: report,
          }, '*');
        }
      }
    } catch (e) {
      console.warn('[TrackerSync] Error syncing user reports:', e);
    }
  };

  // Function to retain records from iframe into Postgres database
  const retainRecordsToPostgres = async (records: any[]) => {
    if (!Array.isArray(records) || records.length === 0) return;

    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 31);

      const entriesToUpsert = records.map((r: any) => {
        const rawPhone = r.phone_digits || r.phone || r.phoneNumber || '';
        const digits = rawPhone.replace(/\D/g, '');
        if (!digits) return null;

        return {
          phone_number: r.phone || formatPhoneDisplay(digits),
          phone_digits: digits,
          source_name: r.source_name || r.source || 'Scam Tracker',
          source_url: r.source_url || r.url || '/tracker',
          report_date: r.report_date || r.incident_date || r.date || new Date().toISOString().split('T')[0],
          category: r.category || 'Scam',
          description: r.description || r.notes || '',
          expires_at: expiresAt.toISOString(),
        };
      }).filter(Boolean);

      if (entriesToUpsert.length > 0) {
        // Upsert in batches of 50
        for (let i = 0; i < entriesToUpsert.length; i += 50) {
          const chunk = entriesToUpsert.slice(i, i + 50);
          await supabase.from('tracker_entries').upsert(chunk, { onConflict: 'phone_digits,source_name' });
        }
      }
    } catch (e) {
      console.warn('[TrackerSync] Error retaining records in Postgres:', e);
    }
  };

  useEffect(() => {
    const updateHeight = () => {
      const nav = document.querySelector('nav');
      const footer = document.querySelector('footer');

      const navH = nav ? nav.offsetHeight : 80;
      const footH = footer ? footer.offsetHeight : 150;
      const windowH = window.innerHeight;
      let topOffset = containerRef.current ? containerRef.current.getBoundingClientRect().top : navH;

      if (topOffset <= 0) topOffset = navH + 40;

      const targetHeight = windowH - topOffset - footH + 50;

      if (targetHeight > 300) {
        setFrameHeight(`${targetHeight}px`);
      } else {
        setFrameHeight("600px");
      }
    };

    setTimeout(updateHeight, 100);
    window.addEventListener("resize", updateHeight);

    // Listen for postMessage from iframe
    const handleWindowMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      const eventType = data.event || data.type || data.action;

      if (eventType === 'TRACKER_RECORDS_UPDATED' || eventType === 'SYNC_RECORDS' || eventType === 'SYNC_DATA') {
        const records = data.records || data.payload?.records || data.data;
        if (Array.isArray(records)) {
          retainRecordsToPostgres(records);
        }
      }
    };

    window.addEventListener('message', handleWindowMessage);

    // Listen on BroadcastChannel for real-time user reports
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('end_scam_scan_sync_channel');
      bc.onmessage = (ev) => {
        const data = ev.data;
        if (data && (data.type === 'ADD_RECORD' || data.event === 'ADD_RECORD')) {
          const rec = data.payload?.record || data.record;
          if (rec && iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage({
              type: 'ADD_RECORD',
              payload: { record: rec },
              record: rec,
            }, '*');
          }
        }
      };
    } catch (e) {
      console.warn('[TrackerSync] BroadcastChannel init error:', e);
    }

    return () => {
      window.removeEventListener("resize", updateHeight);
      window.removeEventListener('message', handleWindowMessage);
      if (bc) bc.close();
    };
  }, []);

  const handleIframeLoad = () => {
    setIsLoaded(true);
    // Send user reports to iframe upon load
    setTimeout(syncUserReportsToIframe, 500);
    setTimeout(syncUserReportsToIframe, 1500);
  };

  return (
    <div ref={containerRef} className="bg-slate-950 flex flex-col w-full">
      <div className="w-full relative overflow-x-auto" style={{ minHeight: frameHeight }}>
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950 z-10 min-h-[400px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
          </div>
        )}
        <iframe
          ref={iframeRef}
          src="https://esscan.ai.studio?auto=false"
          className="min-w-[1024px] w-full h-full border-0"
          style={{ height: frameHeight }}
          onLoad={handleIframeLoad}
          title="End Scam Scan"
          allow="microphone; camera; display-capture; clipboard-read; clipboard-write"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        />
      </div>
    </div>
  );
}
