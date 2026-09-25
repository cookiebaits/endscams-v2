/**
 * Phone formatting, validation, and country parsing utilities
 */

export function getCleanCopyPhone(text: string): string {
  if (!text) return '';
  return text.trim();
}

export function isTollFreeNumber(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  const digits = phone.replace(/\D/g, '');
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (local.length === 10) {
    const area = local.slice(0, 3);
    const tollFreeCodes = ['800', '888', '877', '866', '855', '844', '833'];
    return tollFreeCodes.includes(area);
  }
  return false;
}

export function isFictitiousOrInvalidPhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return true;
  const clean = phone.replace(/[^0-9+]/g, '');
  const digits = clean.replace(/\D/g, '');

  if (digits.length < 7 || digits.length > 15) return true;
  if (digits.includes('555')) return true;

  const usLocal = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (usLocal.length === 10) {
    const areaCode = usLocal.slice(0, 3);
    const exchange = usLocal.slice(3, 6);
    if (areaCode.startsWith('0') || areaCode.startsWith('1')) return true;
    if (exchange.startsWith('0') || exchange.startsWith('1')) return true;
  }

  // Repeating 5 or more
  if (/(\d)\1{4,}/.test(digits)) return true;

  // Sequential pattern
  if (
    digits.includes('123456') ||
    digits.includes('234567') ||
    digits.includes('345678') ||
    digits.includes('456789') ||
    digits.includes('567890') ||
    digits.includes('654321') ||
    digits.includes('765432') ||
    digits.includes('876543') ||
    digits.includes('987654') ||
    digits.includes('012345')
  ) {
    return true;
  }

  if (digits === '1234567890' || digits === '0987654321') return true;

  return false;
}

export function formatDisplayPhone(rawPhone: string, cleanDigits?: string): string {
  const digits = cleanDigits || (rawPhone ? rawPhone.replace(/\D/g, '') : '');
  const cleaned = rawPhone ? rawPhone.replace(/^=\+?/, '').replace(/^"/, '').replace(/"$/, '').trim() : '';
  if (digits.length === 10) {
    return `1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.startsWith('234') && digits.length === 13) {
    return `+234 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  if (digits.startsWith('254') && digits.length === 12) {
    return `+254 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  if (digits.startsWith('27') && digits.length === 11) {
    return `+27 ${digits.slice(2, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return cleaned.startsWith('+') ? cleaned : `+${digits}`;
}

export function formatPhoneDisplay(rawPhone: string, cleanDigits?: string): string {
  return formatDisplayPhone(rawPhone, cleanDigits);
}

export function deriveCountryInfo(phone: string): { code: string; name: string; isAfrican: boolean; allowed: boolean } {
  if (!phone || isFictitiousOrInvalidPhone(phone)) {
    return { code: 'GLOBAL', name: 'International', isAfrican: false, allowed: false };
  }

  const clean = phone.replace(/[^0-9+]/g, '');
  const digits = clean.replace(/\D/g, '');

  const africanPrefixes: Record<string, { code: string; name: string }> = {
    '234': { code: 'NG', name: 'Nigeria' },
    '254': { code: 'KE', name: 'Kenya' },
    '233': { code: 'GH', name: 'Ghana' },
    '27': { code: 'ZA', name: 'South Africa' },
    '260': { code: 'ZM', name: 'Zambia' },
    '256': { code: 'UG', name: 'Uganda' },
    '255': { code: 'TZ', name: 'Tanzania' },
    '237': { code: 'CM', name: 'Cameroon' },
    '225': { code: 'CI', name: 'Ivory Coast' },
    '221': { code: 'SN', name: 'Senegal' },
    '263': { code: 'ZW', name: 'Zimbabwe' },
    '250': { code: 'RW', name: 'Rwanda' },
    '229': { code: 'BJ', name: 'Benin' },
    '228': { code: 'TG', name: 'Togo' },
    '241': { code: 'GA', name: 'Gabon' },
  };

  for (const [prefix, info] of Object.entries(africanPrefixes)) {
    if (digits.startsWith(prefix)) {
      return { code: info.code, name: info.name, isAfrican: true, allowed: true };
    }
  }

  if (digits.length === 10 || (digits.length === 11 && digits.startsWith('1'))) {
    return { code: 'US', name: 'United States', isAfrican: false, allowed: true };
  }

  return { code: 'GLOBAL', name: 'International', isAfrican: false, allowed: true };
}
