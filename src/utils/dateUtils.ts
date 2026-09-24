/**
 * Pacific Time (PST/PDT) utilities to ensure consistent timezone formatting across the entire app.
 */

export const PACIFIC_TIMEZONE = 'America/Los_Angeles';

/**
 * Format any ISO string, timestamp, or Date object into a readable Pacific Time string (e.g. "Aug 15, 2026, 12:19 PM PST")
 */
export function formatPST(dateInput?: string | number | Date | null, includeSeconds = false): string {
  if (!dateInput) return 'N/A';
  try {
    if (typeof dateInput === 'string') {
      const trimmed = dateInput.trim();
      // If it's a date-only YYYY-MM-DD string with no time, format without midnight UTC drift
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        const [y, m, d] = trimmed.split('-').map(Number);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[m - 1]} ${String(d).padStart(2, '0')}, ${y}`;
      }
    }

    const date = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (isNaN(date.getTime())) return String(dateInput);

    const options: Intl.DateTimeFormatOptions = {
      timeZone: PACIFIC_TIMEZONE,
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    };

    if (includeSeconds) {
      options.second = '2-digit';
    }

    return date.toLocaleString('en-US', options) + ' PST';
  } catch (err) {
    return String(dateInput);
  }
}

/**
 * Format date only in Pacific Time (e.g. "Aug 15, 2026")
 */
export function formatPSTDateOnly(dateInput?: string | number | Date | null): string {
  if (!dateInput) return 'N/A';
  try {
    if (typeof dateInput === 'string') {
      const trimmed = dateInput.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        const [y, m, d] = trimmed.split('-').map(Number);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[m - 1]} ${String(d).padStart(2, '0')}, ${y}`;
      }
    }

    const date = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (isNaN(date.getTime())) return String(dateInput);

    return date.toLocaleDateString('en-US', {
      timeZone: PACIFIC_TIMEZONE,
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  } catch (err) {
    return String(dateInput);
  }
}

/**
 * Format time only in Pacific Time (e.g. "7:00:00 AM PST")
 */
export function formatPSTTimeOnly(dateInput: Date = new Date(), includeSeconds = true): string {
  try {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: PACIFIC_TIMEZONE,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    };
    if (includeSeconds) {
      options.second = '2-digit';
    }
    return dateInput.toLocaleTimeString('en-US', options) + ' PST';
  } catch (err) {
    return dateInput.toLocaleTimeString();
  }
}

/**
 * Get current date string in Pacific Time formatted as YYYY-MM-DD for file exports
 */
export function getPSTDateStamp(dateInput: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: PACIFIC_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(dateInput);
  } catch (err) {
    return dateInput.toISOString().slice(0, 10);
  }
}

/**
 * Get Pacific Time components (hour 0-23, minute, day, etc.)
 */
export function getPacificParts(date: Date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PACIFIC_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  let year = '', month = '', day = '', hour = 0, minute = 0, second = 0;
  for (const part of parts) {
    if (part.type === 'year') year = part.value;
    if (part.type === 'month') month = part.value;
    if (part.type === 'day') day = part.value;
    if (part.type === 'hour') hour = parseInt(part.value, 10);
    if (part.type === 'minute') minute = parseInt(part.value, 10);
    if (part.type === 'second') second = parseInt(part.value, 10);
  }

  return { year, month, day, hour, minute, second, dateStr: `${year}-${month}-${day}` };
}

/**
 * Normalizes any date string (textual, slash, ISO, truncated "Sep 01, 20", etc.)
 * strictly into standard numerical YYYY-MM-DD format respecting Pacific Time.
 */
export function normalizeToNumericalDate(dateInput?: string | number | Date | null): string {
  if (!dateInput) return getPSTDateStamp();

  // If already Date object
  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return getPSTDateStamp();
    return getPSTDateStamp(dateInput);
  }

  let str = String(dateInput).trim();
  if (!str) return getPSTDateStamp();

  // Strip wrapping quotes and Excel formulas
  str = str.replace(/^["']+|["']+$/g, '').replace(/^=/, '').trim();

  // Pure date YYYY-MM-DD without time
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // ISO string or string with time (e.g. 2026-09-10T05:23:00Z)
  // MUST parse as full Date to convert to the correct Pacific Time date
  if (str.includes('T') || str.includes(':')) {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return getPSTDateStamp(parsed);
    }
  }

  // ISO string starting with YYYY-MM-DD but without time
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10);
  }

  const monthMap: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', sept: '09', oct: '10', nov: '11', dec: '12'
  };

  // Match e.g. "Sep 01, 2026", "Sep 01, 20", "September 01, 2026", "Sept 1, 26"
  const textMonthMatch = str.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{2,4})?/i);
  if (textMonthMatch) {
    const rawMonth = textMonthMatch[1].toLowerCase();
    const monthKey = monthMap[rawMonth.slice(0, 4)] || monthMap[rawMonth.slice(0, 3)];
    if (monthKey) {
      const day = textMonthMatch[2].padStart(2, '0');
      let year = textMonthMatch[3];
      if (!year) {
        year = getPacificParts().year;
      } else if (year.length === 2) {
        // Handle truncated "20" from "2026" or 2-digit years
        year = year === '20' ? '2026' : (parseInt(year, 10) < 50 ? '20' + year : '19' + year);
      }
      return `${year}-${monthKey}-${day}`;
    }
  }

  // Match e.g. "09/01/2026", "9/1/26", "09-01-2026"
  const slashMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (slashMatch) {
    const m = slashMatch[1].padStart(2, '0');
    const d = slashMatch[2].padStart(2, '0');
    let y = slashMatch[3];
    if (y.length === 2) {
      y = y === '20' ? '2026' : (parseInt(y, 10) < 50 ? '20' + y : '19' + y);
    }
    return `${y}-${m}-${d}`;
  }

  // Match e.g. "2026/09/01" or "2026.09.01"
  const ymdSlash = str.match(/^(\d{4})[\/\.](\d{1,2})[\/\.](\d{1,2})/);
  if (ymdSlash) {
    return `${ymdSlash[1]}-${ymdSlash[2].padStart(2, '0')}-${ymdSlash[3].padStart(2, '0')}`;
  }

  // Fallback to Date.parse converted to PST
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return getPSTDateStamp(parsed);
  }

  return getPSTDateStamp();
}
