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
  'Company Impersonated',
  'Date Detected (PST)',
  'Source URL',
  'Platform',
  'Country',
  'Snippet',
  'Status',
];

/**
 * Parses full multi-line CSV string handling multi-line quoted cells.
 */
function parseFullCSV(text: string): string[][] {
  // Strip UTF-8 BOM if present
  let cleanText = text;
  if (cleanText.charCodeAt(0) === 0xfeff) {
    cleanText = cleanText.slice(1);
  }

  // Detect delimiter from first non-empty line
  const firstLine = cleanText.split(/\r?\n/).find((l) => l.trim().length > 0) || '';
  let delimiter = ',';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  if (semiCount > commaCount && semiCount > tabCount) {
    delimiter = ';';
  } else if (tabCount > commaCount && tabCount > semiCount) {
    delimiter = '\t';
  }

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let curCell = '';
  let inQuotes = false;
  let i = 0;

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
      } else if (char === delimiter) {
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
    `"${(r.impersonatedCompany || 'N/A').replace(/"/g, '""')}"`,
    `"${formatPST(r.detectedAt)}"`,
    `"${(r.sourceUrl || '').replace(/"/g, '""')}"`,
    `"${(r.platform || '').replace(/"/g, '""')}"`,
    `"${r.countryCode || r.countryName || 'GLOBAL'}"`,
    `"${(r.snippet || '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`,
    `"${r.isNumberDown ? 'Out of Service' : 'Active Line'}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\r\n');

  // Prefix with \uFEFF for Excel UTF-8 encoding compatibility
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', blobUrl);
  link.setAttribute(
    'download',
    filename || `scam_threat_records_${pstDateStamp}_PST.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
}

/**
 * Checks if a phone number is a North American toll-free number.
 * Toll-free area codes: 800, 888, 877, 866, 855, 844, 833
 */
export function isTollFreeNumber(phone: string): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (local.length !== 10) return false;
  const tollFreePrefixes = ['800', '888', '877', '866', '855', '844', '833'];
  return tollFreePrefixes.some((p) => local.startsWith(p));
}

/**
 * Strict validation helper to reject fake, dummy, 555-exchange, sequential,
 * repeating digits, or toll-free numbers matching esscan.ai.studio's server rules.
 */
export function isFictitiousOrInvalidPhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return true;
  const clean = phone.replace(/[^0-9+]/g, '');
  const digits = clean.replace(/\D/g, '');

  if (digits.length < 7 || digits.length > 15) return true;
  if (digits.includes('555')) return true;
  if (isTollFreeNumber(phone)) return true;

  const usLocal = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (usLocal.length === 10) {
    const areaCode = usLocal.slice(0, 3);
    const exchange = usLocal.slice(3, 6);
    if (areaCode.startsWith('0') || areaCode.startsWith('1')) return true;
    if (exchange.startsWith('0') || exchange.startsWith('1')) return true;
  }

  if (/(\d)\1{4,}/.test(digits)) return true;

  if (
    digits.includes('123456') ||
    digits.includes('234567') ||
    digits.includes('345678') ||
    digits.includes('456789') ||
    digits.includes('567890') ||
    digits.includes('654321') ||
    digits.includes('765432') ||
    digits.includes('876543') ||
    digits.includes('987654') ||
    digits.includes('012345') ||
    digits.includes('432198') ||
    digits.includes('658321') ||
    digits === '1234567890' ||
    digits === '0987654321'
  ) {
    return true;
  }

  return false;
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
  const companyIndex = normalizedHeaders.findIndex(
    (h) => h === 'companyimpersonated' || h === 'impersonatedcompany' || h === 'company' || h === 'brand'
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
  const statusIndex = normalizedHeaders.findIndex(
    (h) => h === 'status' || h === 'linestatus'
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

    // Strict validation: Reject toll-free numbers
    if (isTollFreeNumber(rawPhone) || isTollFreeNumber(cleanDigits)) {
      rejectedCount++;
      rejectedReasons.push(
        `Row ${rIdx + 1}: Toll-free number "${rawPhone}" rejected. North American toll-free lines are not allowed.`
      );
      continue;
    }

    // Strict validation: Reject fictitious / bad phone numbers
    if (!rawPhone || isFictitiousOrInvalidPhone(rawPhone)) {
      rejectedCount++;
      rejectedReasons.push(
        `Row ${rIdx + 1}: Invalid or fictitious phone number "${rawPhone || 'empty'}". Must be a valid dialable number (no 555-exchanges or sequential digits).`
      );
      continue;
    }

    // Strict validation: Reject unverified Reddit sources
    const rowSource = (
      (sourceUrlIndex >= 0 && row[sourceUrlIndex] ? row[sourceUrlIndex] : '') +
      ' ' +
      (platformIndex >= 0 && row[platformIndex] ? row[platformIndex] : '')
    ).toLowerCase();
    if (rowSource.includes('reddit')) {
      rejectedCount++;
      rejectedReasons.push(
        `Row ${rIdx + 1}: Unverified Reddit source rejected ("${rawPhone}").`
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

    const companyVal =
      companyIndex >= 0 && row[companyIndex] ? row[companyIndex].trim() : 'N/A';
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
    const statusVal =
      statusIndex >= 0 && row[statusIndex] ? row[statusIndex].trim() : '';

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
      impersonatedCompany: companyVal || 'N/A',
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
      isNumberDown: statusVal.toLowerCase().includes('down') || statusVal.toLowerCase().includes('out of service'),
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
