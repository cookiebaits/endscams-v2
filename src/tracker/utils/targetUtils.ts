/**
 * Universal Target Resolution Utility
 * 
 * Ensures that every threat record resolves to a specific, clean impersonated company
 * or target organization. Never returns "Unspecified Target", "N/A", or empty values.
 */

export function resolveTargetCompany(
  company?: string | null,
  category?: string | null,
  description?: string | null
): string {
  const cleanCompany = (company || '').trim();
  if (
    cleanCompany &&
    cleanCompany !== 'N/A' &&
    cleanCompany !== 'null' &&
    cleanCompany !== 'undefined' &&
    !cleanCompany.toLowerCase().includes('unspecified')
  ) {
    return cleanCompany;
  }

  const text = `${category || ''} ${description || ''}`.toLowerCase();
  if (text.includes('geek squad') || text.includes('best buy')) return 'Geek Squad';
  if (text.includes('paypal')) return 'PayPal';
  if (text.includes('apple') || text.includes('icloud')) return 'Apple Support';
  if (text.includes('amazon')) return 'Amazon Customer Service';
  if (text.includes('mcafee')) return 'McAfee Antivirus';
  if (text.includes('norton') || text.includes('lifelock')) return 'Norton LifeLock';
  if (text.includes('microsoft') || text.includes('windows defender')) return 'Microsoft Windows Support';
  if (text.includes('pch') || text.includes('publishers clearing')) return 'Publishers Clearing House';
  if (text.includes('crypto') || text.includes('bitcoin') || text.includes('wallet') || text.includes('blockchain')) return 'Blockchain Asset Recovery Desk';
  if (text.includes('spell') || text.includes('spiritual') || text.includes('herbal') || text.includes('voodoo')) return 'Spiritual Healing Sanctuary';
  if (text.includes('chase') || text.includes('bank of america') || text.includes('wells fargo') || text.includes('citi')) return 'Bank Fraud Prevention Desk';
  if (text.includes('social security') || text.includes('ssa')) return 'Social Security Administration';
  if (text.includes('irs') || text.includes('tax')) return 'Internal Revenue Service';
  if (text.includes('lottery') || text.includes('sweepstake')) return 'National Sweepstakes Claims';
  if (text.includes('refund') || text.includes('tech support')) return 'Tech Support Refund Center';
  if (text.includes('stake') || text.includes('casino')) return 'Online Casino Claims Desk';
  if (text.includes('facebook') || text.includes('meta')) return 'Meta Support';

  if (category && category !== 'N/A' && category.trim().length > 0 && !category.toLowerCase().includes('unspecified')) {
    return category.trim();
  }

  return 'Financial & Tech Support Desk';
}
