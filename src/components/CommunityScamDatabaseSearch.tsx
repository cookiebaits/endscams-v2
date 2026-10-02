import { useEffect, useRef } from 'react';

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
    <div className="w-full max-w-5xl mx-auto px-2 sm:px-4 flex flex-col items-center justify-center relative">
      <iframe
        ref={iframeRef}
        src="https://esscan.ai.studio/?page=search"
        title="Community Scam Database Search"
        className="w-full border-0 block overflow-hidden"
        style={{
          height: '710px',
          backgroundColor: 'transparent',
        }}
        scrolling="no"
      />
    </div>
  );
}
