import { useEffect, useState } from "react";

export default function TrackerPage() {
  const [iframeHeight, setIframeHeight] = useState("4500px");

  useEffect(() => {
    async function fetchHeight() {
      try {
        // Fallback or override depending on environment
        const fetcherUrl = import.meta.env.DEV
          ? "http://localhost:8000"
          : (import.meta.env.VITE_FETCHER_URL || "https://fetcher.endscams.org").replace(/\/$/, "");

        // Try to fetch via our backend fetcher to avoid CORS issues
        const res = await fetch(`${fetcherUrl}/api/records`);
        if (!res.ok) throw new Error("Network response was not ok");
        const data = await res.json();

        if (data && typeof data.totalCount === "number") {
          const calculatedHeight = data.totalCount * 150 + 800;
          setIframeHeight(`${calculatedHeight}px`);
        }
      } catch (e) {
        console.error("Failed to fetch tracker data for height calculation", e);
      }
    }
    fetchHeight();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 pt-8 flex flex-col">
      <div className="w-full overflow-x-auto flex-1">
        <iframe
          src="https://esscan.ai.studio"
          className="min-w-[1024px] w-full border-0"
          style={{ minHeight: iframeHeight, height: "100%" }}
          scrolling="no"
          title="End Scam Scan"
          allow="microphone; camera; display-capture; clipboard-read; clipboard-write"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        />
      </div>
    </div>
  );
}
