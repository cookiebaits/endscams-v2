const SYNC_CHANNEL_NAME = 'end_scam_scan_sync_channel';

export function broadcastScanSync(payload: any) {
  try {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const bc = new BroadcastChannel(SYNC_CHANNEL_NAME);
      bc.postMessage(payload);
      bc.close();
    }
  } catch (e) {
    console.warn('BroadcastChannel error:', e);
  }
}
