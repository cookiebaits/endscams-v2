import React from 'react';
import { ShieldAlert, Sparkles, Clock, Smartphone, Monitor } from 'lucide-react';
import { DeviceModePreference } from '../hooks/useDeviceMode';

interface NavbarProps {
  totalRecordsCount?: number;
  lastScanTime: string | null;
  nextScheduledRefresh: string;
  devicePreference?: DeviceModePreference;
  onSetDevicePreference?: (pref: DeviceModePreference) => void;
  isMobileActive?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  totalRecordsCount: _totalRecordsCount,
  lastScanTime,
  nextScheduledRefresh,
  devicePreference = 'auto',
  onSetDevicePreference,
  isMobileActive = false,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2.5 sm:py-3 gap-2 sm:gap-3">
          {/* Logo & Branding */}
          <div className="flex items-center justify-between sm:justify-start space-x-3">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-500 to-red-600 flex items-center justify-center text-white shadow-lg shadow-red-900/20 shrink-0">
                <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">
                    End Scam Scan
                  </h1>
                  <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1 text-emerald-400" />
                    Auto-Live
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-400 hidden xs:block">
                  Automated threat harvester (7:00 AM & 1:00 PM PST Daily)
                </p>
              </div>
            </div>

            {/* View Mode Switcher on Mobile Header */}
            {onSetDevicePreference && (
              <div className="flex items-center sm:hidden bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-[11px]">
                <button
                  onClick={() => onSetDevicePreference(isMobileActive ? 'desktop' : 'mobile')}
                  className={`px-2 py-1 rounded flex items-center space-x-1 font-semibold transition-colors ${
                    isMobileActive
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Toggle Mobile / Desktop Layout"
                >
                  {isMobileActive ? (
                    <>
                      <Smartphone className="w-3 h-3 text-amber-400" />
                      <span>Mobile</span>
                    </>
                  ) : (
                    <>
                      <Monitor className="w-3 h-3 text-blue-400" />
                      <span>Desktop</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Schedule Badges & Device Mode Switcher (Desktop) */}
          <div className="flex items-center space-x-2 sm:space-x-3 flex-wrap gap-y-1.5">
            {lastScanTime && (
              <div className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1 bg-slate-950 border border-slate-800 rounded-lg text-[11px] sm:text-xs text-slate-300">
                <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" />
                <span>Last: <strong className="text-slate-100">{lastScanTime}</strong></span>
              </div>
            )}

            <div className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1 bg-slate-950 border border-slate-800 rounded-lg text-[11px] sm:text-xs text-slate-300">
              <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400" />
              <span>Next: <strong className="text-slate-100">{nextScheduledRefresh}</strong></span>
            </div>

            {/* Desktop View Mode Toggle */}
            {onSetDevicePreference && (
              <div className="hidden sm:flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs">
                <button
                  onClick={() => onSetDevicePreference('auto')}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                    devicePreference === 'auto'
                      ? 'bg-slate-800 text-amber-300 font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Auto-detect screen / device type"
                >
                  ⚡ Auto
                </button>
                <button
                  onClick={() => onSetDevicePreference('desktop')}
                  className={`px-2 py-1 rounded text-xs font-medium flex items-center space-x-1 transition-colors ${
                    devicePreference === 'desktop'
                      ? 'bg-slate-800 text-blue-300 font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Force Desktop Layout"
                >
                  <Monitor className="w-3 h-3" />
                  <span>Desktop</span>
                </button>
                <button
                  onClick={() => onSetDevicePreference('mobile')}
                  className={`px-2 py-1 rounded text-xs font-medium flex items-center space-x-1 transition-colors ${
                    devicePreference === 'mobile'
                      ? 'bg-slate-800 text-amber-300 font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Force Mobile Layout"
                >
                  <Smartphone className="w-3 h-3" />
                  <span>Mobile</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

