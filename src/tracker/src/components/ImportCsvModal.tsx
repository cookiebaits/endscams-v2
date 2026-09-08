import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  X,
  FileText,
  AlertTriangle,
  Download,
  Info,
} from 'lucide-react';
import { ScamPhoneRecord } from '../types';
import {
  parseAndValidateCSV,
  CSVParseResult,
  exportRecordsToCSV,
  CSV_EXPORT_HEADERS,
} from '../utils/csvHandler';
import { noSqlDatabase } from '../db/noSqlDatabase';

interface ImportCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (records: ScamPhoneRecord[], summary: string) => void;
  existingRecords: ScamPhoneRecord[];
}

export const ImportCsvModal: React.FC<ImportCsvModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  existingRecords,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parseResult, setParseResult] = useState<CSVParseResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetState = () => {
    setSelectedFile(null);
    setParseResult(null);
    setErrorMessage(null);
    setIsProcessing(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const processFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setSelectedFile(file);
      setParseResult(null);
      setErrorMessage('Invalid file type. Only .csv files are supported. Please upload a properly formatted CSV file.');
      return;
    }

    setSelectedFile(file);
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const text = await file.text();
      const result = parseAndValidateCSV(text);

      setParseResult(result);
      if (!result.success) {
        setErrorMessage(result.error || 'The CSV file contains invalid or random information and was rejected.');
      }
    } catch (err: any) {
      setParseResult(null);
      setErrorMessage(`Failed to read CSV file: ${err.message || 'Unknown read error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    // reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleConfirmImport = async () => {
    if (!parseResult || !parseResult.success || parseResult.records.length === 0) return;

    setIsProcessing(true);
    let backendSynced = false;
    let serverMessage = '';

    try {
      // 1. Attempt to sync with backend API (POST with fallback)
      try {
        let response = await fetch('/api/records/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            records: parseResult.records,
            mode: 'merge',
          }),
        });

        // If reverse proxy/Nginx returned 405 Method Not Allowed, retry with PUT
        if (response.status === 405) {
          response = await fetch('/api/records/restore', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              records: parseResult.records,
              mode: 'merge',
            }),
          });
        }

        if (response.ok) {
          backendSynced = true;
          try {
            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
              const data = await response.json();
              if (data.message) serverMessage = data.message;
            }
          } catch {}
        } else {
          console.warn(`[CSV Import] Server API returned HTTP ${response.status}. Retaining locally in database.`);
        }
      } catch (fetchErr) {
        console.warn('[CSV Import] Backend API unreachable, persisting to client database:', fetchErr);
      }

      // 2. Always persist to client-side built-in NoSQL database and state
      const collection = noSqlDatabase.getRecordsCollection();
      const existingMap = new Map<string, ScamPhoneRecord>();
      collection.getAll().forEach((r) => {
        if (r.cleanPhone) existingMap.set(r.cleanPhone, r);
        else if (r.phone) existingMap.set(r.phone, r);
      });
      parseResult.records.forEach((r) => {
        const key = r.cleanPhone || r.phone;
        if (!key) return;
        const existing = existingMap.get(key);
        existingMap.set(key, existing ? { ...existing, ...r } : r);
      });
      const mergedRecords = Array.from(existingMap.values());
      collection.clear();
      collection.insertMany(mergedRecords);
      noSqlDatabase.persist();

      const summary =
        serverMessage ||
        `Successfully imported ${parseResult.validCount} scam record(s) from CSV!${
          parseResult.rejectedCount > 0 ? ` (${parseResult.rejectedCount} invalid rows were skipped)` : ''
        }${backendSynced ? ' (Synced with server)' : ' (Saved to local database)'}`;

      onImportSuccess(mergedRecords, summary);
      handleClose();
    } catch (err: any) {
      console.error('[CSV Import] Failed to complete import:', err);
      // Fallback to parent state so imported records are never lost
      onImportSuccess(parseResult.records, `Imported ${parseResult.validCount} records into session.`);
      handleClose();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadSampleCsv = () => {
    if (existingRecords.length > 0) {
      // Export current matching format
      exportRecordsToCSV(existingRecords.slice(0, 5), 'sample_export_format.csv');
    } else {
      // Generate blank template
      const sampleContent =
        '\uFEFF' +
        [
          CSV_EXPORT_HEADERS.join(','),
          '"Tech Support / Geek Squad Impersonation","+1 (888) 123-4567","18881234567","Sep 4, 2026, 10:00 AM PDT","https://scammer.info/t/geek-squad/123","Scammer.info","US","Fake invoice renewal email"',
        ].join('\r\n');
      const blob = new Blob([sampleContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'sample_format.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                Import Scam Records from CSV
              </h3>
              <p className="text-xs text-slate-400">
                Upload a CSV matching the export template to merge threat records.
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Required Format Info Box */}
        <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-300">
              <Info className="w-3.5 h-3.5 text-cyan-400" />
              <span>Strict Format Requirement (Matches Export CSV)</span>
            </div>
            <button
              onClick={handleDownloadSampleCsv}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium flex items-center space-x-1 hover:underline cursor-pointer"
            >
              <Download className="w-3 h-3" />
              <span>Download Template</span>
            </button>
          </div>
          <div className="text-[11px] text-slate-400 leading-relaxed font-mono bg-slate-900/90 p-2 rounded-lg border border-slate-800/80 overflow-x-auto whitespace-nowrap">
            {CSV_EXPORT_HEADERS.join(', ')}
          </div>
          <p className="text-[11px] text-slate-400">
            Files with non-matching columns, empty data, or random text without valid phone numbers are automatically rejected.
          </p>
        </div>

        {/* Upload Drop Zone */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
            dragActive
              ? 'border-emerald-500 bg-emerald-500/10'
              : selectedFile && parseResult?.success
              ? 'border-emerald-500/50 bg-emerald-500/5'
              : selectedFile && !parseResult?.success
              ? 'border-red-500/50 bg-red-500/5'
              : 'border-slate-700 hover:border-slate-500 bg-slate-950/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="flex flex-col items-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-300">
              <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-200">
                {selectedFile ? selectedFile.name : 'Click to select CSV or drag and drop here'}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {selectedFile
                  ? `${(selectedFile.size / 1024).toFixed(1)} KB`
                  : 'Supports .csv exported from this app or formatted with the same headers'}
              </p>
            </div>
          </div>
        </div>

        {/* Loading Spinner */}
        {isProcessing && (
          <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800 text-center text-xs text-slate-300 flex items-center justify-center space-x-2">
            <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span>Validating CSV formatting and records...</span>
          </div>
        )}

        {/* Error / Rejection Banner */}
        {errorMessage && !isProcessing && (
          <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl space-y-2 text-xs text-red-300 animate-fadeIn">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-red-200">CSV Rejected</span>
                <p className="text-red-300 whitespace-pre-wrap">{errorMessage}</p>
              </div>
            </div>
            {parseResult && parseResult.rejectedReasons.length > 0 && (
              <div className="mt-2 bg-red-950/40 p-2 rounded-lg border border-red-900/40 text-[11px] text-red-300/90 max-h-28 overflow-y-auto space-y-1">
                <div className="font-semibold text-red-200">Rejection details:</div>
                {parseResult.rejectedReasons.slice(0, 5).map((r, i) => (
                  <div key={i}>&bull; {r}</div>
                ))}
                {parseResult.rejectedReasons.length > 5 && (
                  <div>...and {parseResult.rejectedReasons.length - 5} more invalid row(s).</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Valid Records Preview */}
        {parseResult && parseResult.success && parseResult.records.length > 0 && (
          <div className="space-y-3 animate-fadeIn">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs text-emerald-300">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-semibold">
                  Valid CSV: Found {parseResult.validCount} valid record(s) ready to import.
                </span>
              </div>
              {parseResult.rejectedCount > 0 && (
                <span className="text-[11px] text-amber-400 flex items-center space-x-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span>{parseResult.rejectedCount} skipped</span>
                </span>
              )}
            </div>

            {/* Preview Table */}
            <div className="border border-slate-800 rounded-xl overflow-hidden">
              <div className="bg-slate-950 px-3 py-2 text-[11px] font-semibold text-slate-400 border-b border-slate-800 flex justify-between">
                <span>Preview (First {Math.min(parseResult.records.length, 4)} records)</span>
                <span>Total: {parseResult.records.length} records</span>
              </div>
              <div className="divide-y divide-slate-800 max-h-40 overflow-y-auto bg-slate-900/70 text-xs">
                {parseResult.records.slice(0, 4).map((r, i) => (
                  <div key={i} className="p-2.5 flex items-center justify-between gap-2">
                    <div className="space-y-0.5 min-w-0">
                      <div className="font-bold text-slate-100 font-mono truncate">
                        {r.phone}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {r.scamType} &bull; <span className="text-slate-300">{r.platform}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 shrink-0">
                      {r.countryCode || 'INTL'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={handleClose}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmImport}
            disabled={!parseResult?.success || isProcessing || parseResult.records.length === 0}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white text-xs font-bold rounded-lg shadow transition-colors flex items-center space-x-1.5 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>
              {isProcessing
                ? 'Importing...'
                : parseResult?.success
                ? `Import ${parseResult.validCount} Record(s)`
                : 'Import CSV'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
