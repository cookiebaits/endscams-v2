import { useState } from "react";

export default function TrackerPage() {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 pt-8 flex flex-col">
      <div className="w-full flex-1 relative h-[calc(100vh-80px)] overflow-hidden">
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950 z-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
          </div>
        )}
        <iframe
          src="https://esscan.ai.studio"
          className="w-full h-full border-0"
          onLoad={() => setIsLoaded(true)}
          title="End Scam Scan"
          allow="microphone; camera; display-capture; clipboard-read; clipboard-write"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        />
      </div>
    </div>
  );
}
