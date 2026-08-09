export default function TrackerPage() {
  return (
    <div className="min-h-screen bg-slate-950 pt-[165px] flex flex-col">
      <iframe
        src="https://end-scam-scan-387785600280.us-west1.run.app/"
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
