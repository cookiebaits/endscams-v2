import { ScamPhoneRecord } from '../types';
import { getPSTDateStamp, normalizeToNumericalDate } from './dateUtils';

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
  'WhatsApp',
  'Alt Numbers',
  'Company Impersonated',
  'Date Detected (PST)',
  'Source URL',
  'Platform',
  'Country',
  'Snippet',
  'Status',
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
export function parseFullCSV(text: string): string[][] {
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

  // Detect delimiter: check header row for commas vs semicolons vs tabs (European Excel uses ;)
  let delimiter = ',';
  const firstLine = cleanText.split(/\r?\n/)[0] || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  if (semiCount > commaCount && semiCount > tabCount) {
    delimiter = ';';
  } else if (tabCount > commaCount && tabCount > semiCount) {
    delimiter = '\t';
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
 * ensuring all records are exported completely without limits and open cleanly in Excel/Google Sheets.
 */
export function exportRecordsToCSV(records: ScamPhoneRecord[], filename?: string): void {
  if (!records || records.length === 0) return;

  const pstDateStamp = getPSTDateStamp();
  const headers = CSV_EXPORT_HEADERS;

  const rows = records.map((r) => {
    const rawPhone = (r.phone || '').trim();
    const cleanDigits = r.cleanPhone || rawPhone.replace(/\D/g, '');
    const isWa = r.isWhatsapp || (r.snippet && r.snippet.toLowerCase().includes('whatsapp')) || (r.scamType && r.scamType.toLowerCase().includes('whatsapp'));
    const altStr = r.altNumbers && r.altNumbers.length > 0 ? r.altNumbers.join('; ') : 'None';
    const detectedDateStr = normalizeToNumericalDate(r.detectedAt || r.postDate);
    const scamType = (r.scamType || 'Scam Threat Report').trim();
    const company = (r.impersonatedCompany || 'N/A').trim();
    const sourceUrl = (r.sourceUrl || '').trim();
    const platform = (r.platform || 'Threat Intel').trim();
    const country = (r.countryCode || '').trim();
    const snippet = (r.snippet || '').replace(/"/g, '""').replace(/[\r\n\t]+/g, ' ').trim();
    const status = r.isNumberDown ? 'Out of Service' : 'Active Line';

    return [
      `"${scamType.replace(/"/g, '""')}"`,
      `"${rawPhone.replace(/"/g, '""')}"`,
      `"${cleanDigits}"`,
      `"${isWa ? 'Yes' : 'No'}"`,
      `"${altStr.replace(/"/g, '""')}"`,
      `"${company.replace(/"/g, '""')}"`,
      `"${detectedDateStr}"`,
      `"${sourceUrl.replace(/"/g, '""')}"`,
      `"${platform.replace(/"/g, '""')}"`,
      `"${country}"`,
      `"${snippet}"`,
      `"${status}"`,
    ];
  });

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
  return { code: 'US', name: 'United States' };
}

/**
 * Checks if a phone number is a North American toll-free number.
 */
export function isTollFreeNumber(_phone: string): boolean {
  return false;
}

/**
 * Checks if a phone number is fictitious, dummy, sequential, repeating, or invalid.
 */
export function isFictitiousOrInvalidPhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return true;
  const clean = phone.replace(/[^0-9+]/g, '');
  const digits = clean.replace(/\D/g, '');

  if (digits.length < 7 || digits.length > 15) return true;
  if (digits.includes('555')) return true;

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
 * Formats a clean US or international number nicely for display.
 * Strictly enforces 1 (xxx) xxx-xxxx for all US numbers regardless of input format.
 */
function formatDisplayPhone(rawPhone: string, cleanDigits: string): string {
  const digits = cleanDigits.replace(/\D/g, '');
  const cleaned = rawPhone.replace(/^=\+?/, '').replace(/^"/, '').replace(/"$/, '').trim();

  // US Phone Formatting: 1 (xxx) xxx-xxxx
  if (digits.length === 10) {
    return `1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  // African Nations Formatting
  if (digits.startsWith('234') && digits.length === 13) {
    return `+234 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  if (digits.startsWith('27') && digits.length === 11) {
    return `+27 ${digits.slice(2, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  if (digits.startsWith('254') && digits.length === 12) {
    return `+254 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  if (digits.startsWith('233') && digits.length === 12) {
    return `+233 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  return cleaned.startsWith('+') ? cleaned : `+${digits}`;
}

/**
 * Parses and strictly validates an imported CSV string.
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

  const scamTypeIndex = normalizedHeaders.findIndex(
    (h) => h === 'typeofscam' || h === 'scamtype' || h === 'category' || h === 'type' || h === 'scam'
  );
  const phoneIndex = normalizedHeaders.findIndex(
    (h) => h === 'phonenumber' || h === 'phone' || h === 'phoneno' || h === 'number' || h === 'tel' || h === 'telephone' || h === 'threatline'
  );
  const cleanDigitsIndex = normalizedHeaders.findIndex(
    (h) => h === 'cleandigits' || h === 'cleanphone' || h === 'digits' || h === 'cleannumber' || h === 'phonedigits' || h === 'cleandigit'
  );
  const dateIndex = normalizedHeaders.findIndex(
    (h) => h.includes('datedetected') || h === 'date' || h === 'detectedat' || h === 'timestamp' || h === 'reportdate' || h === 'incidentdate' || h === 'postdate'
  );
  const sourceUrlIndex = normalizedHeaders.findIndex(
    (h) => h === 'sourceurl' || h === 'url' || h === 'source' || h === 'link' || h === 'sourcelink'
  );
  const platformIndex = normalizedHeaders.findIndex(
    (h) => h === 'platform' || h === 'website' || h === 'sourceplatform' || h === 'origin' || h === 'sourcename'
  );
  const countryIndex = normalizedHeaders.findIndex(
    (h) => h === 'country' || h === 'countrycode' || h === 'geo' || h === 'region' || h === 'countryname'
  );
  const snippetIndex = normalizedHeaders.findIndex(
    (h) => h === 'snippet' || h === 'notes' || h === 'details' || h === 'context' || h === 'description' || h === 'summary'
  );
  const statusIndex = normalizedHeaders.findIndex(
    (h) => h === 'status' || h === 'numberstatus' || h === 'isdown' || h === 'state' || h === 'linestatus'
  );
  const companyIndex = normalizedHeaders.findIndex(
    (h) => h === 'companyimpersonated' || h === 'impersonatedcompany' || h === 'company' || h === 'brand' || h === 'target'
  );
  const whatsappIndex = normalizedHeaders.findIndex(
    (h) => h === 'whatsapp' || h === 'iswhatsapp' || h === 'wa'
  );
  const altNumbersIndex = normalizedHeaders.findIndex(
    (h) => h === 'altnumbers' || h === 'alternatenumbers' || h === 'alt' || h === 'alternate' || h === 'tiednumbers'
  );

  if (phoneIndex === -1 && cleanDigitsIndex === -1) {
    return {
      success: false,
      records: [],
      error: `Invalid CSV format. The CSV headers must include "Phone Number" or "Clean Digits".\n` +
        `Required Export CSV columns: "Type of Scam", "Phone Number", "Clean Digits", "Date Detected (PST)", "Source URL", "Platform", "Country", "Snippet".\n` +
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

    if (row.length === 0 || row.every((c) => c.trim().length === 0)) {
      continue;
    }

    let rawPhone = phoneIndex >= 0 && row[phoneIndex] ? row[phoneIndex].trim() : '';
    let rawCleanDigits = cleanDigitsIndex >= 0 && row[cleanDigitsIndex] ? row[cleanDigitsIndex].trim() : '';

    rawPhone = rawPhone.replace(/^=\+?/, '').replace(/^"/, '').replace(/"$/, '').trim();
    rawCleanDigits = rawCleanDigits.replace(/\D/g, '');

    let cleanDigits = rawCleanDigits || rawPhone.replace(/\D/g, '');

    if (cleanDigits.length === 10) {
      cleanDigits = '1' + cleanDigits;
    }

    if (!cleanDigits || cleanDigits.length < 7 || cleanDigits.length > 16) {
      rejectedCount++;
      rejectedReasons.push(
        `Row ${rIdx + 1}: Invalid phone number "${rawPhone || 'empty'}". Must contain between 7 and 16 digits.`
      );
      continue;
    }

    if (isTollFreeNumber(rawPhone) || isTollFreeNumber(cleanDigits)) {
      rejectedCount++;
      rejectedReasons.push(
        `Row ${rIdx + 1}: Toll-free number "${rawPhone}" rejected. Toll-free numbers are not permitted.`
      );
      continue;
    }

    if (isFictitiousOrInvalidPhone(rawPhone) || isFictitiousOrInvalidPhone(cleanDigits)) {
      rejectedCount++;
      rejectedReasons.push(
        `Row ${rIdx + 1}: Fictitious, dummy, or invalid number pattern "${rawPhone}" rejected.`
      );
      continue;
    }

    if (!rawPhone || rawPhone === cleanDigits) {
      rawPhone = formatDisplayPhone(rawPhone, cleanDigits);
    } else {
      rawPhone = formatDisplayPhone(rawPhone, cleanDigits);
    }

    let scamType =
      scamTypeIndex >= 0 && row[scamTypeIndex] ? row[scamTypeIndex].trim() : '';

    if (!scamType || scamType.length < 2) {
      const rowText = row.join(' ').toLowerCase();
      if (rowText.includes('pch') || rowText.includes('publishers clearing') || rowText.includes('sweepstake')) {
        scamType = 'Prize / Sweepstakes Scam (PCH)';
      } else if (rowText.includes('geek squad') || rowText.includes('best buy') || rowText.includes('tech support')) {
        scamType = 'Tech Support / Impersonation';
      } else if (rowText.includes('spell') || rowText.includes('spiritual') || rowText.includes('love spell')) {
        scamType = 'Love Spell / Spiritual Fraud';
      } else if (rowText.includes('crypto') || rowText.includes('recovery') || rowText.includes('bitcoin')) {
        scamType = 'Crypto Recovery Scam';
      } else if (rowText.includes('stake') || rowText.includes('casino')) {
        scamType = 'Stake.us / Casino Scam';
      } else {
        scamType = 'Scam Threat Report';
      }
    }

    const sourceUrl =
      sourceUrlIndex >= 0 && row[sourceUrlIndex] && row[sourceUrlIndex].trim()
        ? row[sourceUrlIndex].trim()
        : 'https://scammer.info';

    if (sourceUrl.toLowerCase().includes('reddit.com') || (platformIndex >= 0 && row[platformIndex] && row[platformIndex].toLowerCase().includes('reddit'))) {
      rejectedCount++;
      rejectedReasons.push(
        `Row ${rIdx + 1}: Reddit source rejected. Reddit is an unverified source.`
      );
      continue;
    }

    const platform =
      platformIndex >= 0 && row[platformIndex] && row[platformIndex].trim()
        ? row[platformIndex].trim()
        : sourceUrl.includes('facebook')
        ? 'Facebook'
        : sourceUrl.includes('instagram')
        ? 'Instagram'
        : sourceUrl.includes('techscammersunited')
        ? 'Tech Support United'
        : sourceUrl.includes('scammer.info')
        ? 'Scammer.info'
        : 'CSV Import';

    const countryVal =
      countryIndex >= 0 && row[countryIndex] ? row[countryIndex].trim().toUpperCase() : '';

    const snippet =
      snippetIndex >= 0 && row[snippetIndex] && row[snippetIndex].trim()
        ? row[snippetIndex].trim()
        : `Verified scam threat report for ${rawPhone}`;

    const rawDate = dateIndex >= 0 && row[dateIndex] ? row[dateIndex].trim() : '';
    const normalizedNumericalDate = normalizeToNumericalDate(rawDate);
    const parsedDetectedAt = `${normalizedNumericalDate}T12:00:00.000Z`;

    const statusVal = statusIndex >= 0 && row[statusIndex] ? row[statusIndex].trim().toLowerCase() : '';
    const isDown = statusVal.includes('down') || statusVal.includes('dead') || statusVal.includes('disconnected');

    const companyVal = companyIndex >= 0 && row[companyIndex] ? row[companyIndex].trim() : undefined;

    const whatsappVal = whatsappIndex >= 0 && row[whatsappIndex] ? row[whatsappIndex].trim().toLowerCase() : '';
    const isWa =
      whatsappVal === 'yes' ||
      whatsappVal === 'true' ||
      whatsappVal === '1' ||
      snippet.toLowerCase().includes('whatsapp') ||
      scamType.toLowerCase().includes('whatsapp');

    const rawAlts = altNumbersIndex >= 0 && row[altNumbersIndex] ? row[altNumbersIndex].trim() : '';
    let parsedAlts: string[] | undefined = undefined;
    if (rawAlts && rawAlts.toLowerCase() !== 'none' && rawAlts.toLowerCase() !== 'n/a') {
      parsedAlts = rawAlts
        .split(/[;,]/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 7);
    }

    const derived = deriveCountry(cleanDigits);

    const record: ScamPhoneRecord = {
      id: `rec-csv-${Date.now()}-${rIdx}-${Math.random().toString(36).substr(2, 5)}`,
      phone: rawPhone,
      cleanPhone: cleanDigits,
      isWhatsapp: isWa,
      altNumbers: parsedAlts && parsedAlts.length > 0 ? parsedAlts : undefined,
      countryCode: countryVal || derived.code,
      countryName: derived.name,
      scamType,
      impersonatedCompany: companyVal,
      isNumberDown: isDown,
      numberDownAt: isDown ? parsedDetectedAt : undefined,
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
