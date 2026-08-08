import React from 'react';
import { PhoneCall, ShieldCheck, Globe, AlertTriangle } from 'lucide-react';
import { ScamPhoneRecord } from '../types';

interface StatsCardsProps {
  records: ScamPhoneRecord[];
  isSearching: boolean;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ records, isSearching: _isSearching }) => {
  const totalNumbers = records.length;
  const uniqueCategories = Array.from(new Set(records.map((r) => r.scamType))).length;
  const platformsCount = Array.from(new Set(records.map((r) => r.platform))).length;
  const countriesCount = Array.from(new Set(records.map((r) => r.countryName || r.countryCode))).length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Numbers</p>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-bold text-slate-100">{totalNumbers}</span>
            <span className="text-xs text-slate-500">entries</span>
          </div>
        </div>
        <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center">
          <PhoneCall className="w-5 h-5" />
        </div>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Scam Types</p>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-bold text-slate-100">{uniqueCategories}</span>
            <span className="text-xs text-slate-500">categories</span>
          </div>
        </div>
        <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
          <AlertTriangle className="w-5 h-5" />
        </div>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Platforms Target</p>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-bold text-slate-100">{platformsCount}</span>
            <span className="text-xs text-slate-500">sources</span>
          </div>
        </div>
        <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
          <Globe className="w-5 h-5" />
        </div>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Countries Detected</p>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-bold text-slate-100">{countriesCount}</span>
            <span className="text-xs text-slate-500">regions</span>
          </div>
        </div>
        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};
