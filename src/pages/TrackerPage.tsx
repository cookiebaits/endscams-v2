import { useEffect } from 'react';
import TrackerApp from '../tracker/src/App';

export default function TrackerPage() {
  useEffect(() => {
    document.title = 'Threat Harvester & Scam Tracker | End Scams';
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col pt-2">
      <TrackerApp />
    </div>
  );
}
