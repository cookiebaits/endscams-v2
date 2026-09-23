/**
 * Utility functions for resolving and inferring impersonated company/target names.
 */

export function resolveTargetCompany(company?: string | null, category?: string | null, description?: string | null): string {
  if (company && company.trim() && company.trim() !== 'N/A' && company.trim() !== 'Unspecified Target') {
    return company.trim();
  }

  const cat = (category || '').toLowerCase();
  const desc = (description || '').toLowerCase();
  const combined = `${cat} ${desc}`;

  if (combined.includes('geek squad') || combined.includes('geeksquad')) return 'Geek Squad Protection';
  if (combined.includes('paypal')) return 'PayPal Risk Operations';
  if (combined.includes('mcafee')) return 'McAfee Total Protection';
  if (combined.includes('norton') || combined.includes('lifelock')) return 'Norton LifeLock';
  if (combined.includes('amazon') || combined.includes('kdp')) return 'Amazon Support';
  if (combined.includes('microsoft') || combined.includes('windows defender')) return 'Microsoft Support';
  if (combined.includes('apple') || combined.includes('icloud')) return 'Apple Support';
  if (combined.includes('publishers clearing') || combined.includes('pch')) return 'Publishers Clearing House';
  if (combined.includes('mega million') || combined.includes('megamillion')) return 'Mega Millions Lottery';
  if (combined.includes('reader digest') || combined.includes("reader's digest")) return "Reader's Digest";
  if (combined.includes('stake.us') || combined.includes('stake us') || combined.includes('stake casino')) return 'Stake.us Rewards';
  if (combined.includes('quickbook') || combined.includes('intuit')) return 'QuickBooks Support';
  if (combined.includes('spellcaster') || combined.includes('love spell') || combined.includes('traditional healer')) return 'Spiritual Spellcaster Scam';
  if (combined.includes('btc recovery') || combined.includes('crypto recovery') || combined.includes('blockchain')) return 'Crypto Recovery Desk';

  return 'Unspecified Target';
}
