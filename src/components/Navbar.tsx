import React from 'react';
import { ShieldAlert, Sparkles, Clock, Calendar } from 'lucide-react';

interface NavbarProps {
  totalRecordsCount: number;
  lastScanTime: string | null;
  nextScheduledRefresh: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  totalRecordsCount: _totalRecordsCount,
  lastScanTime,
  nextScheduledRefresh,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-3">
          {/* Logo & Branding */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-red-600 flex items-center justify-center text-white shadow-lg shadow-red-900/20 shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold tracking-tight text-white">
                  End Scam Scan
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Sparkles className="w-3 h-3 mr-1 text-emerald-400" />
                  Auto-Live
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Automated multi-page Google & BBB Scam Tracker harvester (31-Day Retention)
              </p>
            </div>
          </div>

          {/* Schedule & Retention Information Badges */}
          <div className="flex items-center space-x-3 flex-wrap">
            {lastScanTime && (
              <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Last Scan: <strong className="text-slate-100">{lastScanTime}</strong></span>
              </div>
            )}

            <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Next Refresh: <strong className="text-slate-100">{nextScheduledRefresh}</strong></span>
            </div>

            <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              <span>Retention: <strong className="text-slate-100">31 Days Auto-Purge</strong></span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
