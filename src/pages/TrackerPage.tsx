export default function TrackerPage() {
  return (
    <div className="min-h-screen bg-slate-950 pt-8 flex flex-col">
      <iframe
        src="https://esscan.ai.studio"
        className="w-full border-0"
        style={{ minHeight: "4500px", height: "100%" }}

        title="End Scam Scan"
        allow="microphone; camera; display-capture; clipboard-read; clipboard-write"
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
      />
    </div>
  );
}
