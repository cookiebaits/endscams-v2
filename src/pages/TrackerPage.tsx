export default function TrackerPage() {
  return (
    <div className="min-h-screen bg-slate-950 pt-[165px] pb-16 flex flex-col">
      <div className="w-full max-w-7xl mx-auto px-4 flex-1 flex flex-col h-full min-h-[800px]">
        <iframe
          src="https://end-scam-scan-387785600280.us-west1.run.app/"
          className="w-full flex-1 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-xl"
          title="End Scam Scan"
          allow="microphone; camera; display-capture; clipboard-read; clipboard-write"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        />
      </div>
    </div>
  );
}
