export default function TrackerPage() {
  return (
    <div className="min-h-screen bg-slate-950 pt-8 flex flex-col">
      <div className="w-full overflow-x-auto flex-1">
        <iframe
          src="https://esscan.ai.studio"
          className="min-w-[1024px] w-full border-0"
          style={{ minHeight: "15000px", height: "100%" }}
          scrolling="no"
          title="End Scam Scan"
          allow="microphone; camera; display-capture; clipboard-read; clipboard-write"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        />
      </div>
    </div>
  );
}
