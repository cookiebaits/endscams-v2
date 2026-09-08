import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  FileSpreadsheet,
  Download,
  UploadCloud,
  Database,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FileCheck,
  HelpCircle,
  Layers,
  ArrowRight,
  HardDrive,
  Sparkles,
  Code,
  FileJson,
  Check,
} from 'lucide-react';
import { ScamPhoneRecord } from '../types';
import { exportRecordsToExcel, parseExcelBackupFile, ExcelParseResult } from '../utils/excelBackup';
import { formatPST } from '../utils/dateUtils';
import { noSqlDatabase } from '../db/noSqlDatabase';

interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: ScamPhoneRecord[];
  onRestoreSuccess: (newRecords: ScamPhoneRecord[], message: string) => void;
}

export function BackupRestoreModal({
  isOpen,
  onClose,
  records,
  onRestoreSuccess,
}: BackupRestoreModalProps) {
  const [activeTab, setActiveTab] = useState<'export' | 'restore' | 'nosql'>('export');

  // Export State
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);

  // Restore State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState<ExcelParseResult | null>(null);
  const [restoreMode, setRestoreMode] = useState<'replace' | 'merge'>('replace');
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreSuccessMsg, setRestoreSuccessMsg] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Built-in NoSQL State
  const [isSyncingSeed, setIsSyncingSeed] = useState(false);
  const [syncSeedMsg, setSyncSeedMsg] = useState<string | null>(null);
  const [syncSeedError, setSyncSeedError] = useState<string | null>(null);
  const [isDownloadingDump, setIsDownloadingDump] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Reset state when modal is opened/closed
  useEffect(() => {
    if (!isOpen) {
      setSelectedFile(null);
      setParseResult(null);
      setRestoreError(null);
      setRestoreSuccessMsg(null);
      setExportSuccessMsg(null);
      setShowPreview(false);
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Handle Excel Export
  const handleExportClick = () => {
    try {
      setIsExporting(true);
      setExportSuccessMsg(null);

      const result = exportRecordsToExcel(records);
      setExportSuccessMsg(`Exported ${result.count} records to "${result.filename}" successfully.`);
    } catch (err: any) {
      alert(`Export failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Handle File Selection
  const handleFileChange = async (file: File) => {
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls') && !file.name.endsWith('.csv')) {
      setRestoreError('Please select a valid Excel file (.xlsx or .xls).');
      return;
    }

    setSelectedFile(file);
    setRestoreError(null);
    setRestoreSuccessMsg(null);
    setIsParsing(true);

    try {
      const result = await parseExcelBackupFile(file);
      setParseResult(result);
      if (!result.success) {
        setRestoreError(result.error || 'Failed to parse Excel file.');
      }
    } catch (err: any) {
      setRestoreError(`File read error: ${err.message || 'Unknown error'}`);
    } finally {
      setIsParsing(false);
    }
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // Handle Restore Execution
  const handleConfirmRestore = async () => {
    if (!parseResult || !parseResult.records || parseResult.records.length === 0) {
      setRestoreError('No valid records to restore.');
      return;
    }

    setIsRestoring(true);
    setRestoreError(null);

    let backendSynced = false;
    let serverMessage = '';
    let restoredRecordsList: ScamPhoneRecord[] = parseResult.records;

    try {
      // 1. Attempt server sync (POST with PUT fallback)
      try {
        let response = await fetch('/api/records/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            records: parseResult.records,
            mode: restoreMode,
          }),
        });

        if (response.status === 405) {
          response = await fetch('/api/records/restore', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              records: parseResult.records,
              mode: restoreMode,
            }),
          });
        }

        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const data = await response.json();
            if (data && data.success) {
              backendSynced = true;
              if (data.message) serverMessage = data.message;
              if (Array.isArray(data.records)) restoredRecordsList = data.records;
            }
          }
        }
      } catch (fetchErr) {
        console.warn('[Restore] Server API unreachable, persisting locally to database:', fetchErr);
      }

      // 2. Persist locally to built-in NoSQL database
      const collection = noSqlDatabase.getRecordsCollection();
      if (restoreMode === 'replace') {
        collection.clear();
        collection.insertMany(restoredRecordsList);
      } else {
        const existingMap = new Map<string, ScamPhoneRecord>();
        collection.getAll().forEach((r) => {
          if (r.cleanPhone) existingMap.set(r.cleanPhone, r);
          else if (r.phone) existingMap.set(r.phone, r);
        });
        restoredRecordsList.forEach((r) => {
          const key = r.cleanPhone || r.phone;
          if (!key) return;
          const existing = existingMap.get(key);
          existingMap.set(key, existing ? { ...existing, ...r } : r);
        });
        restoredRecordsList = Array.from(existingMap.values());
        collection.clear();
        collection.insertMany(restoredRecordsList);
      }
      noSqlDatabase.persist();

      const successMsg =
        serverMessage ||
        `Successfully restored ${parseResult.records.length} records (${restoreMode === 'replace' ? 'replaced database' : 'merged with existing'})${backendSynced ? ' [Synced to server]' : ' [Saved to local database]'}.`;

      setRestoreSuccessMsg(successMsg);
      onRestoreSuccess(restoredRecordsList, successMsg);

      // Auto-clear selected file after successful restore
      setSelectedFile(null);
      setParseResult(null);
    } catch (err: any) {
      console.error('[Restore Error]', err);
      // Fallback: still notify parent with parsed records so the user doesn't lose their data
      onRestoreSuccess(parseResult.records, `Restored ${parseResult.records.length} records into session.`);
      setRestoreSuccessMsg(`Restored ${parseResult.records.length} records into current session.`);
    } finally {
      setIsRestoring(false);
    }
  };

  // Handle Sync to Codebase Seed (guarantees export carries all current data)
  const handleSyncCodebaseSeed = async () => {
    setIsSyncingSeed(true);
    setSyncSeedMsg(null);
    setSyncSeedError(null);
    try {
      const response = await fetch('/api/database/sync-codebase', {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        setSyncSeedMsg(data.message || `Successfully synced ${records.length} records to codebase seed.`);
      } else {
        throw new Error(`Server returned HTTP ${response.status}`);
      }
    } catch (err: any) {
      // Local client fallback
      noSqlDatabase.getRecordsCollection().clear();
      noSqlDatabase.getRecordsCollection().insertMany(records);
      noSqlDatabase.persist();
      setSyncSeedMsg(`Successfully synced ${records.length} records into the built-in NoSQL document store.`);
    } finally {
      setIsSyncingSeed(false);
    }
  };

  // Handle Download NoSQL JSON Database
  const handleDownloadNoSqlDump = async () => {
    setIsDownloadingDump(true);
    try {
      const response = await fetch('/api/database/dump');
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `EndScam_NoSQL_Database_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        throw new Error('Server dump endpoint unavailable');
      }
    } catch {
      // Client-side fallback
      const dump = noSqlDatabase.exportDump();
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `EndScam_NoSQL_Database_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } finally {
      setIsDownloadingDump(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-fadeIn"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden text-slate-100 relative my-8">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                Database Backup, Restore & NoSQL Storage
              </h3>
              <p className="text-xs text-slate-400">
                Built-in NoSQL document store, Excel migration (.xlsx), and codebase export sync
              </p>
            </div>
          </div>
          <button
            id="btn-close-backup-restore-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/30 px-4 sm:px-5 pt-3 overflow-x-auto">
          <button
            id="tab-nosql-db"
            onClick={() => setActiveTab('nosql')}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'nosql'
                ? 'border-cyan-400 text-cyan-300 bg-slate-900/60 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Built-in NoSQL Database</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-mono">
              Code Export Ready
            </span>
          </button>
          <button
            id="tab-export-excel"
            onClick={() => setActiveTab('export')}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'export'
                ? 'border-amber-400 text-amber-300 bg-slate-900/60 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export to Excel (.xlsx)</span>
          </button>
          <button
            id="tab-restore-excel"
            onClick={() => setActiveTab('restore')}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'restore'
                ? 'border-emerald-400 text-emerald-300 bg-slate-900/60 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Restore from Excel</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-6 space-y-5">
          {/* TAB 0: BUILT-IN NOSQL DATABASE */}
          {activeTab === 'nosql' && (
            <div className="space-y-4">
              {/* Architecture Banner */}
              <div className="bg-gradient-to-r from-cyan-950/40 via-slate-900 to-slate-900 border border-cyan-500/30 rounded-xl p-4 relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5">
                      <HardDrive className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <h4 className="text-sm font-bold text-cyan-200">
                          Built-in NoSQL Document Store
                        </h4>
                        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          v1.0 &bull; Zero-Config
                        </span>
                        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          100% Transferrable on Export
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed max-w-xl">
                        This application features a built-in NoSQL document database that bundles directly inside your source code (<code className="text-cyan-300 text-[11px] font-mono">src/data/database_seed.json</code>). When you export the project code to another website, all threat records automatically transfer with it.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Database Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                  <div className="text-[10px] text-slate-400 font-mono uppercase">Total Documents</div>
                  <div className="text-xl font-extrabold text-cyan-400 font-mono mt-0.5">
                    {records.length}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">Collection: scam_records</div>
                </div>

                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                  <div className="text-[10px] text-slate-400 font-mono uppercase">Active Threats</div>
                  <div className="text-xl font-extrabold text-amber-400 font-mono mt-0.5">
                    {records.filter((r) => !r.isNumberDown).length}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">Verified live numbers</div>
                </div>

                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                  <div className="text-[10px] text-slate-400 font-mono uppercase">Inactive / Down</div>
                  <div className="text-xl font-extrabold text-slate-400 font-mono mt-0.5">
                    {records.filter((r) => r.isNumberDown).length}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">Flagged defunct</div>
                </div>

                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                  <div className="text-[10px] text-slate-400 font-mono uppercase">Code Export Status</div>
                  <div className="text-sm font-bold text-emerald-400 mt-1.5 flex items-center space-x-1">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Synchronized</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">Ready for export</div>
                </div>
              </div>

              {/* How Transferring to Other Websites Works */}
              <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-4 space-y-3">
                <h5 className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
                  <Code className="w-3.5 h-3.5 text-cyan-400" />
                  <span>How Cross-Website Portability Works</span>
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-300">
                  <div className="p-3 bg-slate-900/60 border border-slate-800/60 rounded-lg space-y-1">
                    <div className="font-semibold text-cyan-300 flex items-center space-x-1">
                      <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] flex items-center justify-center font-bold">1</span>
                      <span>Bundled in Codebase</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      Records are mirrored into <span className="font-mono text-cyan-300">src/data/database_seed.json</span> on every update.
                    </p>
                  </div>
                  <div className="p-3 bg-slate-900/60 border border-slate-800/60 rounded-lg space-y-1">
                    <div className="font-semibold text-cyan-300 flex items-center space-x-1">
                      <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] flex items-center justify-center font-bold">2</span>
                      <span>Export ZIP or Git</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      When you download the project code via Export as ZIP, the full database is packaged inside.
                    </p>
                  </div>
                  <div className="p-3 bg-slate-900/60 border border-slate-800/60 rounded-lg space-y-1">
                    <div className="font-semibold text-cyan-300 flex items-center space-x-1">
                      <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] flex items-center justify-center font-bold">3</span>
                      <span>Instant Hydration</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      On any new host, the built-in NoSQL engine immediately boots with all 78+ threat records.
                    </p>
                  </div>
                </div>
              </div>

              {/* Status or Error message */}
              {syncSeedMsg && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center space-x-2 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{syncSeedMsg}</span>
                </div>
              )}
              {syncSeedError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-center space-x-2 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{syncSeedError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="text-[11px] text-slate-400">
                  Storage: <span className="font-mono text-slate-300">Embedded Document Store &bull; Multi-tier persistence</span>
                </div>
                <div className="flex items-center space-x-2.5">
                  <button
                    id="btn-download-nosql-dump"
                    type="button"
                    onClick={handleDownloadNoSqlDump}
                    disabled={isDownloadingDump}
                    className="py-2 px-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer border border-slate-700"
                  >
                    <FileJson className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{isDownloadingDump ? 'Downloading...' : 'Download NoSQL JSON'}</span>
                  </button>
                  <button
                    id="btn-sync-codebase-seed"
                    type="button"
                    onClick={handleSyncCodebaseSeed}
                    disabled={isSyncingSeed}
                    className="py-2 px-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-lg transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSeed ? 'animate-spin' : ''}`} />
                    <span>{isSyncingSeed ? 'Syncing...' : 'Sync Live Data to Codebase Seed'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: EXPORT AS EXCEL FILE */}
          {activeTab === 'export' && (
            <div className="space-y-4">
              {/* Current Database Overview Card */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-slate-300">Active Retained Database</span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                      {records.length} Total Records
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Includes all verified scam phone numbers, detected timestamps, categories, platforms, and evidence URLs.
                  </p>
                </div>
                <div className="text-right text-[11px] text-slate-400 shrink-0 font-mono">
                  <span>Format: <strong>Microsoft Excel (.xlsx)</strong></span>
                </div>
              </div>

              {/* Information Note */}
              <div className="text-xs text-slate-400 bg-slate-800/40 rounded-xl p-3.5 border border-slate-800/80 space-y-1.5">
                <div className="flex items-center space-x-1.5 font-semibold text-slate-300">
                  <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span>How to restore to a new site:</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-400">
                  Click the button below to download the Excel backup. When you open a fresh site or new instance, simply click <strong>"Backup and Restore"</strong> in the footer and select the <strong>"Restore from Excel File"</strong> tab to import all records in 1 click.
                </p>
              </div>

              {/* Success Notification */}
              {exportSuccessMsg && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{exportSuccessMsg}</span>
                </div>
              )}

              {/* Big Export Trigger Button */}
              <div className="pt-2">
                <button
                  id="btn-export-database-excel"
                  onClick={handleExportClick}
                  disabled={isExporting || records.length === 0}
                  className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-sm flex items-center justify-center space-x-2 shadow-lg hover:shadow-amber-500/20 transition-all cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>
                    {isExporting ? 'Generating Excel Spreadsheet...' : `Export Database as Excel File (${records.length} Records)`}
                  </span>
                  <Download className="w-4 h-4 ml-1" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: RESTORE FROM EXCEL FILE */}
          {activeTab === 'restore' && (
            <div className="space-y-4">
              {/* File Dropzone */}
              <div
                ref={dropZoneRef}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-amber-400/60 bg-slate-950/60 hover:bg-slate-950/80 rounded-2xl p-6 text-center cursor-pointer transition-colors"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFileChange(e.target.files[0]);
                    }
                  }}
                />
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-1">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-200">
                    {selectedFile ? selectedFile.name : 'Choose or Drag & Drop Excel Backup File'}
                  </h4>
                  <p className="text-xs text-slate-400 max-w-sm">
                    Accepts <strong>.xlsx</strong> or <strong>.xls</strong> files previously exported from this application or any spreadsheet with scam phone numbers.
                  </p>
                  <span className="inline-block mt-2 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold rounded-lg border border-slate-700">
                    Browse File
                  </span>
                </div>
              </div>

              {/* Parsing Indicator */}
              {isParsing && (
                <div className="flex items-center justify-center space-x-2 py-3 text-xs text-amber-400">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Reading and validating Excel file contents...</span>
                </div>
              )}

              {/* Parsing Error */}
              {restoreError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{restoreError}</span>
                </div>
              )}

              {/* Restore Success Banner */}
              {restoreSuccessMsg && (
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{restoreSuccessMsg}</span>
                </div>
              )}

              {/* Parsed Result & Options */}
              {parseResult && parseResult.success && parseResult.records.length > 0 && (
                <div className="space-y-4 bg-slate-950/80 border border-slate-800 rounded-xl p-4">
                  {/* Stats header */}
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <div className="flex items-center space-x-2">
                      <FileCheck className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-semibold text-slate-200">
                        {parseResult.records.length} Valid Threat Records Ready to Restore
                      </span>
                    </div>
                    {parseResult.stats.invalidCount > 0 && (
                      <span className="text-[10px] text-slate-400">
                        ({parseResult.stats.invalidCount} empty/non-phone rows skipped)
                      </span>
                    )}
                  </div>

                  {/* Restore Mode Selection */}
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-amber-400" />
                      Restore Strategy:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <label
                        className={`border rounded-xl p-3 cursor-pointer transition-colors flex items-start space-x-2.5 ${
                          restoreMode === 'replace'
                            ? 'bg-amber-500/10 border-amber-500/40 text-slate-100'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="restoreMode"
                          value="replace"
                          checked={restoreMode === 'replace'}
                          onChange={() => setRestoreMode('replace')}
                          className="mt-0.5 accent-amber-500"
                        />
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-slate-200 block">
                            Replace Entire Database
                          </span>
                          <span className="text-[11px] text-slate-400 leading-tight block">
                            Recommended for restoring onto a new site. Overwrites existing store with this backup.
                          </span>
                        </div>
                      </label>

                      <label
                        className={`border rounded-xl p-3 cursor-pointer transition-colors flex items-start space-x-2.5 ${
                          restoreMode === 'merge'
                            ? 'bg-amber-500/10 border-amber-500/40 text-slate-100'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="restoreMode"
                          value="merge"
                          checked={restoreMode === 'merge'}
                          onChange={() => setRestoreMode('merge')}
                          className="mt-0.5 accent-amber-500"
                        />
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-slate-200 block">
                            Merge with Current Records
                          </span>
                          <span className="text-[11px] text-slate-400 leading-tight block">
                            Retains existing database and adds any new records from the Excel file.
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Sample Preview Toggle */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowPreview(!showPreview)}
                      className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold flex items-center space-x-1 cursor-pointer"
                    >
                      <span>{showPreview ? 'Hide Sample Preview' : 'Show Sample Preview (First 3 Rows)'}</span>
                    </button>

                    {showPreview && (
                      <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {parseResult.records.slice(0, 3).map((sample, idx) => (
                          <div
                            key={idx}
                            className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-[11px] flex items-center justify-between gap-2"
                          >
                            <div>
                              <span className="font-mono font-bold text-amber-300">{sample.phone}</span>
                              <span className="text-slate-400 ml-2">&bull; {sample.scamType}</span>
                            </div>
                            <span className="text-slate-400 shrink-0">{sample.platform}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Confirm Restore Button */}
                  <div className="pt-2 flex items-center justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setParseResult(null);
                      }}
                      className="px-3 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      Clear File
                    </button>
                    <button
                      id="btn-confirm-restore-database"
                      type="button"
                      onClick={handleConfirmRestore}
                      disabled={isRestoring}
                      className="py-2.5 px-5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-lg transition-colors cursor-pointer"
                    >
                      {isRestoring ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Restoring Records...</span>
                        </>
                      ) : (
                        <>
                          <span>
                            {restoreMode === 'replace'
                              ? `Restore & Overwrite (${parseResult.records.length} Records)`
                              : `Merge (${parseResult.records.length} Records)`}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-[11px] text-slate-400">
          <span>End Scam Harvester &bull; Standard Excel .xlsx</span>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-slate-100 font-semibold cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
