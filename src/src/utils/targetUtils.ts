/**
 * Resolves the impersonated target entity or company name from context
 */

export function resolveTargetCompany(
  companyOrName?: string,
  category?: string,
  description?: string
): string {
  if (companyOrName && companyOrName !== 'N/A' && companyOrName.trim().length > 0) {
    return companyOrName.trim();
  }

  const text = `${category || ''} ${description || ''}`.toLowerCase();

  if (text.includes('geek squad') || text.includes('best buy')) return 'Geek Squad Protection';
  if (text.includes('paypal')) return 'PayPal Risk Operations';
  if (text.includes('norton') || text.includes('lifelock')) return 'Norton LifeLock';
  if (text.includes('mcafee')) return 'McAfee Security Support';
  if (text.includes('microsoft') || text.includes('windows defender')) return 'Microsoft Certified Support';
  if (text.includes('apple') || text.includes('icloud')) return 'Apple Support';
  if (text.includes('amazon') || text.includes('kdp')) return 'Amazon Customer Support';
  if (text.includes('pch') || text.includes('publishers clearing')) return 'Publishers Clearing House';
  if (text.includes('mega million')) return 'Mega Millions Lottery Commission';
  if (text.includes('stake.us') || text.includes('stake casino')) return 'Stake.us Rewards';
  if (text.includes('american cash award') || text.includes('james washington')) return 'American Cash Award';
  if (text.includes('crypto') || text.includes('btc recovery')) return 'Blockchain Asset Recovery Desk';
  if (text.includes('spell') || text.includes('healer') || text.includes('spiritual')) return 'Spiritualist / Love Spell Caster';

  return 'Unknown Impersonator';
}
