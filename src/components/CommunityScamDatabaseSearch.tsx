import { useState, useEffect, useRef } from 'react';

export interface CommunityScamDatabaseSearchProps {
  onNavigateToTracker?: (searchQuery?: string) => void;
  onNavigateToReport?: (prefilledPhone?: string) => void;
  onNavigateToHome?: () => void;
}

export default function CommunityScamDatabaseSearch({
  onNavigateToTracker,
  onNavigateToReport,
  onNavigateToHome,
}: CommunityScamDatabaseSearchProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data) return;

      let data = event.data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch {
          // ignore non-JSON strings
        }
      }

      if (typeof data === 'object' && data !== null) {
        const { type, action, payload } = data;

        // Navigation message handlers
        if (type === 'NAVIGATE_TRACKER' || action === 'NAVIGATE_TRACKER') {
          if (onNavigateToTracker) {
            onNavigateToTracker(payload?.searchQuery || payload?.query || payload);
          }
        } else if (type === 'NAVIGATE_REPORT' || action === 'NAVIGATE_REPORT') {
          if (onNavigateToReport) {
            onNavigateToReport(payload?.phone || payload);
          }
        } else if (type === 'NAVIGATE_HOME' || action === 'NAVIGATE_HOME') {
          if (onNavigateToHome) {
            onNavigateToHome();
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [onNavigateToTracker, onNavigateToReport, onNavigateToHome]);

  return (
    <div className="w-full max-w-5xl mx-auto px-2 sm:px-4 flex flex-col items-center justify-center relative min-h-[560px]">
      {isLoading && (
        <div className="absolute inset-0 z-10 bg-slate-900/80 rounded-xl flex flex-col items-center justify-center space-y-3 text-slate-300 backdrop-blur-sm border border-slate-800">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-medium tracking-wide">Loading Community Scam Database...</span>
        </div>
      )}

      <iframe
        ref={iframeRef}
        src="https://esscan.ai.studio/?page=search"
        title="Community Scam Database Search"
        onLoad={() => setIsLoading(false)}
        loading="eager"
        className="w-full border-0 block overflow-hidden"
        style={{
          height: '560px',
          backgroundColor: 'transparent',
        }}
        scrolling="no"
      />
    </div>
  );
}
