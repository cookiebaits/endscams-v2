export default function TrackerPage() {
  return (
    <div className="min-h-screen bg-slate-950 pt-[165px] flex flex-col">
      <iframe
        src="https://esscan.ai.studio"
        className="w-full border-0"
        style={{ minHeight: '2000px', height: '100%' }}
        scrolling="no"
        title="End Scam Scan"
        allow="microphone; camera; display-capture; clipboard-read; clipboard-write"
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
      />
    </div>
  );
}
