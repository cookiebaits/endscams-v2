export interface SyncBridgeOptions {
  onRequestData?: () => any;
  onTriggerScan?: () => void;
  onToggleNumberDown?: (id: string) => void;
  onAddManualRecord?: (record: any) => void;
  onPushRecords?: (records: any[]) => void;
}

let channel: BroadcastChannel | null = null;
let activeOptions: SyncBridgeOptions = {};

export const syncBridge = {
  init(options: SyncBridgeOptions) {
    activeOptions = options;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        channel = new BroadcastChannel('end_scam_scan_sync_channel');
        channel.onmessage = (event) => {
          if (!event.data) return;
          const { type, payload, id, records } = event.data;
          if (type === 'REQUEST_DATA' && activeOptions.onRequestData) {
            const data = activeOptions.onRequestData();
            channel?.postMessage({ type: 'SYNC_DATA', payload: data });
          } else if (type === 'TRIGGER_SCAN' && activeOptions.onTriggerScan) {
            activeOptions.onTriggerScan();
          } else if (type === 'TOGGLE_NUMBER_DOWN' && activeOptions.onToggleNumberDown && id) {
            activeOptions.onToggleNumberDown(id);
          } else if ((type === 'ADD_RECORD' || type === 'ADD_MANUAL_RECORD') && activeOptions.onAddManualRecord && payload) {
            activeOptions.onAddManualRecord(payload);
          } else if (type === 'PUSH_RECORDS' && activeOptions.onPushRecords && (records || payload)) {
            activeOptions.onPushRecords(records || payload);
          }
        };
      }
    } catch (e) {
      console.warn('[SyncBridge] BroadcastChannel init notice:', e);
    }
  },

  destroy() {
    if (channel) {
      channel.close();
      channel = null;
    }
  },

  broadcastRecords(records: any[]) {
    try {
      if (channel) {
        channel.postMessage({ type: 'PUSH_RECORDS', records });
      }
    } catch {}
  },

  broadcastCurrentState() {
    try {
      if (channel && activeOptions.onRequestData) {
        const data = activeOptions.onRequestData();
        channel.postMessage({ type: 'SYNC_DATA', payload: data });
      }
    } catch {}
  },
};
