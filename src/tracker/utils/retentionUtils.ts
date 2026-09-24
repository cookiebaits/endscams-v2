import type { ScamPhoneRecord } from '../types';

// Standard 90-Day Retention constant in milliseconds
export const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
export const SIXTY_DAYS_MS = NINETY_DAYS_MS; // Backward compatibility alias

// Extended 6-Month Retention constant in milliseconds (180 days)
export const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;

/**
 * Determines if a scam record matches PCH, Mega Millions, Reader's Digest, Stake.us,
 * or any prize / lottery / sweepstakes scam.
 */
export function isPrizeOrExtendedRetentionRecord(record: Partial<ScamPhoneRecord> | null | undefined): boolean {
  if (!record) return false;

  const company = (record.impersonatedCompany || '').toLowerCase();
  const type = (record.scamType || '').toLowerCase();
  const query = (record.searchQuery || '').toLowerCase();
  const summary = (record.detailedSummary || '').toLowerCase();
  const snippet = (record.snippet || '').toLowerCase();

  // 1. Direct match on Company Name or Scam Type for user-specified brands
  // - PCH / Publishers Clearing House
  if (
    company.includes('pch') ||
    company.includes('publishers clearing house') ||
    type.includes('pch') ||
    type.includes('publishers clearing house')
  ) {
    return true;
  }

  // - Mega Millions
  if (
    company.includes('mega million') ||
    company.includes('megamillion') ||
    type.includes('mega million') ||
    type.includes('megamillion')
  ) {
    return true;
  }

  // - Reader's Digest / Reader Digest
  if (
    company.includes('reader digest') ||
    company.includes("reader's digest") ||
    company.includes('readers digest') ||
    type.includes('reader digest') ||
    type.includes("reader's digest") ||
    type.includes('readers digest')
  ) {
    return true;
  }

  // - Stake.us / Stake Casino / Stake VIP
  if (
    company.includes('stake.us') ||
    company.includes('stake us') ||
    company.includes('stake casino') ||
    company.includes('stake vip') ||
    type.includes('stake.us') ||
    type.includes('stake us') ||
    type.includes('stake casino') ||
    /\bstake\.us\b/i.test(`${company} ${type} ${snippet} ${summary}`)
  ) {
    return true;
  }

  // 2. Generic Prize / Sweepstakes / Lottery / Award Scams
  // Check if scamType explicitly denotes prize / lottery / sweepstakes
  const isPrizeType =
    type.includes('prize') ||
    type.includes('sweepstake') ||
    type.includes('lottery') ||
    type.includes('lotto') ||
    type.includes('jackpot') ||
    type.includes('giveaway') ||
    type.includes('award');

  // Guard: Exclude spellcaster scams that merely claim to cast "lottery winning spells"
  const isSpellcasterExtortion = type.includes('spellcaster') || type.includes('spiritual');
  if (isPrizeType && !isSpellcasterExtortion) {
    return true;
  }

  // 3. Impersonated Company explicitly mentions lottery / sweepstakes / prize commission
  const isPrizeCompany =
    company.includes('lottery') ||
    company.includes('sweepstake') ||
    company.includes('prize') ||
    company.includes('powerball') ||
    company.includes('cash awards');

  if (isPrizeCompany && !isSpellcasterExtortion) {
    return true;
  }

  // 4. Content regex for explicit prize scam keywords (excluding spiritual spellcasters)
  if (!isSpellcasterExtortion) {
    const combinedContent = `${type} ${company} ${query} ${snippet} ${summary}`.toLowerCase();
    const prizePatterns = [
      /\bpch\b/i,
      /publishers\s*clearing\s*house/i,
      /mega\s*millions?/i,
      /megamillions?/i,
      /reader['’]?s?\s*digest/i,
      /stake\.us/i,
      /\b(sweepstakes?|lottery|powerball|grand\s*prize|cash\s*prize|unclaimed\s*prize|prize\s*claim|prize\s*award)\b/i,
    ];

    return prizePatterns.some((pattern) => pattern.test(combinedContent));
  }

  return false;
}

/**
 * Returns the retention duration in milliseconds for a record:
 * - 6 months (180 days) for PCH, Mega Millions, Reader's Digest, Stake.us, or prize scams
 * - 90 days for all other scam categories
 */
export function getRecordRetentionMs(record: Partial<ScamPhoneRecord> | null | undefined): number {
  return isPrizeOrExtendedRetentionRecord(record) ? SIX_MONTHS_MS : NINETY_DAYS_MS;
}

/**
 * Returns a human-readable retention label
 */
export function getRecordRetentionLabel(record: Partial<ScamPhoneRecord> | null | undefined): string {
  return isPrizeOrExtendedRetentionRecord(record) ? '6 Months (Prize/Lottery/PCH)' : '90 Days';
}

/**
 * Helper to extract valid timestamp from record date fields.
 */
export function getRecordTimestamp(record: Partial<ScamPhoneRecord> | null | undefined): number {
  if (!record) return 0;
  const candidate = record.detectedAt || record.postDate;
  if (!candidate) return 0;
  // If candidate is a pure YYYY-MM-DD string, parse with noon UTC to avoid local timezone drift
  if (typeof candidate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(candidate.trim())) {
    const t = new Date(`${candidate.trim()}T12:00:00.000Z`).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  const t = new Date(candidate).getTime();
  return isNaN(t) ? 0 : t;
}

/**
 * Checks if a record has passed its retention lifespan based on detectedAt/reportDate.
 * - 90 days for standard categories
 * - 180 days (6 months) for prize / lottery / sweepstakes / PCH / Stake.us scams
 */
export function isRecordExpired(record: Partial<ScamPhoneRecord> | null | undefined, now: number = Date.now()): boolean {
  if (!record) return false;
  const time = getRecordTimestamp(record);
  if (time === 0) return false; // If no valid date found, do not falsely expire
  const retentionMs = getRecordRetentionMs(record);
  return (now - time) > retentionMs;
}
