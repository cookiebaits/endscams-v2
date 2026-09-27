export class SyncBridge {
  private channel: BroadcastChannel | null = null;

  constructor(channelName = 'end_scam_scan_sync_channel') {
    try {
      this.channel = new BroadcastChannel(channelName);
    } catch {
      this.channel = null;
    }
  }

  public postMessage(data: any) {
    try {
      this.channel?.postMessage(data);
    } catch {}
  }

  public close() {
    try {
      this.channel?.close();
    } catch {}
  }
}
