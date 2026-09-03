export function getFetcherUrl(): string {
  const rawUrl = import.meta.env.DEV
    ? 'http://localhost:8000'
    : (import.meta.env.VITE_FETCHER_URL || 'https://fetcher.endscams.org');
  return rawUrl.replace(/\/+$/, '');
}
