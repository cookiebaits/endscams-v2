import { ScamPhoneRecord, SyncMessage, SyncLogEntry, SyncBridgeStatus } from '../types';
import { getPSTDateStamp } from './dateUtils';

const SYNC_VERSION = '1.1.0';
const SOURCE_TAG = 'END_SCAM_SCAN';
const TARGET_PARENT_URL = 'https://endscams.org/tracker';
const TARGET_PARENT_ORIGIN = 'https://endscams.org';
const BROADCAST_CHANNEL_NAME = 'end_scam_scan_sync_channel';
const LOCAL_STORAGE_KEY = 'end_scam_scan_shared_state';

export interface SyncBridgeCallbacks {
  onRequestData?: () => {
    records: ScamPhoneRecord[];
    isScanning: boolean;
    lastScanTime: string | null;
    nextScheduledRefresh?: string;
  };
  onPushRecords?: (records: ScamPhoneRecord[]) => void;
  onAddManualRecord?: (record: Omit<ScamPhoneRecord, 'id' | 'detectedAt'>) => void;
  onTriggerScan?: () => void;
  onToggleNumberDown?: (id: string) => void;
  onSetFilter?: (filters: { searchTerm?: string; category?: string; platform?: string; country?: string }) => void;
  onLogUpdate?: (logs: SyncLogEntry[]) => void;
  onStatusUpdate?: (status: SyncBridgeStatus) => void;
}

export function formatRecordForTrackerSync(r: ScamPhoneRecord): any {
  const rawPhone = r.phone || r.cleanPhone || '';
  const digits = r.cleanPhone || rawPhone.replace(/\D/g, '');
  const reportDate = r.postDate || (r.detectedAt ? getPSTDateStamp(new Date(r.detectedAt)) : getPSTDateStamp());
  const sourceName = r.platform || r.sourceDomain || 'Tech Support United';
  const sourceUrl = r.sourceUrl || '';
  const description = r.detailedSummary || r.notes || r.snippet || '';

  return {
    ...r,
    phone_number: r.phone || digits,
    phone_digits: digits,
    phoneNumber: r.phone || digits,
    source_name: sourceName,
    source: sourceName,
    source_url: sourceUrl,
    url: sourceUrl,
    report_date: reportDate,
    incident_date: reportDate,
    date: reportDate,
    category: r.scamType || 'Tech Support Scam',
    description: description,
    notes: r.notes || description,
  };
}

class SyncBridgeManager {
  private instanceId = 'bridge-' + Math.random().toString(36).slice(2, 9);
  private callbacks: SyncBridgeCallbacks = {};
  private logs: SyncLogEntry[] = [];
  private maxLogs = 150;
  private broadcastChannel: BroadcastChannel | null = null;
  private isEmbeddedInIframe = false;
  private hasParentWindow = false;
  private isEndScamsParentDetected = false;
  private heartbeatInterval: any = null;
  private messagesSentCount = 0;
  private messagesReceivedCount = 0;
  private lastSyncTimestamp: string | null = null;
  private lastMessageSummary: string = 'Bridge initialized. Ready to sync with https://endscams.org/tracker.';
  private isInitialized = false;

  constructor() {
    this.detectEnvironment();
  }

  private detectEnvironment() {
    try {
      this.isEmbeddedInIframe = typeof window !== 'undefined' && window.self !== window.top;
      this.hasParentWindow = typeof window !== 'undefined' && Boolean(window.parent && window.parent !== window.self);

      if (typeof document !== 'undefined' && document.referrer) {
        if (document.referrer.includes('endscams.org')) {
          this.isEndScamsParentDetected = true;
          this.lastMessageSummary = 'Detected parent embedding from https://endscams.org/tracker';
        }
      }
    } catch {
      this.isEmbeddedInIframe = true;
      this.hasParentWindow = true;
    }
  }

  public init(callbacks: SyncBridgeCallbacks) {
    this.callbacks = callbacks;
    if (this.isInitialized) return;
    this.isInitialized = true;

    this.detectEnvironment();

    // 1. Setup BroadcastChannel for cross-tab / cross-window / same-origin iframe sync
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        this.broadcastChannel.onmessage = (event) => {
          this.handleIncomingRawMessage(event.data, 'BroadcastChannel', window.location.origin);
        };
      } catch (err) {
        console.warn('[SyncBridge] BroadcastChannel init error:', err);
      }
    }

    // 2. Setup window.addEventListener('message') for postMessage communication
    if (typeof window !== 'undefined') {
      window.addEventListener('message', this.handleWindowMessage);
      window.addEventListener('storage', this.handleStorageEvent);
    }

    // 3. Send initial Handshake / Ping to parent and frames
    setTimeout(() => {
      this.sendHandshake();
      this.broadcastCurrentState();
    }, 400);

    // 4. Setup periodic state synchronization heartbeat (every 12 seconds)
    if (typeof window !== 'undefined') {
      this.heartbeatInterval = setInterval(() => {
        if (this.callbacks.onRequestData) {
          const data = this.callbacks.onRequestData();
          if (data && data.records && data.records.length > 0) {
            // Heartbeat state broadcast
            this.broadcastCurrentState(true);
          }
        }
      }, 12000);
    }

    this.emitStatus();
  }

  public destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('message', this.handleWindowMessage);
      window.removeEventListener('storage', this.handleStorageEvent);
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.close();
      } catch {}
      this.broadcastChannel = null;
    }
    this.isInitialized = false;
  }

  private handleWindowMessage = (event: MessageEvent) => {
    // Ignore internal dev tooling or react devtools messages
    if (!event.data || typeof event.data !== 'object') return;
    if (event.data.source === 'react-devtools' || event.data.type?.startsWith?.('webpack')) return;

    if (event.origin && event.origin.includes('endscams.org')) {
      this.isEndScamsParentDetected = true;
    }

    this.handleIncomingRawMessage(event.data, 'postMessage', event.origin);
  };

  private handleStorageEvent = (event: StorageEvent) => {
    if (event.key === LOCAL_STORAGE_KEY && event.newValue) {
      try {
        const parsed = JSON.parse(event.newValue);
        this.handleIncomingRawMessage(parsed, 'StorageEvent', window.location.origin);
      } catch {}
    }
  };

  private handleIncomingRawMessage(data: any, channel: SyncLogEntry['channel'], origin?: string) {
    if (!data || typeof data !== 'object') return;

    // Ignore messages generated by this exact bridge instance to prevent recursive self-loops
    if (data.senderId && data.senderId === this.instanceId) return;

    // Support both structured END_SCAM_SCAN messages and generic message schemas
    const messageType = data.type || data.action || data.event || data.topic || '';
    if (!messageType && !data.request) return;

    const normalizedType = String(messageType || data.request || '').toUpperCase();

    this.messagesReceivedCount++;
    this.lastSyncTimestamp = new Date().toISOString();
    this.lastMessageSummary = `Received ${normalizedType} from ${origin || 'parent frame'}`;

    const logEntry: SyncLogEntry = {
      id: `in-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      direction: 'INCOMING',
      channel,
      origin: origin || 'unknown',
      type: normalizedType,
      payload: data.payload || data.data || data.records || data,
    };
    this.addLog(logEntry);

    // Protocol dispatch
    switch (normalizedType) {
      case 'PING':
      case 'HANDSHAKE':
      case 'CHECK_CONNECTION':
      case 'INIT_TRACKER': {
        this.sendHandshakeAck(data.id);
        this.broadcastCurrentState();
        break;
      }

      case 'HANDSHAKE_ACK':
      case 'PONG': {
        this.lastMessageSummary = `Handshake acknowledged from ${origin || 'parent'}`;
        this.emitStatus();
        break;
      }

      case 'REQUEST_SYNC':
      case 'GET_RECORDS':
      case 'GET_DATA':
      case 'FETCH_RECORDS':
      case 'TRACKER_POLL':
      case 'REFRESH_TRACKER': {
        this.broadcastCurrentState();
        break;
      }

      case 'SYNC_DATA':
      case 'SYNC_RECORDS':
      case 'SET_RECORDS':
      case 'PUSH_RECORDS':
      case 'TRACKER_UPDATE': {
        const incomingRecords = data.payload?.records || data.records || data.data || (Array.isArray(data.payload) ? data.payload : null);
        if (Array.isArray(incomingRecords) && this.callbacks.onPushRecords) {
          this.callbacks.onPushRecords(incomingRecords);
        }
        break;
      }

      case 'ADD_MANUAL_RECORD':
      case 'ADD_RECORD':
      case 'USER_REPORT':
      case 'SCAM_REPORT_SUBMITTED':
      case 'INSERT_RECORD': {
        const rawRec = data.payload?.record || data.record || (data.payload?.phone || data.payload?.phone_number || data.payload?.phone_digits || data.payload?.phoneNumber || data.payload?.phoneDigits ? data.payload : null) || data.payload;
        if (rawRec && this.callbacks.onAddManualRecord) {
          this.callbacks.onAddManualRecord(rawRec);
        }
        break;
      }

      case 'TRIGGER_SCAN':
      case 'MANUAL_REFRESH':
      case 'RUN_SCAN': {
        if (this.callbacks.onTriggerScan) {
          this.callbacks.onTriggerScan();
        }
        break;
      }

      case 'TOGGLE_NUMBER_DOWN':
      case 'MARK_NUMBER_DOWN': {
        const id = data.payload?.id || data.id;
        if (id && this.callbacks.onToggleNumberDown) {
          this.callbacks.onToggleNumberDown(id);
        }
        break;
      }

      case 'SET_FILTER':
      case 'FILTER_RECORDS': {
        const filters = data.payload || data;
        if (this.callbacks.onSetFilter) {
          this.callbacks.onSetFilter(filters);
        }
        break;
      }

      default: {
        // Fallback: if data contains records array directly, push it
        if (Array.isArray(data.records) && this.callbacks.onPushRecords) {
          this.callbacks.onPushRecords(data.records);
        }
        break;
      }
    }

    this.emitStatus();
  }

  // Build standard enveloped message
  private createMessage<T>(type: string, payload?: T): SyncMessage<T> {
    return {
      source: SOURCE_TAG,
      type,
      version: SYNC_VERSION,
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      senderId: this.instanceId,
      payload,
    };
  }

  public getInstanceId(): string {
    return this.instanceId;
  }

  private addLog(entry: SyncLogEntry) {
    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }
    if (this.callbacks.onLogUpdate) {
      this.callbacks.onLogUpdate([...this.logs]);
    }
  }

  private emitStatus() {
    if (this.callbacks.onStatusUpdate) {
      this.callbacks.onStatusUpdate(this.getStatus());
    }
  }

  public getStatus(): SyncBridgeStatus {
    const hasSharedStorage = typeof window !== 'undefined' && 'sharedStorage' in window;
    return {
      isEmbeddedInIframe: this.isEmbeddedInIframe,
      hasParentWindow: this.hasParentWindow,
      hasBroadcastChannel: Boolean(this.broadcastChannel),
      hasSharedStorage,
      allowedOrigins: ['* (Universal postMessage Allowed)'],
      messagesSentCount: this.messagesSentCount,
      messagesReceivedCount: this.messagesReceivedCount,
      lastSyncTimestamp: this.lastSyncTimestamp,
      lastMessageSummary: this.isEndScamsParentDetected ? `${this.lastMessageSummary} (parent detected)` : this.lastMessageSummary,
    };
  }

  public getLogs(): SyncLogEntry[] {
    return [...this.logs];
  }

  public clearLogs() {
    this.logs = [];
    if (this.callbacks.onLogUpdate) {
      this.callbacks.onLogUpdate([]);
    }
  }

  // Dispatch message to all available targets (Parent, Child Iframes, BroadcastChannel, and SharedStorage)
  public broadcast<T>(type: string, payload?: T, customChannelDesc: string = 'All Channels', isSilentHeartbeat: boolean = false) {
    const message = this.createMessage(type, payload);
    this.messagesSentCount++;
    this.lastSyncTimestamp = new Date().toISOString();
    this.lastMessageSummary = isSilentHeartbeat
      ? `Heartbeat sync active to https://endscams.org/tracker (${(payload as any)?.records?.length || 0} records)`
      : `Sent ${type} via ${customChannelDesc}`;

    // 1. Post to window.parent if embedded (with wildcard * and explicit fallback)
    if (typeof window !== 'undefined' && window.parent && window.parent !== window.self) {
      try {
        window.parent.postMessage(message, '*');

        // Also post flat payload formatted explicitly for TrackerPage & Supabase retainRecordsToPostgres compatibility
        if (payload && (payload as any).records) {
          const rawRecords = (payload as any).records;
          const formattedRecords = Array.isArray(rawRecords) ? rawRecords.map(formatRecordForTrackerSync) : [];

          // Primary event expected by TrackerPage handleWindowMessage
          window.parent.postMessage({
            source: SOURCE_TAG,
            event: 'TRACKER_RECORDS_UPDATED',
            type: 'TRACKER_RECORDS_UPDATED',
            action: 'SYNC_RECORDS',
            targetOrigin: TARGET_PARENT_ORIGIN,
            senderId: this.instanceId,
            records: formattedRecords,
            data: formattedRecords,
            payload: { records: formattedRecords },
            totalRecords: formattedRecords.length,
            isScanning: (payload as any).isScanning,
            lastScanTime: (payload as any).lastScanTime,
            timestamp: message.timestamp,
          }, '*');

          // Secondary event formats supported by TrackerPage
          window.parent.postMessage({
            type: 'SYNC_DATA',
            event: 'SYNC_DATA',
            senderId: this.instanceId,
            records: formattedRecords,
            data: formattedRecords,
            payload: { records: formattedRecords },
            totalRecords: formattedRecords.length,
            timestamp: message.timestamp,
          }, '*');

          window.parent.postMessage({
            type: 'SYNC_RECORDS',
            event: 'SYNC_RECORDS',
            senderId: this.instanceId,
            records: formattedRecords,
            data: formattedRecords,
            payload: { records: formattedRecords },
            totalRecords: formattedRecords.length,
            timestamp: message.timestamp,
          }, '*');
        }
      } catch (err) {
        console.warn('[SyncBridge] Failed to post to parent:', err);
      }
    }

    // 2. Post to all child iframes on the current page
    if (typeof document !== 'undefined') {
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach((iframe) => {
        try {
          if (iframe.contentWindow) {
            iframe.contentWindow.postMessage(message, '*');
          }
        } catch (err) {
          console.warn('[SyncBridge] Failed to post to child iframe:', err);
        }
      });
    }

    // 3. Post to BroadcastChannel
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(message);
        if (payload && (payload as any).records) {
          const rawRecords = (payload as any).records;
          const formattedRecords = Array.isArray(rawRecords) ? rawRecords.map(formatRecordForTrackerSync) : [];
          this.broadcastChannel.postMessage({
            type: 'TRACKER_RECORDS_UPDATED',
            event: 'TRACKER_RECORDS_UPDATED',
            senderId: this.instanceId,
            records: formattedRecords,
            payload: { records: formattedRecords },
            data: formattedRecords,
          });
        }
      } catch (err) {
        console.warn('[SyncBridge] Failed to broadcast channel:', err);
      }
    }

    // 4. Update localStorage for storage event fallback
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(message));
      }
    } catch {}

    // 5. SharedStorage API support (Privacy Sandbox / Fenced Frames)
    try {
      if (typeof window !== 'undefined' && 'sharedStorage' in window) {
        const ss = (window as any).sharedStorage;
        if (ss && typeof ss.set === 'function') {
          ss.set('last_sync_message', JSON.stringify({ type, timestamp: message.timestamp }));
          if (type === 'SYNC_DATA' && payload) {
            const count = (payload as any).records?.length || 0;
            ss.set('scam_records_count', String(count));
          }
        }
      }
    } catch {}

    // Log the outgoing message (skip flooding logs on silent heartbeats)
    if (!isSilentHeartbeat || this.logs.length === 0) {
      this.addLog({
        id: `out-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        direction: 'OUTGOING',
        channel: 'postMessage',
        origin: typeof window !== 'undefined' ? window.location.origin : 'self',
        type,
        payload: payload || {},
      });
    }

    this.emitStatus();
  }

  // Send a Handshake
  public sendHandshake() {
    this.broadcast('HANDSHAKE', {
      app: 'End Scam Scan',
      target: TARGET_PARENT_URL,
      version: SYNC_VERSION,
      capabilities: ['SYNC_DATA', 'PUSH_RECORDS', 'ADD_RECORD', 'TRIGGER_SCAN', 'TOGGLE_NUMBER_DOWN', 'SET_FILTER', 'TRACKER_RECORDS_UPDATED'],
      timestamp: new Date().toISOString(),
    });
  }

  // Send Handshake ACK
  public sendHandshakeAck(correlationId?: string) {
    this.broadcast('HANDSHAKE_ACK', {
      app: 'End Scam Scan',
      target: TARGET_PARENT_URL,
      version: SYNC_VERSION,
      correlationId,
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  }

  // Broadcast current state to all listeners
  public broadcastCurrentState(isSilentHeartbeat: boolean = false) {
    if (this.callbacks.onRequestData) {
      const data = this.callbacks.onRequestData();
      if (!data) return;
      this.broadcast('SYNC_DATA', {
        records: data.records,
        totalRecords: data.records.length,
        isScanning: data.isScanning,
        lastScanTime: data.lastScanTime,
        nextScheduledRefresh: data.nextScheduledRefresh,
        targetApp: 'https://endscams.org/tracker',
        timestamp: new Date().toISOString(),
      }, 'All Channels', isSilentHeartbeat);
    }
  }

  // Request sync from parent or other frame
  public requestSyncFromParent() {
    this.broadcast('REQUEST_SYNC', {
      requestedAt: new Date().toISOString(),
    });
  }

  // Trigger remote scan
  public triggerRemoteScan() {
    this.broadcast('TRIGGER_SCAN', {
      triggeredAt: new Date().toISOString(),
    });
  }

  // Broadcast records to parent and listeners
  public broadcastRecords(records: ScamPhoneRecord[]) {
    this.broadcast('TRACKER_RECORDS_UPDATED', {
      records,
      count: records.length,
      timestamp: new Date().toISOString(),
    });
  }
}

export const syncBridge = new SyncBridgeManager();
