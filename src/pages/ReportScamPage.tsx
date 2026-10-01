import React, { useState, useEffect, useRef } from 'react';

export interface ReportScamPageProps {
  isModal?: boolean;
  onCloseModal?: () => void;
  onNavigateToTracker?: () => void;
}

export const ReportScamPage: React.FC<ReportScamPageProps> = () => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState<number | string>('100vh');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data) return;

      let data = event.data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch {
          // data is non-JSON string
        }
      }

      if (typeof data === 'object' && data !== null) {
        const { type, height, frameHeight, scrollHeight, pageHeight, contentHeight, offsetHeight } = data;
        const h = height || frameHeight || scrollHeight || pageHeight || contentHeight || offsetHeight;

        if (h !== undefined && h !== null) {
          const numH = typeof h === 'string' ? parseFloat(h) : Number(h);
          if (!isNaN(numH) && numH > 300) {
            setIframeHeight(numH);
          }
        }

        if (type === 'LOCK_SCROLL' || type === 'OPEN_MODAL') {
          document.body.style.overflow = 'hidden';
        } else if (type === 'UNLOCK_SCROLL' || type === 'CLOSE_MODAL') {
          document.body.style.overflow = '';
        }
      }
    };

    window.addEventListener('message', handleMessage);

    const scrollInterval = setInterval(() => {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          {
            type: 'PARENT_SCROLL_POSITION',
            scrollTop: window.scrollY,
            windowHeight: window.innerHeight,
          },
          '*'
        );
        iframeRef.current.contentWindow.postMessage({ type: 'GET_HEIGHT' }, '*');
        iframeRef.current.contentWindow.postMessage({ type: 'REQUEST_HEIGHT' }, '*');
      }
    }, 500);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearInterval(scrollInterval);
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div className="w-full min-h-screen bg-slate-950 flex flex-col relative overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 z-10 bg-slate-950/90 flex flex-col items-center justify-center space-y-3 text-slate-300">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-medium font-sans">Loading Report Scam Form...</span>
        </div>
      )}

      <iframe
        ref={iframeRef}
        src="https://esscan.ai.studio/?page=report"
        title="ESSCAN Report Scam"
        onLoad={() => setIsLoading(false)}
        className="w-full border-0 block flex-1"
        style={{
          height: typeof iframeHeight === 'number' ? `${iframeHeight}px` : iframeHeight,
          minHeight: 'calc(100vh - 80px)',
        }}
        scrolling="no"
      />
    </div>
  );
};

export default ReportScamPage;
