import { useState, useEffect } from "react";

export default function TrackerPage() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Hide the main window scrollbar so we only have the iframe's internal scrollbar.
    // This perfectly solves the "two scrollbars" issue without relying on guessing heights.
    document.body.style.overflow = "hidden";

    return () => {
      // Use empty string to let Tailwind/CSS defaults re-apply correctly
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div className="h-screen bg-slate-950 pt-[72px] flex flex-col overflow-hidden">
      {/* We restore overflow-x-auto so the table doesn't compress and become illegible on mobile devices */}
      <div className="w-full flex-1 relative overflow-x-auto overflow-y-hidden">
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950 z-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
          </div>
        )}
        <iframe
          src="https://esscan.ai.studio"
          className="min-w-[1024px] w-full h-full border-0"
          onLoad={() => setIsLoaded(true)}
          title="End Scam Scan"
          allow="microphone; camera; display-capture; clipboard-read; clipboard-write"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        />
      </div>
    </div>
  );
}
