export const SYNC_CHANNEL_NAME = 'end_scam_scan_sync_channel';

export function broadcastSyncEvent(type: string, payload: any) {
  try {
    const channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
    channel.postMessage({ type, payload, timestamp: Date.now() });
    channel.close();
  } catch (e) {
    console.warn('[syncBridge] BroadcastChannel postMessage failed:', e);
  }
}
