export function getPSTDateStamp(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function formatPSTTimeOnly(date = new Date(), withSeconds = true): string {
  return (
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      hour: 'numeric',
      minute: '2-digit',
      second: withSeconds ? '2-digit' : undefined,
      hour12: true,
    }).format(date) + ' PST'
  );
}

export function normalizeToNumericalDate(dateInput?: string | number | Date | null): string {
  if (!dateInput) return getPSTDateStamp();
  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return getPSTDateStamp();
    return getPSTDateStamp(dateInput);
  }
  let str = String(dateInput).trim();
  if (!str) return getPSTDateStamp();
  str = str.replace(/^["']+|["']+$/g, '').replace(/^=/, '').trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  if (str.includes('T') || str.includes(':')) {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return getPSTDateStamp(parsed);
    }
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return getPSTDateStamp(parsed);
  }

  return getPSTDateStamp();
}
