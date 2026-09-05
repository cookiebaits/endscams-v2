import { ScamPhoneRecord } from '../types';
import { formatPST, getPSTDateStamp } from './dateUtils';

export interface CSVParseResult {
  success: boolean;
  records: ScamPhoneRecord[];
  error?: string;
  totalRows: number;
  validCount: number;
  rejectedCount: number;
  rejectedReasons: string[];
}

export const CSV_EXPORT_HEADERS = [
  'Type of Scam',
  'Phone Number',
  'Clean Digits',
  'Date Detected (PST)',
  'Source URL',
  'Platform',
  'Country',
  'Snippet',
];

/**
 * Robust RFC-compliant CSV line parser handling quotes, commas, and escaped quotes.
 */
export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          // Escaped quote ""
          cur += '"';
          i += 2;
          continue;
        } else {
          // Closing quote
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        cur += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      } else if (char === ',') {
        result.push(cur);
        cur = '';
        i++;
        continue;
      } else {
        cur += char;
        i++;
        continue;
      }
    }
  }

  result.push(cur);
  return result;
}

/**
 * Parses full multi-line CSV string handling multi-line quoted cells.
 */
function parseFullCSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let curCell = '';
  let inQuotes = false;
  let i = 0;

  // Strip UTF-8 BOM if present
  let cleanText = text;
  if (cleanText.charCodeAt(0) === 0xfeff) {
    cleanText = cleanText.slice(1);
  }

  while (i < cleanText.length) {
    const char = cleanText[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < cleanText.length && cleanText[i + 1] === '"') {
          curCell += '"';
          i += 2;
          continue;
        } else {
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        curCell += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      } else if (char === ',') {
        currentRow.push(curCell);
        curCell = '';
        i++;
        continue;
      } else if (char === '\r') {
        if (i + 1 < cleanText.length && cleanText[i + 1] === '\n') {
          i++;
        }
        currentRow.push(curCell);
        curCell = '';
        if (currentRow.some((c) => c.trim().length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        i++;
        continue;
      } else if (char === '\n') {
        currentRow.push(curCell);
        curCell = '';
        if (currentRow.some((c) => c.trim().length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        i++;
        continue;
      } else {
        curCell += char;
        i++;
        continue;
      }
    }
  }

  if (curCell.length > 0 || currentRow.length > 0) {
    currentRow.push(curCell);
    if (currentRow.some((c) => c.trim().length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Exports records to a CSV file.
 * Uses a UTF-8 BOM and Blob download to prevent character truncation from '#' in tags/URLs,
 * ensuring all records are exported completely without limits.
 */
export function exportRecordsToCSV(records: ScamPhoneRecord[], filename?: string): void {
  if (!records || records.length === 0) return;

  const pstDateStamp = getPSTDateStamp();
  const headers = CSV_EXPORT_HEADERS;

  const rows = records.map((r) => [
    `"${(r.scamType || '').replace(/"/g, '""')}"`,
    `"${(r.phone || '').replace(/"/g, '""')}"`,
    `"${r.cleanPhone || (r.phone || '').replace(/\D/g, '')}"`,
    `"${formatPST(r.detectedAt)}"`,
    `"${(r.sourceUrl || '').replace(/"/g, '""')}"`,
    `"${(r.platform || '').replace(/"/g, '""')}"`,
    `"${r.countryCode || ''}"`,
    `"${(r.snippet || '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\r\n');

  // Prefix with \uFEFF for Excel UTF-8 encoding compatibility
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', blobUrl);
  link.setAttribute(
    'download',
    filename || `scam_phone_numbers_${pstDateStamp}_PST.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
}

/**
 * Normalizes header string for comparison.
 */
function normalizeHeader(h: string): string {
  return h.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

/**
 * Derives country code and name from phone number digits.
 */
function deriveCountry(cleanPhone: string): { code: string; name: string } {
  if (cleanPhone.startsWith('1') && cleanPhone.length === 11) {
    return { code: 'US', name: 'United States' };
  }
  if (cleanPhone.startsWith('234')) return { code: 'NG', name: 'Nigeria' };
  if (cleanPhone.startsWith('44')) return { code: 'GB', name: 'United Kingdom' };
  if (cleanPhone.startsWith('91')) return { code: 'IN', name: 'India' };
  if (cleanPhone.startsWith('27')) return { code: 'ZA', name: 'South Africa' };
  if (cleanPhone.startsWith('254')) return { code: 'KE', name: 'Kenya' };
  if (cleanPhone.startsWith('233')) return { code: 'GH', name: 'Ghana' };
  if (cleanPhone.startsWith('229')) return { code: 'BJ', name: 'Benin' };
  if (cleanPhone.startsWith('61')) return { code: 'AU', name: 'Australia' };
  if (cleanPhone.length === 10) return { code: 'US', name: 'United States' };
  return { code: 'Unknown', name: 'International' };
}

/**
 * Parses and strictly validates an imported CSV string.
 * Must match the formatting of the Export CSV:
 * Headers: Type of Scam, Phone Number, Clean Digits, Date Detected (PST), Source URL, Platform, Country, Snippet
 * Rejects random information, invalid files, or missing core data.
 */
export function parseAndValidateCSV(fileContent: string): CSVParseResult {
  const trimmed = fileContent.trim();
  if (!trimmed) {
    return {
      success: false,
      records: [],
      error: 'The uploaded file is empty. Please upload a valid CSV file.',
      totalRows: 0,
      validCount: 0,
      rejectedCount: 0,
      rejectedReasons: ['Empty file'],
    };
  }

  const rawRows = parseFullCSV(trimmed);
  if (rawRows.length < 2) {
    return {
      success: false,
      records: [],
      error: 'The CSV must contain a header row and at least one data row.',
      totalRows: rawRows.length,
      validCount: 0,
      rejectedCount: 0,
      rejectedReasons: ['No data rows found'],
    };
  }

  // Verify headers
  const headerRow = rawRows[0];
  const normalizedHeaders = headerRow.map(normalizeHeader);

  // Expected headers:
  // 'typeofscam', 'phonenumber', 'cleandigits', 'datedetectedpst', 'sourceurl', 'platform', 'country', 'snippet'
  const scamTypeIndex = normalizedHeaders.findIndex(
    (h) => h === 'typeofscam' || h === 'scamtype' || h === 'category'
  );
  const phoneIndex = normalizedHeaders.findIndex(
    (h) => h === 'phonenumber' || h === 'phone' || h === 'phoneno' || h === 'number'
  );
  const dateIndex = normalizedHeaders.findIndex(
    (h) => h.includes('datedetected') || h === 'date' || h === 'detectedat'
  );
  const sourceUrlIndex = normalizedHeaders.findIndex(
    (h) => h === 'sourceurl' || h === 'url' || h === 'source'
  );
  const platformIndex = normalizedHeaders.findIndex(
    (h) => h === 'platform' || h === 'website' || h === 'sourceplatform'
  );
  const countryIndex = normalizedHeaders.findIndex(
    (h) => h === 'country' || h === 'countrycode'
  );
  const snippetIndex = normalizedHeaders.findIndex(
    (h) => h === 'snippet' || h === 'notes' || h === 'details' || h === 'context'
  );

  // Strict schema check: At least Type of Scam and Phone Number must be present,
  // and the file must structurally resemble the exported CSV (e.g. matching headers)
  if (scamTypeIndex === -1 || phoneIndex === -1) {
    return {
      success: false,
      records: [],
      error: `Invalid CSV format. The CSV headers must match the export CSV columns:\n` +
        `"Type of Scam", "Phone Number", "Clean Digits", "Date Detected (PST)", "Source URL", "Platform", "Country", "Snippet".\n` +
        `Found headers: [${headerRow.join(', ')}]`,
      totalRows: rawRows.length - 1,
      validCount: 0,
      rejectedCount: rawRows.length - 1,
      rejectedReasons: ['Header columns do not match the required Export CSV format.'],
    };
  }

  const records: ScamPhoneRecord[] = [];
  const rejectedReasons: string[] = [];
  let rejectedCount = 0;

  for (let rIdx = 1; rIdx < rawRows.length; rIdx++) {
    const row = rawRows[rIdx];

    // Check if empty row
    if (row.length === 0 || row.every((c) => c.trim().length === 0)) {
      continue;
    }

    const rawPhone = phoneIndex >= 0 && row[phoneIndex] ? row[phoneIndex].trim() : '';
    const cleanDigits = rawPhone.replace(/\D/g, '');

    // Strict validation: Reject if phone number is missing, random text, or fewer than 7 digits
    if (!rawPhone || cleanDigits.length < 7 || cleanDigits.length > 16) {
      rejectedCount++;
      rejectedReasons.push(
        `Row ${rIdx + 1}: Invalid phone number "${rawPhone || 'empty'}". Must contain between 7 and 16 digits.`
      );
      continue;
    }

    const scamType =
      scamTypeIndex >= 0 && row[scamTypeIndex] ? row[scamTypeIndex].trim() : 'Scam Threat Report';
    
    // Check if scamType is just random punctuation or nonsense
    if (scamType.length < 2) {
      rejectedCount++;
      rejectedReasons.push(`Row ${rIdx + 1}: Missing or invalid "Type of Scam" value.`);
      continue;
    }

    const sourceUrl =
      sourceUrlIndex >= 0 && row[sourceUrlIndex]
        ? row[sourceUrlIndex].trim()
        : 'https://scammer.info';
    const platform =
      platformIndex >= 0 && row[platformIndex] ? row[platformIndex].trim() : 'CSV Import';
    const countryVal =
      countryIndex >= 0 && row[countryIndex] ? row[countryIndex].trim() : '';
    const snippet =
      snippetIndex >= 0 && row[snippetIndex] ? row[snippetIndex].trim() : 'Imported via CSV';

    const rawDate = dateIndex >= 0 && row[dateIndex] ? row[dateIndex].trim() : '';
    let parsedDetectedAt = new Date().toISOString();
    if (rawDate) {
      const parsedTime = Date.parse(rawDate);
      if (!isNaN(parsedTime)) {
        parsedDetectedAt = new Date(parsedTime).toISOString();
      }
    }

    const derived = deriveCountry(cleanDigits);

    const record: ScamPhoneRecord = {
      id: `rec-csv-${Date.now()}-${rIdx}-${Math.random().toString(36).substr(2, 5)}`,
      phone: rawPhone,
      cleanPhone: cleanDigits,
      countryCode: countryVal || derived.code,
      countryName: derived.name,
      scamType,
      sourceUrl: sourceUrl || 'https://scammer.info',
      sourceDomain: sourceUrl.includes('//')
        ? sourceUrl.split('/')[2].replace('www.', '')
        : 'csv-import',
      platform: platform || 'CSV Import',
      snippet: snippet || 'Imported from CSV file',
      searchQuery: 'CSV Import',
      detectedAt: parsedDetectedAt,
      postDate: parsedDetectedAt.slice(0, 10),
      confidence: 'High',
    };

    records.push(record);
  }

  // If zero valid records were found, reject the file completely
  if (records.length === 0) {
    return {
      success: false,
      records: [],
      error:
        'Import Rejected: No valid scam phone entries found in the file. All rows contained random, non-matching, or invalid information.',
      totalRows: rawRows.length - 1,
      validCount: 0,
      rejectedCount,
      rejectedReasons,
    };
  }

  return {
    success: true,
    records,
    totalRows: rawRows.length - 1,
    validCount: records.length,
    rejectedCount,
    rejectedReasons,
  };
}
