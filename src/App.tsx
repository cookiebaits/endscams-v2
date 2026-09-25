import { useState } from 'react';
import TrackerPage from './pages/TrackerPage';
import ReportScamPage from './pages/ReportScamPage';

export default function App() {
  const [currentPage, setCurrentPage] = useState<'tracker' | 'report'>('tracker');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500/30 selection:text-amber-200">
      {/* Main Content Area */}
      <main className="flex-1">
        {currentPage === 'tracker' ? (
          <TrackerPage onNavigateToReport={() => setCurrentPage('report')} />
        ) : (
          <div className="py-8">
            <ReportScamPage
              onNavigateToTracker={() => setCurrentPage('tracker')}
              onRecordCreated={() => setCurrentPage('tracker')}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-4 text-center text-xs text-slate-500">
        <p>EndScams Threat Intelligence & Fraud Protection · Continuous Live Shared Persistence</p>
      </footer>
    </div>
  );
}
