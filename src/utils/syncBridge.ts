export function broadcastRecordSync(record: any) {
  try {
    const bc = new BroadcastChannel('end_scam_scan_sync_channel');
    bc.postMessage({ type: 'ADD_RECORD', record });
    bc.close();
  } catch {}
}
