import { checkClientGeoPermission } from './security';

export async function isUserCountryAllowed(): Promise<boolean> {
  try {
    const geo = await checkClientGeoPermission();
    return geo.allowed;
  } catch {
    return true;
  }
}
