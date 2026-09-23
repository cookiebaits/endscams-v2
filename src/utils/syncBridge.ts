/**
 * Synchronization bridge between iframe embeds, cross-window messaging, and BroadcastChannel.
 */

export interface SyncBridgeCallbacks {
  onRequestData?: () => any;
  onTriggerScan?: () => void;
  onToggleNumberDown?: (id: string) => void;
  onAddManualRecord?: (rec: any) => void;
  onPushRecords?: (records: any[]) => void;
}

class SyncBridge {
  private channel: BroadcastChannel | null = null;
  private callbacks: SyncBridgeCallbacks = {};

  public init(callbacks: SyncBridgeCallbacks = {}) {
    this.callbacks = callbacks;
    if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
      try {
        if (!this.channel) {
          this.channel = new BroadcastChannel('end_scam_scan_sync_channel');
          this.channel.onmessage = (event) => {
            this.handleMessage(event.data);
          };
        }
      } catch (err) {
        console.warn('[SyncBridge] BroadcastChannel initialization notice:', err);
      }
    }
  }

  public destroy() {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    this.callbacks = {};
  }

  private handleMessage(data: any) {
    if (!data || typeof data !== 'object') return;
    const type = data.type || data.action;

    switch (type) {
      case 'REQUEST_SYNC':
      case 'GET_RECORDS':
        if (this.callbacks.onRequestData) {
          const res = this.callbacks.onRequestData();
          this.broadcast('SYNC_DATA', res);
        }
        break;
      case 'TRIGGER_SCAN':
        if (this.callbacks.onTriggerScan) {
          this.callbacks.onTriggerScan();
        }
        break;
      case 'TOGGLE_NUMBER_DOWN':
        if (this.callbacks.onToggleNumberDown && data.id) {
          this.callbacks.onToggleNumberDown(data.id);
        }
        break;
      case 'ADD_RECORD':
      case 'ADD_MANUAL_RECORD':
        if (this.callbacks.onAddManualRecord && (data.payload || data.record)) {
          this.callbacks.onAddManualRecord(data.payload || data.record);
        }
        break;
      case 'PUSH_RECORDS':
        if (this.callbacks.onPushRecords && Array.isArray(data.records || data.payload)) {
          this.callbacks.onPushRecords(data.records || data.payload);
        }
        break;
      default:
        break;
    }
  }

  public broadcast(type: string, payload?: any) {
    const msg = {
      source: 'END_SCAM_SCAN',
      type,
      version: '2.0',
      timestamp: new Date().toISOString(),
      payload,
    };

    if (this.channel) {
      try {
        this.channel.postMessage(msg);
      } catch {}
    }

    if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
      try {
        window.parent.postMessage(msg, '*');
      } catch {}
    }
  }

  public broadcastRecords(records: any[]) {
    this.broadcast('PUSH_RECORDS', records);
  }

  public broadcastCurrentState() {
    if (this.callbacks.onRequestData) {
      const data = this.callbacks.onRequestData();
      this.broadcast('SYNC_DATA', data);
    }
  }
}

export const syncBridge = new SyncBridge();
