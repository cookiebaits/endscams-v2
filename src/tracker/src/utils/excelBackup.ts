import * as XLSX from 'xlsx';
import { ScamPhoneRecord } from '../types';
import { isPrizeOrExtendedRetentionRecord } from './retentionUtils';

export interface ExcelExportResult {
  success: boolean;
  filename: string;
  count: number;
}

export interface ExcelParseResult {
  success: boolean;
  records: ScamPhoneRecord[];
  error?: string;
  stats: {
    totalRows: number;
    validCount: number;
    invalidCount: number;
  };
}

/**
 * Format records into a structured Excel workbook and prompt download
 */
export function exportRecordsToExcel(
  records: ScamPhoneRecord[],
  customFilename?: string
): ExcelExportResult {
  if (!records || !Array.isArray(records)) {
    throw new Error('Invalid records array provided for Excel export.');
  }

  // Create formatted row objects with human-readable and system-parseable headers
  const exportRows = records.map((r, index) => {
    return {
      'ID': r.id || `rec-${Date.now()}-${index}`,
      'Phone Number': r.phone || '',
      'Clean Phone (WhatsApp Digits)': r.cleanPhone || (r.phone ? r.phone.replace(/\D/g, '') : ''),
      'Country Code': r.countryCode || (r.cleanPhone?.startsWith('1') ? 'US' : 'GLOBAL'),
      'Country Name': r.countryName || (r.countryCode === 'US' ? 'United States' : 'International'),
      'Scam Type / Category': r.scamType || 'Scam Report',
      'Impersonated Brand or Entity': r.impersonatedCompany || 'N/A',
      'Invoice / Reference Number': r.invoiceNumber || 'N/A',
      'Amount Charged': r.amountCharged || 'N/A',
      'Detailed Threat Summary': r.detailedSummary || r.snippet || '',
      'Platform': r.platform || 'Web Source',
      'Source Domain': r.sourceDomain || 'N/A',
      'Source URL': r.sourceUrl || '',
      'Snippet / Evidence Context': r.snippet || '',
      'Search Query': r.searchQuery || 'Automated Harvester',
      'Detected Date & Time (ISO)': r.detectedAt || new Date().toISOString(),
      'Post Date': r.postDate || (r.detectedAt ? r.detectedAt.slice(0, 10) : new Date().toISOString().slice(0, 10)),
      'Number Status (Active/Down)': r.isNumberDown ? 'Down / Inactive' : 'Active',
      'Marked Down At': r.numberDownAt || '',
      'Retention Policy': isPrizeOrExtendedRetentionRecord(r) ? '6 Months (Prize / PCH / Stake.us Scam)' : '60 Days Standard',
      'Confidence': r.confidence || 'High',
      'Notes': r.notes || '',
    };
  });

  // Create worksheet
  const worksheet = XLSX.utils.json_to_sheet(exportRows);

  // Set professional column widths for optimal reading in Excel / LibreOffice / Google Sheets
  worksheet['!cols'] = [
    { wch: 28 }, // ID
    { wch: 22 }, // Phone Number
    { wch: 20 }, // Clean Phone
    { wch: 14 }, // Country Code
    { wch: 18 }, // Country Name
    { wch: 28 }, // Scam Type / Category
    { wch: 26 }, // Impersonated Brand
    { wch: 20 }, // Invoice Number
    { wch: 18 }, // Amount Charged
    { wch: 45 }, // Detailed Threat Summary
    { wch: 22 }, // Platform
    { wch: 24 }, // Source Domain
    { wch: 35 }, // Source URL
    { wch: 40 }, // Snippet / Evidence
    { wch: 28 }, // Search Query
    { wch: 26 }, // Detected Date & Time
    { wch: 14 }, // Post Date
    { wch: 18 }, // Status
    { wch: 26 }, // Marked Down At
    { wch: 14 }, // Confidence
    { wch: 30 }, // Notes
  ];

  // Create workbook and append sheets
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Scam Threat Database');

  // Add Metadata Sheet for site restoration reference
  const metaRows = [
    { 'Property': 'Export Title', 'Value': 'End Scam Threat Intelligence Database Backup' },
    { 'Property': 'Export Date & Time (UTC)', 'Value': new Date().toISOString() },
    { 'Property': 'Total Records Exported', 'Value': records.length },
    { 'Property': 'Backup Format Version', 'Value': '1.0' },
    { 'Property': 'Restore Compatibility', 'Value': 'Compatible with End Scam Threat Harvester 1-Click Restore' },
    { 'Property': 'Active Records', 'Value': records.filter((r) => !r.isNumberDown).length },
    { 'Property': 'Numbers Down (Inactive)', 'Value': records.filter((r) => r.isNumberDown).length },
    { 'Property': 'Retention Policy', 'Value': '60-Day Historical Database' },
  ];
  const metaSheet = XLSX.utils.json_to_sheet(metaRows);
  metaSheet['!cols'] = [{ wch: 30 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(workbook, metaSheet, 'Backup Info');

  // Compute timestamped filename
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = customFilename || `EndScamScan_Database_Backup_${dateStr}.xlsx`;

  // Write and trigger download
  XLSX.writeFile(workbook, filename);

  return {
    success: true,
    filename,
    count: records.length,
  };
}

/**
 * Parses an uploaded Excel (.xlsx, .xls) file and converts it into validated ScamPhoneRecord items
 */
export async function parseExcelBackupFile(file: File): Promise<ExcelParseResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          return resolve({
            success: false,
            records: [],
            error: 'The Excel file contains no worksheets.',
            stats: { totalRows: 0, validCount: 0, invalidCount: 0 },
          });
        }

        // Prefer 'Scam Threat Database' sheet if present, otherwise first non-metadata sheet
        let targetSheetName = workbook.SheetNames[0];
        if (workbook.SheetNames.includes('Scam Threat Database')) {
          targetSheetName = 'Scam Threat Database';
        } else if (targetSheetName === 'Backup Info' && workbook.SheetNames.length > 1) {
          targetSheetName = workbook.SheetNames[1];
        }

        const worksheet = workbook.Sheets[targetSheetName];
        if (!worksheet) {
          return resolve({
            success: false,
            records: [],
            error: 'Unable to read data sheet from the Excel file.',
            stats: { totalRows: 0, validCount: 0, invalidCount: 0 },
          });
        }

        // Convert sheet to array of objects
        const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

        if (!rawRows || rawRows.length === 0) {
          return resolve({
            success: false,
            records: [],
            error: 'No data rows found in the selected Excel worksheet.',
            stats: { totalRows: 0, validCount: 0, invalidCount: 0 },
          });
        }

        const validRecords: ScamPhoneRecord[] = [];
        let invalidCount = 0;

        rawRows.forEach((row, index) => {
          // Normalize column keys to lowercase without whitespace or punctuation for resilient mapping
          const normalizedRow: Record<string, any> = {};
          Object.keys(row).forEach((key) => {
            const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
            normalizedRow[cleanKey] = row[key];
          });

          // Helper to check multiple key variations
          const getValue = (...keys: string[]): string => {
            for (const k of keys) {
              const cleaned = k.toLowerCase().replace(/[^a-z0-9]/g, '');
              if (normalizedRow[cleaned] !== undefined && String(normalizedRow[cleaned]).trim() !== '') {
                return String(normalizedRow[cleaned]).trim();
              }
            }
            return '';
          };

          // Extract phone
          const rawPhone = getValue(
            'phone number',
            'phone',
            'telephone',
            'number',
            'phonenumber',
            'clean phone (whatsapp digits)',
            'clean phone',
            'cleanphone'
          );

          const digits = rawPhone.replace(/\D/g, '');
          if (!rawPhone || digits.length < 7) {
            invalidCount++;
            return;
          }

          // Extract clean phone
          let cleanPhone = getValue(
            'clean phone (whatsapp digits)',
            'clean phone',
            'cleanphone',
            'digits'
          );
          if (!cleanPhone || cleanPhone.replace(/\D/g, '').length < 7) {
            cleanPhone = digits;
          } else {
            cleanPhone = cleanPhone.replace(/\D/g, '');
          }

          // Extract ID or generate a unique deterministic one
          const id = getValue('id', 'record id', 'recordid') || `rec-restored-${Date.now()}-${index}`;

          // Extract Status
          const statusVal = getValue('number status (active/down)', 'status', 'isnumberdown', 'down').toLowerCase();
          const isNumberDown = statusVal.includes('down') || statusVal === 'true' || statusVal === 'yes' || statusVal === '1';

          // Extract timestamps
          let detectedAt = getValue('detected date & time (iso)', 'detected at', 'detectedat', 'timestamp', 'date');
          if (!detectedAt || isNaN(new Date(detectedAt).getTime())) {
            detectedAt = new Date().toISOString();
          }

          let postDate = getValue('post date', 'postdate', 'date');
          if (!postDate || postDate.length < 8) {
            postDate = detectedAt.slice(0, 10);
          }

          // Extract Country
          let countryCode = getValue('country code', 'countrycode', 'code');
          let countryName = getValue('country name', 'country', 'countryname');
          if (!countryCode) {
            if (cleanPhone.startsWith('1') && cleanPhone.length === 11) {
              countryCode = 'US';
              countryName = countryName || 'United States';
            } else if (cleanPhone.startsWith('234')) {
              countryCode = 'NG';
              countryName = countryName || 'Nigeria';
            } else if (cleanPhone.startsWith('254')) {
              countryCode = 'KE';
              countryName = countryName || 'Kenya';
            } else if (cleanPhone.startsWith('27')) {
              countryCode = 'ZA';
              countryName = countryName || 'South Africa';
            } else if (cleanPhone.startsWith('233')) {
              countryCode = 'GH';
              countryName = countryName || 'Ghana';
            } else if (cleanPhone.startsWith('260')) {
              countryCode = 'ZM';
              countryName = countryName || 'Zambia';
            } else {
              countryCode = 'GLOBAL';
              countryName = countryName || 'International';
            }
          }

          const record: ScamPhoneRecord = {
            id,
            phone: rawPhone,
            cleanPhone,
            countryCode,
            countryName,
            scamType: getValue('scam type / category', 'scam type', 'scamtype', 'category', 'type') || 'Scam Threat Report',
            impersonatedCompany: getValue('impersonated brand or entity', 'impersonated company', 'impersonatedcompany', 'company', 'brand') || 'N/A',
            invoiceNumber: getValue('invoice / reference number', 'invoice number', 'invoicenumber', 'invoice', 'reference') || 'N/A',
            amountCharged: getValue('amount charged', 'amountcharged', 'amount', 'fee') || 'N/A',
            detailedSummary: getValue('detailed threat summary', 'detailed summary', 'detailedsummary', 'summary', 'description') || getValue('snippet / evidence context', 'snippet') || 'Restored threat intelligence record.',
            platform: getValue('platform', 'source', 'source platform') || 'Restored Source',
            sourceDomain: getValue('source domain', 'sourcedomain', 'domain') || 'N/A',
            sourceUrl: getValue('source url', 'sourceurl', 'url', 'link') || '',
            snippet: getValue('snippet / evidence context', 'snippet', 'evidence', 'context') || '',
            searchQuery: getValue('search query', 'searchquery', 'query') || 'Excel Database Restore',
            detectedAt,
            postDate,
            isNumberDown,
            numberDownAt: getValue('marked down at', 'number down at', 'numberdownat') || (isNumberDown ? detectedAt : undefined),
            confidence: (getValue('confidence', 'level') as any) || 'High',
            notes: getValue('notes', 'comments', 'note') || undefined,
            updatedAt: new Date().toISOString(),
          };

          validRecords.push(record);
        });

        if (validRecords.length === 0) {
          return resolve({
            success: false,
            records: [],
            error: 'No valid scam records with valid phone numbers could be extracted from this Excel file.',
            stats: { totalRows: rawRows.length, validCount: 0, invalidCount },
          });
        }

        return resolve({
          success: true,
          records: validRecords,
          stats: {
            totalRows: rawRows.length,
            validCount: validRecords.length,
            invalidCount,
          },
        });
      } catch (err: any) {
        console.error('[Excel Parse Error]', err);
        return resolve({
          success: false,
          records: [],
          error: `Failed to parse Excel file: ${err.message || 'Unknown error'}`,
          stats: { totalRows: 0, validCount: 0, invalidCount: 0 },
        });
      }
    };

    reader.onerror = () => {
      resolve({
        success: false,
        records: [],
        error: 'Error reading the uploaded file from your computer.',
        stats: { totalRows: 0, validCount: 0, invalidCount: 0 },
      });
    };

    reader.readAsArrayBuffer(file);
  });
}
