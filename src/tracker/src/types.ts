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
  phone: string;              // e.g. "+1 (656) 556-3016"
  cleanPhone: string;         // Digits only for wa.me link e.g. "16565563016"
  countryCode?: string;       // e.g. "US", "GB", "NG", "IN"
  countryName?: string;       // e.g. "United States", "United Kingdom"
  scamType: ScamCategory | string;
  impersonatedCompany?: string; // e.g. "PayPal", "Apple", "Geek Squad", "Amazon", "Norton"
  invoiceNumber?: string;       // e.g. "INV-49201", "PAY-88219", "N/A"
  amountCharged?: string;       // e.g. "$789.00", "$499.99", "$1,299.00"
  detailedSummary?: string;     // Summary of what the scam is, amount charged, remote access tool, etc.
  sourceUrl: string;          // e.g. "https://techscammersunited.com/..."
  sourceDomain: string;       // e.g. "techscammersunited.com"
  platform: string;           // "Tech Support United", "Scammer.info", etc.
  snippet: string;            // Context text where the phone number appeared
  searchQuery: string;        // The query or scan that yielded this result
  detectedAt: string;         // ISO string or formatted date
  postDate?: string;          // Extracted post/detection date e.g. "2026-09-01"
  confidence?: 'High' | 'Medium' | 'Low';
  isNumberDown?: boolean;     // Whether the number has been marked as dead / inactive (Number down)
  numberDownAt?: string;      // Timestamp when marked as down
  updatedAt?: string;         // Timestamp when record was updated/edited
  notes?: string;
}

export type SortField = 'scamType' | 'phone' | 'sourceUrl' | 'platform' | 'detectedAt';
export type SortOrder = 'asc' | 'desc';

export interface TableFilterState {
  searchTerm: string;
  categoryFilter: string;
  platformFilter: string;
  countryFilter: string;
  dateFilter?: string;        // Filter by specific date or 'ALL'
}

export interface SearchExecutionResult {
  presetId?: string;
  query: string;
  records: ScamPhoneRecord[];
  groundingSources: { title: string; url: string }[];
  summaryText: string;
  executedAt: string;
}

export interface SchedulerLogEntry {
  id: string;
  timestamp: string;
  formattedPST: string;
  type: 'tick' | 'trigger' | 'scan' | 'catchup' | 'purge' | 'error' | 'info';
  message: string;
  details?: any;
}

export interface NextScheduledExecution {
  label: string;
  targetHour: number;
  isoTimestamp: string;
  targetPST: string;
  remainingMs: number;
  remainingSeconds: number;
  countdownHuman: string;
}

export interface SchedulerDiagnosticsData {
  success: boolean;
  currentTimePST: string;
  currentTimeISO: string;
  scheduler: {
    status: 'active' | 'scanning' | 'stalled' | 'cold_start_pending';
    isActive: boolean;
    isStalled: boolean;
    intervalSeconds: number;
    heartbeatCount: number;
    lastHeartbeat: string | null;
    lastHeartbeatFormattedPST: string | null;
    lastHeartbeatAgeSeconds: number;
    serverUptimeSeconds: number;
    serverStartTime: string;
    serverStartTimeFormattedPST: string;
  };
  schedule: {
    policy: string;
    scheduledSlots: string[];
    lastScheduledSlot: string | null;
    nextExecution: NextScheduledExecution;
    coldStartCatchUpPolicy: string;
    coldStartThresholdHours: number;
    hoursSinceLastScan: number | null;
    catchUpEligible: boolean;
    completedSlotsCount?: number;
    completedSlots?: string[];
    pendingMissedSlotsCount?: number;
    pendingMissedSlots?: string[];
  };
  execution: {
    isScanning: boolean;
    scanProgress: number;
    scanStatusMessage: string;
    lastScanTime: string | null;
    lastScanFormattedPST: string | null;
    lastScanSummary: string;
    lastScanDurationMs: number | null;
    lastScanAddedCount: number;
    totalScansExecuted: number;
  };
  health: {
    geminiApiKey: 'configured' | 'missing';
    storage: 'healthy' | 'error';
    recordsRetained: number;
    retentionPolicy: string;
  };
  logs: SchedulerLogEntry[];
}

export type SyncMessageType =
  | 'HANDSHAKE'
  | 'HANDSHAKE_ACK'
  | 'PING'
  | 'PONG'
  | 'REQUEST_SYNC'
  | 'SYNC_DATA'
  | 'PUSH_RECORDS'
  | 'ADD_RECORD'
  | 'TRIGGER_SCAN'
  | 'UPDATE_RECORD'
  | 'TOGGLE_NUMBER_DOWN'
  | 'SET_FILTER'
  | 'GET_RECORDS'
  | 'CUSTOM_EVENT';

export interface SyncMessage<T = any> {
  source: 'END_SCAM_SCAN' | string;
  type: SyncMessageType | string;
  version: string;
  id: string;
  timestamp: string;
  payload?: T;
  error?: string;
}

export interface SyncLogEntry {
  id: string;
  timestamp: string;
  direction: 'INCOMING' | 'OUTGOING';
  channel: 'postMessage' | 'BroadcastChannel' | 'StorageEvent' | 'SharedStorage';
  origin?: string;
  type: string;
  payload: any;
}

export interface SyncBridgeStatus {
  isEmbeddedInIframe: boolean;
  hasParentWindow: boolean;
  hasBroadcastChannel: boolean;
  hasSharedStorage: boolean;
  allowedOrigins: string[];
  messagesSentCount: number;
  messagesReceivedCount: number;
  lastSyncTimestamp: string | null;
  lastMessageSummary?: string;
}

