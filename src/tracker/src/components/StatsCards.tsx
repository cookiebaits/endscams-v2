import React from 'react';
import { PhoneCall, ShieldCheck, Globe, AlertTriangle } from 'lucide-react';
import { ScamPhoneRecord } from '../types';

interface StatsCardsProps {
  records: ScamPhoneRecord[];
  isSearching: boolean;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ records }) => {
  const totalNumbers = records.length;
  const downCount = records.filter((r) => r.isNumberDown).length;
  const activeCount = totalNumbers - downCount;
  const uniqueCategories = Array.from(new Set(records.map((r) => r.scamType))).length;
  const platformsCount = Array.from(new Set(records.map((r) => r.platform))).length;
  const countriesCount = Array.from(new Set(records.map((r) => r.countryName || r.countryCode))).length;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-4 sm:mb-6">
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 sm:p-4 flex items-center justify-between shadow-sm">
        <div>
          <p className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider">Total Numbers</p>
          <div className="flex items-baseline space-x-1.5 sm:space-x-2 mt-0.5 sm:mt-1">
            <span className="text-xl sm:text-2xl font-bold text-slate-100">{totalNumbers}</span>
            <span className="text-[10px] sm:text-xs text-slate-400">
              {downCount > 0 ? (
                <span>
                  <strong className="text-emerald-400 font-medium">{activeCount}</strong> · <strong className="text-red-400 font-medium">{downCount}</strong>
                </span>
              ) : (
                'entries'
              )}
            </span>
          </div>
        </div>
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center shrink-0">
          <PhoneCall className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 sm:p-4 flex items-center justify-between shadow-sm">
        <div>
          <p className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider">Scam Types</p>
          <div className="flex items-baseline space-x-1.5 sm:space-x-2 mt-0.5 sm:mt-1">
            <span className="text-xl sm:text-2xl font-bold text-slate-100">{uniqueCategories}</span>
            <span className="text-[10px] sm:text-xs text-slate-500">categories</span>
          </div>
        </div>
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 sm:p-4 flex items-center justify-between shadow-sm">
        <div>
          <p className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider">Platforms</p>
          <div className="flex items-baseline space-x-1.5 sm:space-x-2 mt-0.5 sm:mt-1">
            <span className="text-xl sm:text-2xl font-bold text-slate-100">{platformsCount}</span>
            <span className="text-[10px] sm:text-xs text-slate-500">sources</span>
          </div>
        </div>
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
          <Globe className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 sm:p-4 flex items-center justify-between shadow-sm">
        <div>
          <p className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider">Countries</p>
          <div className="flex items-baseline space-x-1.5 sm:space-x-2 mt-0.5 sm:mt-1">
            <span className="text-xl sm:text-2xl font-bold text-slate-100">{countriesCount}</span>
            <span className="text-[10px] sm:text-xs text-slate-500">regions</span>
          </div>
        </div>
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>
    </div>
  );
};
