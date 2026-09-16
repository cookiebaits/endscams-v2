// US, CA, AU, and 27 EU member states
export const ALLOWED_COUNTRY_CODES = new Set<string>([
  'US', // United States
  'CA', // Canada
  'AU', // Australia
  // EU Member States (27)
  'AT', // Austria
  'BE', // Belgium
  'BG', // Bulgaria
  'HR', // Croatia
  'CY', // Cyprus
  'CZ', // Czech Republic
  'DK', // Denmark
  'EE', // Estonia
  'FI', // Finland
  'FR', // France
  'DE', // Germany
  'GR', // Greece
  'HU', // Hungary
  'IE', // Ireland
  'IT', // Italy
  'LV', // Latvia
  'LT', // Lithuania
  'LU', // Luxembourg
  'MT', // Malta
  'NL', // Netherlands
  'PL', // Poland
  'PT', // Portugal
  'RO', // Romania
  'SK', // Slovakia
  'SI', // Slovenia
  'ES', // Spain
  'SE', // Sweden
]);

const GEO_CACHE_KEY = 'cwn_geo_ip_country';

/**
 * Detects client IP country via geolocation API endpoints.
 * Caches country code in sessionStorage for performance.
 * If API fails or is offline (or local dev localhost), defaults to 'US' (allowed).
 */
export async function detectClientCountry(): Promise<string> {
  if (typeof window === 'undefined') return 'US';

  try {
    const cached = sessionStorage.getItem(GEO_CACHE_KEY);
    if (cached) return cached;
  } catch {}

  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      if (data && data.country_code) {
        const country = String(data.country_code).toUpperCase();
        try { sessionStorage.setItem(GEO_CACHE_KEY, country); } catch {}
        return country;
      }
    }
  } catch {}

  // Fallback endpoint
  try {
    const res = await fetch('https://ipinfo.io/json', { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      if (data && data.country) {
        const country = String(data.country).toUpperCase();
        try { sessionStorage.setItem(GEO_CACHE_KEY, country); } catch {}
        return country;
      }
    }
  } catch {}

  // Default fallback if geolocation services are unavailable
  return 'US';
}

/**
 * Synchronously checks if a cached country code is allowed.
 * If no cached entry exists, initiates async check or returns default true until resolved.
 */
export async function isUserCountryAllowed(): Promise<boolean> {
  const country = await detectClientCountry();
  return ALLOWED_COUNTRY_CODES.has(country);
}
