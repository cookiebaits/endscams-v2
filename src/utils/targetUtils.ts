export function formatCompanyTarget(text?: string): string {
  if (!text || text.trim() === '' || text.trim() === 'N/A') return 'General Target';
  const cleaned = text.trim();
  const words = cleaned.split(/\s+/);
  if (words.length > 5) {
    return words.slice(0, 5).join(' ');
  }
  return cleaned;
}

export function resolveTargetCompany(
  nameOrCompany?: string,
  category?: string,
  description?: string
): string {
  if (nameOrCompany && nameOrCompany.trim() && nameOrCompany.trim() !== 'N/A') {
    return formatCompanyTarget(nameOrCompany);
  }

  const combined = `${category || ''} ${description || ''}`.toLowerCase();

  const brandRules: Array<[RegExp, string]> = [
    [/\b(geek\s*squad)\b/i, 'Geek Squad'],
    [/\b(paypal)\b/i, 'PayPal'],
    [/\b(mcafee)\b/i, 'McAfee'],
    [/\b(norton|lifelock)\b/i, 'Norton LifeLock'],
    [/\b(amazon|kdp)\b/i, 'Amazon'],
    [/\b(microsoft|windows\s*defender)\b/i, 'Microsoft'],
    [/\b(apple|icloud)\b/i, 'Apple'],
    [/\b(publishers\s*clearing\s*house|pch)\b/i, 'Publishers Clearing House'],
    [/\b(quickbooks|intuit)\b/i, 'Quickbooks'],
    [/\b(spectrum|charter)\b/i, 'Spectrum'],
    [/\b(xfinity|comcast)\b/i, 'Xfinity'],
    [/\b(spellcaster|spiritual|voodoo|healer)\b/i, 'Spiritual Healer / Spellcaster'],
    [/\b(crypto|btc|bitcoin|blockchain)\b/i, 'Crypto Recovery Desk'],
    [/\b(stake\.us|stake)\b/i, 'Stake.us Rewards'],
    [/\b(mega\s*millions?)\b/i, 'Mega Millions Lottery'],
    [/\b(reader['’]?s?\s*digest)\b/i, "Reader's Digest"],
    [/\b(american\s*cash\s*award)\b/i, 'American Cash Award'],
  ];

  for (const [rule, brand] of brandRules) {
    if (rule.test(combined)) {
      return brand;
    }
  }

  if (category && category.trim()) {
    return formatCompanyTarget(category);
  }

  return 'General Target';
}
