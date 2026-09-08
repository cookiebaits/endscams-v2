/**
 * Pacific Time (PST/PDT) utilities to ensure consistent timezone formatting across the entire app.
 */

export const PACIFIC_TIMEZONE = 'America/Los_Angeles';

/**
 * Format any ISO string or Date object into a readable Pacific Time string (e.g. "Aug 15, 2026, 12:19 PM PST")
 */
export function formatPST(dateInput?: string | number | Date | null, includeSeconds = false): string {
  if (!dateInput) return 'N/A';
  try {
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
 * Get next scheduled scan info (7:00 AM PST or 1:00 PM PST) and countdown
 */
export function getNextScheduledPSTInfo(): { label: string; countdown: string } {
  const { hour, minute, second } = getPacificParts();
  let targetHour = 7;
  let isTomorrow = false;

  if (hour < 7) {
    targetHour = 7;
  } else if (hour < 13) {
    targetHour = 13;
  } else {
    targetHour = 7;
    isTomorrow = true;
  }

  const currentSecondsOfDay = hour * 3600 + minute * 60 + second;
  let targetSecondsOfDay = targetHour * 3600;
  if (isTomorrow) targetSecondsOfDay += 24 * 3600;

  const diffSec = targetSecondsOfDay - currentSecondsOfDay;
  const diffHours = Math.floor(diffSec / 3600);
  const diffMins = Math.floor((diffSec % 3600) / 60);

  const label = isTomorrow ? 'Tomorrow at 7:00 AM PST' : targetHour === 7 ? 'Today at 7:00 AM PST' : 'Today at 1:00 PM PST';
  const countdown = `in ${diffHours}h ${diffMins}m`;
  return { label, countdown };
}
