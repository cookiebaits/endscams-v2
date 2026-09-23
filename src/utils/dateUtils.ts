/**
 * Date utility functions for Pacific Standard Time / Pacific Daylight Time formatting.
 */

export function getPSTDateStamp(inputDate?: Date | string | number | null): string {
  const dateObj = inputDate ? new Date(inputDate) : new Date();
  if (isNaN(dateObj.getTime())) {
    const fallback = new Date();
    return getPSTDateStamp(fallback);
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(dateObj);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function formatPSTDate(inputDate?: Date | string | number | null): string {
  return getPSTDateStamp(inputDate);
}
