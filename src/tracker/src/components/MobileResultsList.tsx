import React, { useState } from 'react';
import {
  PhoneCall,
  MessageCircle,
  Copy,
  Check,
  ExternalLink,
  X,
  Calendar,
  Building2,
  DollarSign,
  Hash,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  ArrowUpDown,
  Download,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  Share2,
} from 'lucide-react';
import { ScamPhoneRecord, SortField, SortOrder } from '../types';
import { formatPST } from '../utils/dateUtils';

interface MobileResultsListProps {
  records: ScamPhoneRecord[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onToggleNumberDown: (id: string) => void;
  onBulkNumberDown: (ids: string[]) => void;
  sortField: SortField;
  sortOrder: SortOrder;
  onSortChange: (field: SortField) => void;
  onExportCSV: () => void;
  onExportJSON: () => void;
  onExportTXT: () => void;
  onOpenAddModal: () => void;
  onOpenSearchModal: () => void;
}

export const MobileResultsList: React.FC<MobileResultsListProps> = ({
  records,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  onToggleNumberDown,
  onBulkNumberDown,
  sortField,
  sortOrder,
  onSortChange,
  onExportCSV,
  onExportJSON,
  onExportTXT,
  onOpenAddModal,
  onOpenSearchModal,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedRecordIds, setExpandedRecordIds] = useState<Set<string>>(new Set());
  const [showExportMenu, setShowExportMenu] = useState(false);

  const toggleExpand = (id: string) => {
    setExpandedRecordIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCopyText = async (text: string, idKey: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(idKey);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const isWithinLast24Hours = (isoString: string) => {
    const time = new Date(isoString).getTime();
    return !isNaN(time) && Date.now() - time <= 24 * 60 * 60 * 1000;
  };

  return (
    <div className="space-y-3">
      {/* Mobile Toolbar & Quick Sort Controls */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-xl p-3 shadow-md">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-2.5">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-200">
              {records.length} Numbers Found
            </span>
            {selectedIds.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-bold">
                {selectedIds.length} Selected
              </span>
            )}
          </div>

          <div className="flex items-center space-x-1.5">
            {/* Quick Export Menu Button */}
            <div className="relative">
              <button
                id="btn-mobile-export-menu"
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center space-x-1 transition-colors"
                title="Export list"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Export</span>
              </button>

              {showExportMenu && (
                <div className="absolute right-0 mt-1 w-44 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl p-1.5 z-40 space-y-1">
                  <button
                    onClick={() => {
                      onExportCSV();
                      setShowExportMenu(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium text-emerald-300 hover:bg-emerald-500/10 flex items-center space-x-2"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>
                  <button
                    onClick={() => {
                      onExportJSON();
                      setShowExportMenu(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium text-blue-300 hover:bg-blue-500/10 flex items-center space-x-2"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Export JSON</span>
                  </button>
                  <button
                    onClick={() => {
                      onExportTXT();
                      setShowExportMenu(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 flex items-center space-x-2"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export TXT</span>
                  </button>
                </div>
              )}
            </div>

            {/* Select All / Deselect All Toggle */}
            <button
              onClick={selectedIds.length === records.length ? onDeselectAll : onSelectAll}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-medium transition-colors"
            >
              {selectedIds.length === records.length ? 'Deselect' : 'Select All'}
            </button>
          </div>
        </div>

        {/* Mobile Sort Dropdown */}
        <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/80">
          <span className="flex items-center gap-1 font-medium">
            <ArrowUpDown className="w-3 h-3 text-amber-400" /> Sort By:
          </span>
          <div className="flex items-center space-x-2">
            <select
              value={sortField}
              onChange={(e) => onSortChange(e.target.value as SortField)}
              className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-md px-2 py-1 focus:outline-none focus:border-amber-500 font-medium"
            >
              <option value="detectedAt">Date Detected ({sortOrder.toUpperCase()})</option>
              <option value="scamType">Scam Category</option>
              <option value="phone">Phone Number</option>
              <option value="platform">Platform</option>
            </select>
          </div>
        </div>
      </div>

      {/* Floating Sticky Bulk Actions Bar (When items are selected on mobile) */}
      {selectedIds.length > 0 && (
        <div className="sticky top-16 z-20 bg-slate-950/95 backdrop-blur-md border border-amber-500/40 rounded-xl p-3 shadow-2xl flex items-center justify-between animate-fadeIn">
          <div className="text-xs font-bold text-amber-300">
            {selectedIds.length} number{selectedIds.length > 1 ? 's' : ''} selected
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onBulkNumberDown(selectedIds)}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-md active:scale-95 transition-transform"
            >
              <X className="w-3.5 h-3.5 stroke-[3]" />
              <span>Mark Number Down ({selectedIds.length})</span>
            </button>
            <button
              onClick={onDeselectAll}
              className="p-1.5 text-slate-400 hover:text-slate-200"
              title="Cancel selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Mobile Records Card List */}
      {records.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-500 space-y-2">
          <AlertCircle className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-300">No scam records found</p>
          <p className="text-xs text-slate-500">
            Try adjusting search terms, clearing filters, or running a targeted threat search.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((record) => {
            const isSelected = selectedIds.includes(record.id);
            const isExpanded = expandedRecordIds.has(record.id);

            return (
              <div
                key={record.id}
                className={`bg-slate-900 border rounded-2xl p-3.5 shadow-md transition-all ${
                  record.isNumberDown
                    ? 'border-red-900/30 bg-slate-950/70 opacity-90'
                    : isSelected
                    ? 'border-amber-500/50 bg-amber-500/[0.04]'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Card Top Header: Checkbox + Date + Category Tag + Number Down Badge */}
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <div className="flex items-center space-x-2 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect(record.id)}
                      className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-0 shrink-0"
                    />
                    <div className="flex items-center space-x-1.5 text-[11px] font-mono text-slate-400 truncate">
                      <Calendar className="w-3 h-3 text-slate-500 shrink-0" />
                      <span className="truncate">{formatPST(record.detectedAt)}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 shrink-0">
                    {isWithinLast24Hours(record.detectedAt) && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold uppercase tracking-wider">
                        Last 24h
                      </span>
                    )}
                    {record.isNumberDown && (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40 text-[10px] font-bold shadow-sm">
                        <X className="w-2.5 h-2.5 stroke-[3] text-red-400" />
                        <span>Down</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Category & Impersonation Pills */}
                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                      record.scamType.toLowerCase().includes('spell')
                        ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                        : record.scamType.toLowerCase().includes('crypto') ||
                          record.scamType.toLowerCase().includes('btc')
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                        : record.scamType.toLowerCase().includes('bbb') ||
                          record.scamType.toLowerCase().includes('geek') ||
                          record.scamType.toLowerCase().includes('tech')
                        ? 'bg-red-500/10 text-red-300 border-red-500/30'
                        : record.scamType.toLowerCase().includes('guestbook')
                        ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    {record.scamType}
                  </span>

                  {record.impersonatedCompany && record.impersonatedCompany !== 'N/A' && (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-blue-500/15 text-blue-300 border border-blue-500/30 rounded text-[10px] font-semibold">
                      <Building2 className="w-2.5 h-2.5" />
                      <span>{record.impersonatedCompany}</span>
                    </span>
                  )}

                  {record.amountCharged && record.amountCharged !== 'N/A' && (
                    <span className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded text-[10px] font-semibold">
                      <DollarSign className="w-2.5 h-2.5" />
                      <span>{record.amountCharged}</span>
                    </span>
                  )}

                  {record.countryCode && (
                    <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 bg-slate-950 text-slate-400 rounded border border-slate-800">
                      {record.countryCode} {record.countryName ? `(${record.countryName})` : ''}
                    </span>
                  )}
                </div>

                {/* Prominent Monospace Phone Number Display */}
                <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 mb-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-0.5">
                      Target Phone Number
                    </span>
                    <span
                      className={`font-mono text-base sm:text-lg font-bold tracking-tight select-all ${
                        record.isNumberDown
                          ? 'text-slate-400 line-through decoration-red-500/60 decoration-2'
                          : 'text-amber-300'
                      }`}
                    >
                      {record.phone}
                    </span>
                  </div>

                  {/* 1-Tap Fast Actions Row */}
                  <div className="flex items-center space-x-1.5">
                    {/* Copy Button */}
                    <button
                      onClick={(e) => handleCopyText(record.phone, `phone-${record.id}`, e)}
                      className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors active:scale-95"
                      title="Copy phone number"
                    >
                      {copiedId === `phone-${record.id}` ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>

                    {/* WhatsApp Direct Chat Link */}
                    <a
                      href={`https://wa.me/${record.cleanPhone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 rounded-lg border border-emerald-500/30 transition-colors active:scale-95"
                      title="Open WhatsApp Chat"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </a>

                    {/* Direct Dialer Link */}
                    <a
                      href={`tel:${record.cleanPhone || record.phone}`}
                      className="p-2.5 bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 rounded-lg border border-blue-500/30 transition-colors active:scale-95"
                      title="Open Phone Dialer"
                    >
                      <PhoneCall className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                {/* Primary Card Actions: Number Down Button & Expand Details */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                  {/* Number Down Action */}
                  <button
                    onClick={() => onToggleNumberDown(record.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 border transition-all active:scale-95 ${
                      record.isNumberDown
                        ? 'bg-red-950/80 text-red-300 border-red-500/50'
                        : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30'
                    }`}
                  >
                    <X className="w-3.5 h-3.5 text-red-500 stroke-[2.5]" />
                    <span>{record.isNumberDown ? 'Mark Active' : 'Number down'}</span>
                  </button>

                  {/* Expand / View Details Button */}
                  <button
                    onClick={() => toggleExpand(record.id)}
                    className="px-2.5 py-1.5 text-slate-400 hover:text-slate-200 text-xs font-medium flex items-center space-x-1 transition-colors"
                  >
                    <span>{isExpanded ? 'Less' : 'Snippet & Source'}</span>
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {/* Expandable Details Body */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-800 space-y-2.5 text-xs animate-fadeIn">
                    {/* Snippet Context */}
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                        Context Snippet:
                      </span>
                      <p className="italic text-slate-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 text-xs leading-relaxed break-words">
                        "{record.snippet}"
                      </p>
                    </div>

                    {/* Source Link & Copy */}
                    <div className="flex items-center justify-between gap-2 bg-slate-950 p-2 rounded-lg border border-slate-800/80">
                      <div className="flex items-center space-x-2 truncate">
                        <span className="text-[11px] font-semibold text-slate-400 shrink-0">
                          {record.platform}:
                        </span>
                        <a
                          href={record.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-amber-400 hover:underline truncate text-xs inline-flex items-center gap-1"
                        >
                          <span className="truncate">{record.sourceUrl}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </div>

                      <button
                        onClick={(e) => handleCopyText(record.sourceUrl, `url-${record.id}`, e)}
                        className="p-1 text-slate-400 hover:text-slate-200 shrink-0"
                        title="Copy Source URL"
                      >
                        {copiedId === `url-${record.id}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    {/* Invoice ID & Search query if present */}
                    {record.invoiceNumber && record.invoiceNumber !== 'N/A' && (
                      <div className="flex items-center space-x-1.5 text-[11px] text-purple-300">
                        <Hash className="w-3 h-3 text-purple-400" />
                        <span>Invoice: <strong>{record.invoiceNumber}</strong></span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
