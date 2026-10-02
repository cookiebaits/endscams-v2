import React, { useState, useEffect, useRef } from 'react';

export interface CommunityScamDatabaseSearchProps {
  onNavigateToTracker?: (searchQuery?: string) => void;
  onNavigateToReport?: (prefilledPhone?: string) => void;
  onNavigateToHome?: () => void;
}

export default function CommunityScamDatabaseSearch({
  onNavigateToTracker,
  onNavigateToReport,
}: CommunityScamDatabaseSearchProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState<number | string>(1600);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data) return;

      // Handle payload as object or stringified JSON
      let data = event.data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch {
          // Plain string message
        }
      }

      if (typeof data === 'object' && data !== null) {
        const { type, action, height, frameHeight, scrollHeight, contentHeight, query, phone } = data;

        // Auto-adjust height dynamically from embedded search page events
        if (
          type === 'FRAME_HEIGHT' ||
          type === 'RESIZE' ||
          type === 'SET_HEIGHT' ||
          height ||
          frameHeight ||
          scrollHeight ||
          contentHeight
        ) {
          const h = Number(height || frameHeight || scrollHeight || contentHeight);
          if (!isNaN(h) && h > 300) {
            setIframeHeight(Math.max(h, 1600));
          }
        }

        // Handle navigation triggers from search iframe
        if (type === 'NAVIGATE_TRACKER' || action === 'NAVIGATE_TRACKER' || type === 'GOTO_TRACKER') {
          if (onNavigateToTracker) {
            onNavigateToTracker(query || phone);
          }
        } else if (type === 'NAVIGATE_REPORT' || action === 'NAVIGATE_REPORT' || type === 'GOTO_REPORT') {
          if (onNavigateToReport) {
            onNavigateToReport(query || phone);
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [onNavigateToTracker, onNavigateToReport]);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 relative min-h-[1600px] flex flex-col items-center justify-center">
      {isLoading && (
        <div className="absolute inset-0 z-10 bg-slate-950/80 rounded-2xl flex flex-col items-center justify-center space-y-3 text-slate-300 min-h-[1600px]">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-medium">Loading Community Scam Database...</span>
        </div>
      )}

      <iframe
        ref={iframeRef}
        src="https://esscan.ai.studio/?page=search"
        title="Community Scam Database Search"
        onLoad={() => setIsLoading(false)}
        className="w-full border-0 block rounded-2xl shadow-2xl transition-all duration-300"
        style={{
          height: typeof iframeHeight === 'number' ? `${iframeHeight}px` : iframeHeight,
          minHeight: '1600px',
        }}
        scrolling="auto"
      />
    </div>
  );
}
