/**
 * Sync bridge for cross-window / iframe communication
 */
import { ScamPhoneRecord } from '../types';

type SyncBridgeConfig = {
  onRequestData?: () => { records: ScamPhoneRecord[]; lastScanTime: string; isScanning: boolean };
  onTriggerScan?: () => void;
  onToggleNumberDown?: (id: string) => void;
  onAddManualRecord?: (rec: any) => void;
  onPushRecords?: (records: any[]) => void;
};

class SyncBridge {
  private config: SyncBridgeConfig = {};

  init(config: SyncBridgeConfig) {
    this.config = config;
  }

  destroy() {
    this.config = {};
  }

  broadcastRecords(records: ScamPhoneRecord[]) {
    if (typeof window === 'undefined') return;
    try {
      window.postMessage({ type: 'ENDSCAMS_SYNC_RECORDS', payload: records }, '*');
    } catch {}
  }

  broadcastCurrentState() {
    if (typeof window === 'undefined') return;
    try {
      window.postMessage({ type: 'ENDSCAMS_SYNC_STATE', timestamp: Date.now() }, '*');
    } catch {}
  }
}

export const syncBridge = new SyncBridge();
