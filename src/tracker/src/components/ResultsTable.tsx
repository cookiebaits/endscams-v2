import React, { useState, useMemo } from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Copy,
  Check,
  ExternalLink,
  MessageCircle,
  Download,
  Upload,
  X,
  XCircle,
  Plus,
  Search,
  Filter,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  PhoneCall,
  Calendar,
  Camera,
  Building2,
  DollarSign,
  Hash,
  Info,
  Sparkles,
  Smartphone,
  Monitor,
  Gift,
} from 'lucide-react';
import { ScamPhoneRecord, SortField, SortOrder, TableFilterState } from '../types';
import { formatPST, getPSTDateStamp } from '../utils/dateUtils';
import { exportRecordsToCSV } from '../utils/csvHandler';
import { isPrizeOrExtendedRetentionRecord, getRecordRetentionLabel } from '../utils/retentionUtils';
import { ScamSummaryHoverCard } from './ScamSummaryHoverCard';
import { ScreenshotExtractorModal } from './ScreenshotExtractorModal';
import { MobileResultsList } from './MobileResultsList';
import { ImportCsvModal } from './ImportCsvModal';
import { ManualAddModal } from './ManualAddModal';

interface ResultsTableProps {
  records: ScamPhoneRecord[];
  onToggleNumberDown?: (id: string) => void;
  onMarkNumberDownSelected?: (ids: string[]) => void;
  onDeleteRecord?: (id: string) => void;
  onDeleteSelected?: (ids: string[]) => void;
  onAddManualRecord: (record: Omit<ScamPhoneRecord, 'id' | 'detectedAt'>) => void;
  onThreatSearchSuccess?: (summary: string) => void;
  onReloadRecords?: () => void;
  isSearching: boolean;
  isMobileActive?: boolean;
}

export const ResultsTable: React.FC<ResultsTableProps> = ({
  records,
  onToggleNumberDown,
  onMarkNumberDownSelected,
  onDeleteRecord,
  onDeleteSelected,
  onAddManualRecord,
  onThreatSearchSuccess,
  onReloadRecords,
  isSearching,
  isMobileActive = false,
}) => {
  const handleToggleRecordDown = (id: string) => {
    if (onToggleNumberDown) {
      onToggleNumberDown(id);
    } else if (onDeleteRecord) {
      onDeleteRecord(id);
    }
  };

  const handleBulkNumberDown = (ids: string[]) => {
    if (onMarkNumberDownSelected) {
      onMarkNumberDownSelected(ids);
    } else if (onDeleteSelected) {
      onDeleteSelected(ids);
    }
  };

  // Table sorting state
  const [sortField, setSortField] = useState<SortField>('detectedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Filtering state
  const [filters, setFilters] = useState<TableFilterState & { statusFilter?: string; dateFilter?: string }>({
    searchTerm: '',
    categoryFilter: 'ALL',
    platformFilter: 'ALL',
    countryFilter: 'ALL',
    statusFilter: 'ALL',
    dateFilter: 'ALL',
  });

  // Copy feedback state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Screenshot Extractor Modal state
  const [showScreenshotModal, setShowScreenshotModal] = useState(false);

  // Manual Add Modal state
  const [showAddModal, setShowAddModal] = useState(false);

  // Import CSV Modal state
  const [showImportCsvModal, setShowImportCsvModal] = useState(false);

  // Targeted Threat Search Modal state
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQueryInput, setSearchQueryInput] = useState('');
  const [searchCategoryInput, setSearchCategoryInput] = useState('Tech Support & Refund Scam');
  const [isExecutingSearch, setIsExecutingSearch] = useState(false);
  const [searchFeedback, setSearchFeedback] = useState<string | null>(null);

  // Unique dropdown values
  const categoriesList = useMemo(() => {
    return Array.from(new Set(records.map((r) => r.scamType)));
  }, [records]);

  const platformsList = useMemo(() => {
    return Array.from(new Set(records.map((r) => r.platform)));
  }, [records]);

  const countriesList = useMemo(() => {
    return Array.from(new Set(records.map((r) => r.countryName || r.countryCode).filter(Boolean)));
  }, [records]);

  const datesList = useMemo(() => {
    const dates = new Set<string>();
    records.forEach((r) => {
      if (r.detectedAt) {
        dates.add(r.detectedAt.slice(0, 10));
      }
    });
    return Array.from(dates).sort().reverse();
  }, [records]);

  // Handle header sorting click
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc'); // Default to desc for dates
    }
  };

  // Helper to format date nicely in Pacific Time (PST)
  const formatDate = (isoString: string) => {
    return formatPST(isoString);
  };

  // Filter and sort records
  const processedRecords = useMemo(() => {
    const now = Date.now();
    return records
      .filter((record) => {
        // Text Search
        if (filters.searchTerm) {
          const term = filters.searchTerm.toLowerCase();
          const matchPhone = record.phone.toLowerCase().includes(term);
          const matchScam = record.scamType.toLowerCase().includes(term);
          const matchUrl = record.sourceUrl.toLowerCase().includes(term);
          const matchSnippet = record.snippet.toLowerCase().includes(term);
          const matchPlatform = record.platform.toLowerCase().includes(term);
          const matchDate = formatDate(record.detectedAt).toLowerCase().includes(term);
          if (!matchPhone && !matchScam && !matchUrl && !matchSnippet && !matchPlatform && !matchDate) {
            return false;
          }
        }
        // Date Filter
        if (filters.dateFilter && filters.dateFilter !== 'ALL') {
          const recTime = new Date(record.detectedAt).getTime() || 0;
          const recDay = record.detectedAt.slice(0, 10);
          if (filters.dateFilter === 'TODAY') {
            const todayStr = new Date().toISOString().slice(0, 10);
            if (recDay !== todayStr) return false;
          } else if (filters.dateFilter === '7D') {
            if (now - recTime > 7 * 24 * 60 * 60 * 1000) return false;
          } else if (filters.dateFilter === '14D') {
            if (now - recTime > 14 * 24 * 60 * 60 * 1000) return false;
          } else if (filters.dateFilter === '30D') {
            if (now - recTime > 30 * 24 * 60 * 60 * 1000) return false;
          } else if (filters.dateFilter === '60D') {
            if (now - recTime > 60 * 24 * 60 * 60 * 1000) return false;
          } else if (filters.dateFilter === 'PRIZE_6M') {
            if (!isPrizeOrExtendedRetentionRecord(record)) return false;
          } else if (filters.dateFilter.startsWith('DATE:')) {
            const selectedDate = filters.dateFilter.replace('DATE:', '');
            if (recDay !== selectedDate) return false;
          }
        }
        // Category Filter
        if (filters.categoryFilter !== 'ALL' && record.scamType !== filters.categoryFilter) {
          return false;
        }
        // Platform Filter
        if (filters.platformFilter !== 'ALL' && record.platform !== filters.platformFilter) {
          return false;
        }
        // Country Filter
        if (
          filters.countryFilter !== 'ALL' &&
          record.countryName !== filters.countryFilter &&
          record.countryCode !== filters.countryFilter
        ) {
          return false;
        }
        // Status Filter (All / Active / Number Down)
        if (filters.statusFilter === 'ACTIVE' && record.isNumberDown) {
          return false;
        }
        if (filters.statusFilter === 'DOWN' && !record.isNumberDown) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortField === 'detectedAt') {
          const timeA = new Date(a.detectedAt).getTime() || 0;
          const timeB = new Date(b.detectedAt).getTime() || 0;
          return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
        }

        let valA = (a[sortField] || '').toString().toLowerCase();
        let valB = (b[sortField] || '').toString().toLowerCase();

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [records, filters, sortField, sortOrder]);

  // Handle select all
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(processedRecords.map((r) => r.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Copy helper
  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // CSV Export - Uses exportRecordsToCSV with Blob & UTF-8 BOM to prevent any truncation
  const exportToCSV = (targetRecords = processedRecords) => {
    if (targetRecords.length === 0) return;
    const pstDateStamp = getPSTDateStamp();
    exportRecordsToCSV(targetRecords, `scam_phone_numbers_${pstDateStamp}_PST.csv`);
  };

  // CSV Import Success Handler
  const handleImportCsvSuccess = (importedRecords: ScamPhoneRecord[], summary: string) => {
    onThreatSearchSuccess?.(summary);
    onReloadRecords?.();
  };

  // Targeted Threat Search (Last 24 Hours) Handler
  const handleThreatSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQueryInput.trim()) return;

    setIsExecutingSearch(true);
    setSearchFeedback(null);

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQueryInput.trim(),
          category: searchCategoryInput,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setSearchFeedback(data.message || `Found ${data.newCount} new numbers.`);
        if (onThreatSearchSuccess) onThreatSearchSuccess(data.message);
        if (onReloadRecords) onReloadRecords();
        setTimeout(() => {
          setIsExecutingSearch(false);
          setShowSearchModal(false);
          setSearchQueryInput('');
          setSearchFeedback(null);
        }, 1800);
      } else {
        setSearchFeedback(data.error || 'Failed to complete threat search.');
        setIsExecutingSearch(false);
      }
    } catch (err: any) {
      setSearchFeedback(err.message || 'Error communicating with server.');
      setIsExecutingSearch(false);
    }
  };

  // Check if detected within last 24 hours
  const isWithinLast24Hours = (isoString: string) => {
    const time = new Date(isoString).getTime();
    return !isNaN(time) && Date.now() - time <= 24 * 60 * 60 * 1000;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
      {/* Table Toolbar & Filters */}
      <div className="p-4 border-b border-slate-800 space-y-3">
        {/* Retention & Accumulation Status Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 pb-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-200">
              Showing {processedRecords.length} of {records.length} scam numbers
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-medium flex items-center gap-1">
              <span>Tiered Retention:</span>
              <span className="text-amber-400 font-semibold">6-Mo Prize/PCH/Stake</span>
              <span className="text-slate-500">&bull;</span>
              <span>60-Day Standard</span>
            </span>
          </div>
          <span className="text-[11px] text-slate-500">
            * Scans & searches incrementally append new unique numbers without replacing existing records.
          </span>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Filter Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filters.searchTerm}
              onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
              placeholder="Search by phone, date, scam type, URL, or snippet..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Action Buttons & Exports */}
          <div className="flex items-center space-x-2 flex-wrap gap-y-1.5">
            <button
              id="btn-add-manual-phone"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center space-x-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Entry</span>
            </button>

            {/* Export Dropdown Group */}
            <button
              id="btn-export-csv"
              onClick={() => exportToCSV()}
              disabled={processedRecords.length === 0}
              className="inline-flex items-center space-x-1 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold rounded-lg transition-colors disabled:opacity-40"
              title="Export filtered records to CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            {/* Import CSV Button */}
            <button
              id="btn-import-csv"
              onClick={() => setShowImportCsvModal(true)}
              className="inline-flex items-center space-x-1 px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              title="Import CSV matching export template"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import CSV</span>
            </button>

            {selectedIds.length > 0 && (
              <button
                id="btn-delete-selected"
                onClick={() => {
                  handleBulkNumberDown(selectedIds);
                  setSelectedIds([]);
                }}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                title="Mark selected numbers as dead / inactive (Number down)"
              >
                <X className="w-3.5 h-3.5 text-red-500 stroke-[3]" />
                <span>Number down ({selectedIds.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Dropdown Filters Row */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/80 text-xs">
          <span className="text-slate-400 font-medium flex items-center gap-1">
            <Filter className="w-3 h-3" /> Filters:
          </span>

          {/* Status Filter */}
          <select
            value={filters.statusFilter || 'ALL'}
            onChange={(e) => setFilters({ ...filters, statusFilter: e.target.value })}
            className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
          >
            <option value="ALL">All Statuses ({records.length})</option>
            <option value="ACTIVE">Active Numbers ({records.filter((r) => !r.isNumberDown).length})</option>
            <option value="DOWN">Number Down ({records.filter((r) => r.isNumberDown).length})</option>
          </select>

          {/* Scam Type Filter */}
          <select
            value={filters.categoryFilter}
            onChange={(e) => setFilters({ ...filters, categoryFilter: e.target.value })}
            className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-amber-500"
          >
            <option value="ALL">All Scam Types</option>
            {categoriesList.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Platform Filter */}
          <select
            value={filters.platformFilter}
            onChange={(e) => setFilters({ ...filters, platformFilter: e.target.value })}
            className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-amber-500"
          >
            <option value="ALL">All Platforms</option>
            {platformsList.map((plat) => (
              <option key={plat} value={plat}>
                {plat}
              </option>
            ))}
          </select>

          {/* Country Filter */}
          <select
            value={filters.countryFilter}
            onChange={(e) => setFilters({ ...filters, countryFilter: e.target.value })}
            className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-amber-500"
          >
            <option value="ALL">All Countries</option>
            {countriesList.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>

          {/* Date Filter (Tiered archive) */}
          <select
            value={filters.dateFilter || 'ALL'}
            onChange={(e) => setFilters({ ...filters, dateFilter: e.target.value })}
            className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-amber-300 focus:outline-none focus:border-amber-500 font-medium"
          >
            <option value="ALL">All Active Archive ({records.length})</option>
            <option value="PRIZE_6M">⭐ Prize / PCH / Stake (Up to 6 Mo)</option>
            <option value="TODAY">Today</option>
            <option value="7D">Last 7 Days</option>
            <option value="14D">Last 14 Days</option>
            <option value="30D">Last 30 Days</option>
            <option value="60D">Last 60 Days</option>
            <optgroup label="Specific Date Filter">
              {datesList.map((dt) => (
                <option key={dt} value={`DATE:${dt}`}>
                  {dt}
                </option>
              ))}
            </optgroup>
          </select>

          {/* Reset Filters */}
          {(filters.searchTerm ||
            filters.categoryFilter !== 'ALL' ||
            filters.platformFilter !== 'ALL' ||
            filters.countryFilter !== 'ALL' ||
            filters.statusFilter !== 'ALL' ||
            (filters.dateFilter && filters.dateFilter !== 'ALL')) && (
            <button
              onClick={() =>
                setFilters({
                  searchTerm: '',
                  categoryFilter: 'ALL',
                  platformFilter: 'ALL',
                  countryFilter: 'ALL',
                  statusFilter: 'ALL',
                  dateFilter: 'ALL',
                })
              }
              className="text-amber-400 hover:underline text-xs ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Content View: Responsive Cards for Mobile, Full Data Table for Desktop */}
      {isMobileActive ? (
        <div className="p-3 bg-slate-950/50">
          <MobileResultsList
            records={processedRecords}
            selectedIds={selectedIds}
            onToggleSelect={handleSelectRow}
            onSelectAll={() => setSelectedIds(processedRecords.map((r) => r.id))}
            onDeselectAll={() => setSelectedIds([])}
            onToggleNumberDown={handleToggleRecordDown}
            onBulkNumberDown={(ids) => {
              handleBulkNumberDown(ids);
              setSelectedIds([]);
            }}
            sortField={sortField}
            sortOrder={sortOrder}
            onSortChange={handleSort}
            onExportCSV={() => exportToCSV()}
            onImportCSV={() => setShowImportCsvModal(true)}
            onOpenAddModal={() => setShowAddModal(true)}
            onOpenSearchModal={() => setShowSearchModal(true)}
          />
        </div>
      ) : (
        <>
          {/* Main Desktop Table View */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 select-none">
                  <th className="p-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        processedRecords.length > 0 &&
                        selectedIds.length === processedRecords.length
                      }
                      onChange={handleSelectAll}
                      className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0"
                    />
                  </th>

                  {/* Sortable: Date Detected (PST) */}
                  <th
                    onClick={() => handleSort('detectedAt')}
                    className="p-3.5 cursor-pointer hover:text-slate-200 transition-colors"
                  >
                    <div className="flex items-center space-x-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>Date Detected (PST)</span>
                      {sortField === 'detectedAt' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-amber-400" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-amber-400" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-600" />
                      )}
                    </div>
                  </th>

                  {/* Sortable: Type of Scam */}
                  <th
                    onClick={() => handleSort('scamType')}
                    className="p-3.5 cursor-pointer hover:text-slate-200 transition-colors"
                  >
                    <div className="flex items-center space-x-1.5">
                      <span>Type of Scam</span>
                      {sortField === 'scamType' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-amber-400" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-amber-400" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-600" />
                      )}
                    </div>
                  </th>

                  {/* Sortable: Phone Number */}
                  <th
                    onClick={() => handleSort('phone')}
                    className="p-3.5 cursor-pointer hover:text-slate-200 transition-colors"
                  >
                    <div className="flex items-center space-x-1.5">
                      <span>Phone Number</span>
                      {sortField === 'phone' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-amber-400" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-amber-400" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-600" />
                      )}
                    </div>
                  </th>

                  {/* Snippet Context */}
                  <th className="p-3.5 hidden lg:table-cell w-1/3">Context Snippet</th>

                  {/* Sortable: Source (Platform) */}
                  <th
                    onClick={() => handleSort('platform')}
                    className="p-3.5 cursor-pointer hover:text-slate-200 transition-colors hidden sm:table-cell"
                  >
                    <div className="flex items-center space-x-1.5">
                      <span>Source</span>
                      {sortField === 'platform' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-amber-400" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-amber-400" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-600" />
                      )}
                    </div>
                  </th>

                  {/* Actions */}
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/80">
                {processedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <AlertCircle className="w-8 h-8 text-slate-600" />
                        <p className="text-sm font-medium">No phone records found.</p>
                        <p className="text-xs text-slate-600">
                          Click "Run Harvester Scan Now" above or adjust your search filters.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  processedRecords.map((record) => {
                    const isSelected = selectedIds.includes(record.id);
                    return (
                      <tr
                        key={record.id}
                        className={`hover:bg-slate-800/40 transition-colors ${
                          isSelected ? 'bg-amber-500/5' : ''
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="p-3.5 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleSelectRow(record.id)}
                            className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0"
                          />
                        </td>

                        {/* Column 1: Date Detected & Status Tags */}
                        <td className="p-3.5 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                          <div className="flex items-center space-x-1.5 text-slate-400 flex-wrap gap-y-1">
                            <span>{formatDate(record.detectedAt)}</span>
                            {isWithinLast24Hours(record.detectedAt) && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold uppercase tracking-wider">
                                Last 24h
                              </span>
                            )}
                            {record.isNumberDown && (
                              <span
                                id={`tag-number-down-${record.id}`}
                                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40 text-[10px] font-bold tracking-wide shadow-sm"
                                title={record.numberDownAt ? `Marked down at ${new Date(record.numberDownAt).toLocaleTimeString()}` : 'Marked as Number Down'}
                              >
                                <X className="w-3 h-3 text-red-400 stroke-[3]" />
                                <span>Number Down</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Column 2: Type of Scam & Impersonation Metadata */}
                        <td className="p-3.5 whitespace-normal max-w-xs">
                          <ScamSummaryHoverCard record={record}>
                            <div className="space-y-1.5 cursor-help">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold border ${
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
                                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-blue-500/15 text-blue-300 border border-blue-500/30 rounded text-[10px] font-medium">
                                    <Building2 className="w-2.5 h-2.5" />
                                    <span>{record.impersonatedCompany}</span>
                                  </span>
                                )}

                                {isPrizeOrExtendedRetentionRecord(record) ? (
                                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded text-[10px] font-semibold" title="PCH / Mega Millions / Reader's Digest / Stake.us / Prize Scam (6-Month Retention Active)">
                                    <Gift className="w-2.5 h-2.5 text-amber-400" />
                                    <span>6-Mo Retention</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-1.5 py-0.5 bg-slate-800/80 text-slate-400 border border-slate-700/60 rounded text-[9px] font-medium" title="Standard Scam Record (60-Day Auto-Retention)">
                                    60-Day Retained
                                  </span>
                                )}
                              </div>

                              {(record.amountCharged && record.amountCharged !== 'N/A' || record.invoiceNumber && record.invoiceNumber !== 'N/A') && (
                                <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                                  {record.amountCharged && record.amountCharged !== 'N/A' && (
                                    <span className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded font-semibold">
                                      <DollarSign className="w-2.5 h-2.5" />
                                      <span>{record.amountCharged}</span>
                                    </span>
                                  )}
                                  {record.invoiceNumber && record.invoiceNumber !== 'N/A' && (
                                    <span className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 bg-purple-500/15 text-purple-300 border border-purple-500/30 rounded font-mono">
                                      <Hash className="w-2.5 h-2.5" />
                                      <span>{record.invoiceNumber}</span>
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </ScamSummaryHoverCard>
                        </td>

                        {/* Column 3: Phone Number */}
                        <td className="p-3.5 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <span className={`font-mono text-sm font-bold tracking-tight ${record.isNumberDown ? 'text-slate-400 line-through decoration-red-500/60 decoration-2' : 'text-slate-100'}`}>
                              {record.phone}
                            </span>

                            {record.countryCode && (
                              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded border border-slate-700">
                                {record.countryCode}
                              </span>
                            )}

                            {/* WhatsApp Clickable Direct Link */}
                            <a
                              href={`https://wa.me/${record.cleanPhone}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded border border-emerald-500/30 transition-colors"
                              title={`Open WhatsApp chat with ${record.phone}`}
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>

                            {/* Copy Phone Button */}
                            <button
                              onClick={() => handleCopyText(record.phone, `phone-${record.id}`)}
                              className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
                              title="Copy phone number"
                            >
                              {copiedId === `phone-${record.id}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Column 4: Snippet Context with Hover Summary */}
                        <td className="p-3.5 max-w-xl hidden lg:table-cell text-slate-400">
                          <ScamSummaryHoverCard record={record}>
                            <div className="cursor-help group">
                              <p className="italic text-[11px] bg-slate-950/60 group-hover:bg-slate-950 p-2 rounded border border-slate-800 group-hover:border-amber-500/40 break-words transition-colors">
                                "{record.snippet}"
                              </p>
                              <span className="text-[10px] text-amber-500/70 group-hover:text-amber-400 font-medium inline-flex items-center gap-1 mt-0.5">
                                <Info className="w-2.5 h-2.5" /> Hover for full invoice & scam intelligence summary
                              </span>
                            </div>
                          </ScamSummaryHoverCard>
                        </td>

                        {/* Column 5: Source (Platform + URL) */}
                        <td className="p-3.5 whitespace-nowrap hidden sm:table-cell">
                          <div className="flex items-center space-x-2">
                            <a
                              href={record.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center px-2 py-1 rounded bg-slate-950 border border-slate-800 font-medium text-slate-300 hover:text-amber-400 hover:border-amber-500/50 transition-colors"
                              title={record.sourceUrl}
                            >
                              <span>{record.platform}</span>
                              <ExternalLink className="w-3 h-3 ml-1.5 shrink-0" />
                            </a>
                            <button
                              onClick={() => handleCopyText(record.sourceUrl, `url-${record.id}`)}
                              className="p-1 text-slate-500 hover:text-slate-300 transition-colors shrink-0"
                              title="Copy source URL"
                            >
                              {copiedId === `url-${record.id}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Column 7: Actions */}
                        <td className="p-3.5 text-right whitespace-nowrap">
                          <button
                            id={`btn-number-down-${record.id}`}
                            onClick={() => handleToggleRecordDown(record.id)}
                            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shadow-sm group cursor-pointer border ${
                              record.isNumberDown
                                ? 'bg-red-950/70 text-red-300 border-red-500/50 hover:bg-slate-900'
                                : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border-red-500/30'
                            }`}
                            title={record.isNumberDown ? 'Number is down. Click to toggle active status.' : 'Mark number as dead / disconnected (Number down)'}
                          >
                            <X className="w-3.5 h-3.5 text-red-500 group-hover:scale-110 transition-transform stroke-[2.5]" />
                            <span>Number down</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer Stats */}
          <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div>
              Showing <strong>{processedRecords.length}</strong> of <strong>{records.length}</strong> entries (Tiered retention: 6-mo for PCH, Mega Millions, Reader's Digest, Stake.us & prize scams; 60-day standard)
              {selectedIds.length > 0 && (
                <span className="ml-2 text-amber-400">({selectedIds.length} selected)</span>
              )}
            </div>
            <div className="text-[11px] text-slate-500">
              Click column headers (Date Detected, Scam Type, Phone, URL, Platform) to sort.
            </div>
          </div>
        </>
      )}

      {/* Manual Add Entry Modal */}
      <ManualAddModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAddRecord={onAddManualRecord}
      />

      {/* Import CSV Modal */}
      <ImportCsvModal
        isOpen={showImportCsvModal}
        onClose={() => setShowImportCsvModal(false)}
        onImportSuccess={handleImportCsvSuccess}
        existingRecords={records}
      />

      {/* Targeted Threat Search Modal (Strict 24-Hour Scope) */}
      {showSearchModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/30">
                  <Search className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">
                    Search Threat Intel (Last 24 Hours)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Harvests active scam numbers reported strictly within today (last 24h). Duplicates are automatically ignored.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleThreatSearchSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Target Scam Topic, Keyword, or Organization *
                </label>
                <input
                  type="text"
                  required
                  value={searchQueryInput}
                  onChange={(e) => setSearchQueryInput(e.target.value)}
                  placeholder="e.g. Geek Squad renewal, PayPal invoice, Amazon alert, Dr Mama love spell WhatsApp..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Quick suggestion tags */}
              <div>
                <span className="block text-[11px] font-medium text-slate-400 mb-1.5">
                  Quick Query Suggestions:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'PayPal invoice fraud hotline',
                    'Geek Squad Total Tech $399 auto-renewal',
                    'Apple iCloud security breach alert',
                    'Publishers Clearing House $2.5M claim agent',
                    'WhatsApp spellcaster ex lover recovery',
                    'Crypto broker wallet recovery agent',
                  ].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setSearchQueryInput(tag)}
                      className="px-2 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-[11px] text-slate-300 rounded transition-colors"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Category Classification
                </label>
                <select
                  value={searchCategoryInput}
                  onChange={(e) => setSearchCategoryInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="Tech Support & Refund Scam">Tech Support & Refund Scam</option>
                  <option value="PayPal / Invoice Scam">PayPal / Invoice Scam</option>
                  <option value="Apple / Account Phishing">Apple / Account Phishing</option>
                  <option value="Sweepstakes / Financial Scam">Sweepstakes / Financial Scam</option>
                  <option value="Spellcaster & Social Scam">Spellcaster & Social Scam</option>
                  <option value="Crypto / BTC Recovery Scam">Crypto / BTC Recovery Scam</option>
                  <option value="Investment / Forex Scam">Investment / Forex Scam</option>
                </select>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1 text-xs text-slate-400">
                <div className="flex items-center text-amber-400 font-semibold gap-1.5 text-[11px]">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Incremental Addition & Tiered Retention Guarantee</span>
                </div>
                <p className="text-[11px]">
                  Discovered numbers will be incrementally added onto your existing retained database. PCH, Mega Millions, Reader's Digest, Stake.us, and prize scams are preserved for up to 6 months; all other scam categories remain safely retained for up to 60 days.
                </p>
              </div>

              {searchFeedback && (
                <div className={`p-2.5 rounded-lg text-xs font-medium ${
                  searchFeedback.includes('error') || searchFeedback.includes('Failed')
                    ? 'bg-red-500/10 text-red-300 border border-red-500/30'
                    : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {searchFeedback}
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  disabled={isExecutingSearch}
                  onClick={() => setShowSearchModal(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isExecutingSearch || !searchQueryInput.trim()}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg shadow disabled:opacity-50 transition-colors"
                >
                  {isExecutingSearch ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                      <span>Scanning Last 24 Hours...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-3.5 h-3.5" />
                      <span>Execute 24h Search</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Screenshot & Visual Intelligence Extractor Modal */}
      <ScreenshotExtractorModal
        isOpen={showScreenshotModal}
        onClose={() => setShowScreenshotModal(false)}
        onExtractionComplete={(newRecords, summary) => {
          if (onReloadRecords) {
            onReloadRecords();
          }
          if (onThreatSearchSuccess) {
            onThreatSearchSuccess(summary);
          }
        }}
      />
    </div>
  );
};
