export type ScamCategory =
  | 'Spellcaster Scam'
  | 'Crypto / BTC Recovery Scam'
  | 'Guestbook Spam'
  | 'Tech Support Scam'
  | 'Romance / Relationship Scam'
  | 'Investment / Forex Scam'
  | 'Custom Search';

export type SearchTimeframe = 'qdr:d' | 'qdr:w' | 'qdr:m' | 'qdr:y' | 'all';

export interface SearchPreset {
  id: string;
  name: string;
  query: string;
  timeframe: SearchTimeframe;
  timeframeLabel: string;
  category: ScamCategory;
  platform: 'Facebook' | 'Instagram' | 'Guestbook' | 'Web Search';
  googleSearchUrl: string;
  description: string;
}

export interface ScamPhoneRecord {
  id: string;
  phone: string;              // e.g. "+234 812 345 6789"
  cleanPhone: string;         // Digits only for wa.me link e.g. "2348123456789"
  countryCode?: string;       // e.g. "NG", "US", "UK", "IN"
  countryName?: string;       // e.g. "Nigeria", "United States"
  scamType: ScamCategory | string;
  sourceUrl: string;          // e.g. "https://facebook.com/permalink.php?story_fbid=..."
  sourceDomain: string;       // e.g. "facebook.com"
  platform: string;           // "Facebook", "Instagram", "Guestbook", etc.
  snippet: string;            // Context text where the phone number appeared
  searchQuery: string;        // The query dork that yielded this result
  detectedAt: string;         // ISO string or formatted date
  confidence?: 'High' | 'Medium' | 'Low';
  notes?: string;
}

export type SortField = 'scamType' | 'phone' | 'sourceUrl' | 'platform' | 'detectedAt';
export type SortOrder = 'asc' | 'desc';

export interface TableFilterState {
  searchTerm: string;
  categoryFilter: string;
  platformFilter: string;
  countryFilter: string;
}

export interface SearchExecutionResult {
  presetId?: string;
  query: string;
  records: ScamPhoneRecord[];
  groundingSources: { title: string; url: string }[];
  summaryText: string;
  executedAt: string;
}
