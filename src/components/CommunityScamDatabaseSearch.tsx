import { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

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
  const [iframeHeight, setIframeHeight] = useState<number | string>(850);
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
        const { type, height, frameHeight, scrollHeight, action, payload } = data;

        // Dynamic height adjustments sent from embedded app
        if (
          type === 'FRAME_HEIGHT' ||
          type === 'RESIZE' ||
          type === 'SET_HEIGHT' ||
          height ||
          frameHeight ||
          scrollHeight
        ) {
          const rawH = height || frameHeight || scrollHeight;
          if (rawH && typeof rawH === 'number' && rawH > 300) {
            // Ensure height accommodates search boxes and result cards cleanly
            setIframeHeight(Math.max(rawH + 40, 850));
          }
        }

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
    <div className="w-full max-w-6xl mx-auto px-2 sm:px-4 flex flex-col items-center justify-center relative min-h-[850px]">
      {isLoading && (
        <div className="absolute inset-0 z-10 bg-[#070b14]/90 flex flex-col items-center justify-center space-y-3 text-slate-300 min-h-[400px]">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
          <span className="text-sm font-medium text-slate-400">Loading Community Scam Database...</span>
        </div>
      )}

      <iframe
        ref={iframeRef}
        src="https://esscan.ai.studio/?page=search"
        title="Community Scam Database Search"
        onLoad={() => setIsLoading(false)}
        className="w-full border-0 block rounded-2xl shadow-2xl overflow-hidden transition-all duration-300"
        style={{
          height: typeof iframeHeight === 'number' ? `${iframeHeight}px` : iframeHeight,
          minHeight: '850px',
          backgroundColor: 'transparent',
        }}
        scrolling="auto"
      />
    </div>
  );
}
