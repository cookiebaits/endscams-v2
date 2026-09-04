export async function checkUrlConnectivity(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 seconds
    const response = await fetch(url, {
      method: 'HEAD', // HEAD might be rejected by some forums, GET is safer but heavier.
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });
    clearTimeout(timeout);
    return response.ok || response.status === 403; // Some forums return 403 for bots, but the page exists
  } catch (error) {
    return false;
  }
}
