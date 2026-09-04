export function getFetcherUrl(): string {
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return '';
  }
  const rawUrl = import.meta.env.VITE_FETCHER_URL || 'https://fetcher.endscams.org';
  return rawUrl.replace(/\/+$/, '');
}
