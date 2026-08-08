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
  Trash2,
  Plus,
  Search,
  Filter,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  PhoneCall,
  Calendar,
} from 'lucide-react';
import { ScamPhoneRecord, SortField, SortOrder, TableFilterState } from '../types';

interface ResultsTableProps {
  records: ScamPhoneRecord[];
  onDeleteRecord: (id: string) => void;
  onDeleteSelected: (ids: string[]) => void;
  onAddManualRecord: (record: Omit<ScamPhoneRecord, 'id' | 'detectedAt'>) => void;
  isSearching: boolean;
}

export const ResultsTable: React.FC<ResultsTableProps> = ({
  records,
  onDeleteRecord,
  onDeleteSelected,
  onAddManualRecord,
  isSearching: _isSearching,
}) => {
  // Table sorting state
  const [sortField, setSortField] = useState<SortField>('detectedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Filtering state
  const [filters, setFilters] = useState<TableFilterState>({
    searchTerm: '',
    categoryFilter: 'ALL',
    platformFilter: 'ALL',
    countryFilter: 'ALL',
  });

  // Copy feedback state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Manual Add Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [manualForm, setManualForm] = useState({
    phone: '',
    scamType: 'Spellcaster Scam',
    sourceUrl: '',
    platform: 'Facebook',
    snippet: '',
  });

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
    if (!isoString) return 'N/A';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return isoString;
      return date.toLocaleDateString('en-US', {
        timeZone: 'America/Los_Angeles',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }) + ' PST';
    } catch (e) {
      return isoString;
    }
  };

  // Filter and sort records
  const processedRecords = useMemo(() => {
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

  // CSV Export
  const exportToCSV = (targetRecords = processedRecords) => {
    if (targetRecords.length === 0) return;
    const headers = ['Type of Scam', 'Phone Number', 'Clean Digits', 'Date Detected', 'Source URL', 'Platform', 'Country', 'Snippet'];
    const rows = targetRecords.map((r) => [
      `"${r.scamType.replace(/"/g, '""')}"`,
      `"${r.phone.replace(/"/g, '""')}"`,
      `"${r.cleanPhone}"`,
      `"${r.detectedAt}"`,
      `"${r.sourceUrl.replace(/"/g, '""')}"`,
      `"${r.platform}"`,
      `"${r.countryName || r.countryCode || ''}"`,
      `"${r.snippet.replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `scam_phone_numbers_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // JSON Export
  const exportToJSON = (targetRecords = processedRecords) => {
    if (targetRecords.length === 0) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(targetRecords, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', `scam_phones_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // TXT Phone List Export
  const exportToTXT = (targetRecords = processedRecords) => {
    if (targetRecords.length === 0) return;
    const txtContent = targetRecords.map((r) => `${r.phone} | ${r.scamType} | ${formatDate(r.detectedAt)} | ${r.sourceUrl}`).join('\n');
    const dataStr = 'data:text/plain;charset=utf-8,' + encodeURIComponent(txtContent);
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', `scam_phone_list.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Add Manual Record Handler
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.phone.trim()) return;

    let domain = 'web';
    try {
      if (manualForm.sourceUrl) {
        domain = new URL(manualForm.sourceUrl).hostname.replace('www.', '');
      }
    } catch (err) {
      domain = 'web';
    }

    onAddManualRecord({
      phone: manualForm.phone.trim(),
      cleanPhone: manualForm.phone.replace(/\D/g, ''),
      scamType: manualForm.scamType,
      sourceUrl: manualForm.sourceUrl.trim() || 'https://bbb.org',
      sourceDomain: domain,
      platform: manualForm.platform,
      snippet: manualForm.snippet.trim() || 'Manually entered record',
      searchQuery: 'Manual Entry',
      confidence: 'High',
    });

    setManualForm({
      phone: '',
      scamType: 'Spellcaster Scam',
      sourceUrl: '',
      platform: 'Facebook',
      snippet: '',
    });
    setShowAddModal(false);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
      {/* Table Toolbar & Filters */}
      <div className="p-4 border-b border-slate-800 space-y-3">
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
          <div className="flex items-center space-x-2 flex-wrap">
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

            <button
              id="btn-export-json"
              onClick={() => exportToJSON()}
              disabled={processedRecords.length === 0}
              className="inline-flex items-center space-x-1 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-semibold rounded-lg transition-colors disabled:opacity-40"
              title="Export to JSON"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>JSON</span>
            </button>

            <button
              id="btn-export-txt"
              onClick={() => exportToTXT()}
              disabled={processedRecords.length === 0}
              className="inline-flex items-center space-x-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold rounded-lg transition-colors disabled:opacity-40"
              title="Export plain text phone list"
            >
              <Download className="w-3.5 h-3.5" />
              <span>TXT</span>
            </button>

            {selectedIds.length > 0 && (
              <button
                id="btn-delete-selected"
                onClick={() => {
                  onDeleteSelected(selectedIds);
                  setSelectedIds([]);
                }}
                className="inline-flex items-center space-x-1 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-semibold rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete ({selectedIds.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Dropdown Filters Row */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/80 text-xs">
          <span className="text-slate-400 font-medium flex items-center gap-1">
            <Filter className="w-3 h-3" /> Filters:
          </span>

          {/* Scam Type Filter */}
          <select
            value={filters.categoryFilter}
            onChange={(e) => setFilters({ ...filters, categoryFilter: e.target.value })}
            className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-amber-500"
          >
            <option value="ALL">All Scam Types ({records.length})</option>
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

          {/* Reset Filters */}
          {(filters.searchTerm ||
            filters.categoryFilter !== 'ALL' ||
            filters.platformFilter !== 'ALL' ||
            filters.countryFilter !== 'ALL') && (
            <button
              onClick={() =>
                setFilters({
                  searchTerm: '',
                  categoryFilter: 'ALL',
                  platformFilter: 'ALL',
                  countryFilter: 'ALL',
                })
              }
              className="text-amber-400 hover:underline text-xs ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Table View */}
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

              {/* Sortable: Date Detected */}
              <th
                onClick={() => handleSort('detectedAt')}
                className="p-3.5 cursor-pointer hover:text-slate-200 transition-colors"
              >
                <div className="flex items-center space-x-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>Date Detected</span>
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

              {/* Sortable: Source URL */}
              <th
                onClick={() => handleSort('sourceUrl')}
                className="p-3.5 cursor-pointer hover:text-slate-200 transition-colors"
              >
                <div className="flex items-center space-x-1.5">
                  <span>Source URL</span>
                  {sortField === 'sourceUrl' ? (
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

              {/* Sortable: Platform */}
              <th
                onClick={() => handleSort('platform')}
                className="p-3.5 cursor-pointer hover:text-slate-200 transition-colors hidden sm:table-cell"
              >
                <div className="flex items-center space-x-1.5">
                  <span>Platform</span>
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

              {/* Snippet Context */}
              <th className="p-3.5 hidden lg:table-cell">Context Snippet</th>

              {/* Actions */}
              <th className="p-3.5 text-right">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/80">
            {processedRecords.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500">
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

                    {/* Column 1: Date Detected */}
                    <td className="p-3.5 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                      <div className="flex items-center space-x-1 text-slate-400">
                        <span>{formatDate(record.detectedAt)}</span>
                      </div>
                    </td>

                    {/* Column 2: Type of Scam */}
                    <td className="p-3.5 font-medium whitespace-nowrap">
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
                    </td>

                    {/* Column 3: Phone Number */}
                    <td className="p-3.5 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-sm font-bold text-slate-100 tracking-tight">
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

                    {/* Column 4: Source URL */}
                    <td className="p-3.5 max-w-xs">
                      <div className="flex items-center space-x-2">
                        <span className="truncate text-slate-300 font-mono text-[11px]">
                          {record.sourceDomain}
                        </span>
                        <a
                          href={record.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-amber-400 hover:text-amber-300 transition-colors shrink-0"
                          title={record.sourceUrl}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
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

                    {/* Column 5: Platform */}
                    <td className="p-3.5 whitespace-nowrap hidden sm:table-cell text-slate-300">
                      <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 font-medium">
                        {record.platform}
                      </span>
                    </td>

                    {/* Column 6: Snippet Context */}
                    <td className="p-3.5 max-w-sm hidden lg:table-cell text-slate-400">
                      <p className="line-clamp-2 italic text-[11px] bg-slate-950/60 p-2 rounded border border-slate-800">
                        "{record.snippet}"
                      </p>
                    </td>

                    {/* Column 7: Actions */}
                    <td className="p-3.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => onDeleteRecord(record.id)}
                        className="p-1.5 text-slate-500 hover:text-red-400 transition-colors rounded hover:bg-slate-800"
                        title="Delete entry"
                      >
                        <Trash2 className="w-4 h-4" />
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
          Showing <strong>{processedRecords.length}</strong> of <strong>{records.length}</strong> entries (31-day retention policy active)
          {selectedIds.length > 0 && (
            <span className="ml-2 text-amber-400">({selectedIds.length} selected)</span>
          )}
        </div>
        <div className="text-[11px] text-slate-500">
          Click column headers (Date Detected, Scam Type, Phone, URL, Platform) to sort.
        </div>
      </div>

      {/* Manual Add Entry Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-100 mb-4 flex items-center gap-2">
              <PhoneCall className="w-5 h-5 text-amber-400" />
              Add Manual Phone Entry
            </h3>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Phone Number *
                </label>
                <input
                  type="text"
                  required
                  value={manualForm.phone}
                  onChange={(e) => setManualForm({ ...manualForm, phone: e.target.value })}
                  placeholder="e.g. +234 812 345 6789 or +1 888 123 4567"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Type of Scam
                </label>
                <select
                  value={manualForm.scamType}
                  onChange={(e) => setManualForm({ ...manualForm, scamType: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="Tech Support / Geek Squad Impersonation">Tech Support / Geek Squad Impersonation</option>
                  <option value="Spellcaster Scam">Spellcaster Scam</option>
                  <option value="Crypto / BTC Recovery Scam">Crypto / BTC Recovery Scam</option>
                  <option value="Guestbook Spam">Guestbook Spam</option>
                  <option value="Romance / Relationship Scam">Romance Scam</option>
                  <option value="Manual Verification">Manual Verification</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Source URL
                </label>
                <input
                  type="url"
                  value={manualForm.sourceUrl}
                  onChange={(e) => setManualForm({ ...manualForm, sourceUrl: e.target.value })}
                  placeholder="https://www.bbb.org/scamtracker/lookupscam..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Platform
                </label>
                <select
                  value={manualForm.platform}
                  onChange={(e) => setManualForm({ ...manualForm, platform: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="BBB Scam Tracker">BBB Scam Tracker</option>
                  <option value="Facebook">Facebook</option>
                  <option value="Instagram">Instagram</option>
                  <option value="Guestbook">Guestbook</option>
                  <option value="Web Forum">Web Forum</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Context Snippet
                </label>
                <textarea
                  value={manualForm.snippet}
                  onChange={(e) => setManualForm({ ...manualForm, snippet: e.target.value })}
                  rows={2}
                  placeholder="Short note or report description..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg shadow"
                >
                  Add Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
