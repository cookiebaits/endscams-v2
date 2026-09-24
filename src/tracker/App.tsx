import React, { useState, useEffect } from 'react';
import { TrackerPage } from './components/TrackerPage';
import ReportScamPage from './pages/ReportScamPage';

export default function App() {
  const [currentView, setCurrentView] = useState<'tracker' | 'report'>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname.toLowerCase();
      const h = window.location.hash.toLowerCase();
      const s = window.location.search.toLowerCase();
      if (p === '/report' || p.startsWith('/report/') || h === '#report' || s.includes('page=report')) {
        return 'report';
      }
    }
    return 'tracker';
  });

  useEffect(() => {
    const handlePopState = () => {
      const p = window.location.pathname.toLowerCase();
      const h = window.location.hash.toLowerCase();
      const s = window.location.search.toLowerCase();
      if (p === '/report' || p.startsWith('/report/') || h === '#report' || s.includes('page=report')) {
        setCurrentView('report');
      } else {
        setCurrentView('tracker');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (view: 'tracker' | 'report') => {
    setCurrentView(view);
    if (typeof window !== 'undefined') {
      const targetUrl = view === 'report' ? '/report' : '/';
      if (window.location.pathname !== targetUrl) {
        window.history.pushState({}, '', targetUrl);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950 flex flex-col">
      {/* Main Content Area */}
      <main className="flex-1 w-full">
        {currentView === 'report' ? (
          <ReportScamPage onNavigateToTracker={() => navigateTo('tracker')} />
        ) : (
          <TrackerPage onNavigateToReport={() => navigateTo('report')} />
        )}
      </main>

      {/* Clean Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-3.5 text-center text-xs text-slate-500 mt-auto">
        <p className="flex items-center justify-center space-x-2 flex-wrap px-3">
          <span>End Scam Scan &bull; CWN Scam Tracker &bull; Auto Refreshes @ 7:00 AM &amp; 1:00 PM PST &bull; 90-Day Auto-Retention</span>
        </p>
      </footer>
    </div>
  );
}

